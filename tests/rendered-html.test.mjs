import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DAILY_PUZZLES,
  ADDITIONAL_PRACTICE_PUZZLES,
  ALL_PUZZLES,
  PRACTICE_PUZZLES,
  PUZZLES,
  formatTimeUntilPuzzleLaunch,
  getDailyPuzzle,
  getNextPuzzle,
  getNextPuzzleLaunchAt,
  getPracticePuzzleByPosition,
  getPuzzleById,
  getPuzzleDateCode,
  isRankingEligible,
  isAcceptedGuess,
  normalizeGuess,
  toPublicPuzzle,
} from "../lib/puzzles.ts";
import {
  dailyPlayStorageKey,
  getActiveMode,
  practicePlayStorageKey,
  restorePlay,
  restorePracticeProgress,
} from "../lib/play-state.ts";
import { feedbackPlayFields } from "../lib/feedback-payload.ts";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("ships 100 varied, fully authored puzzles for the U.S. public test", () => {
  assert.equal(PUZZLES.length, 100);
  assert.deepEqual(
    PUZZLES.map((puzzle) => puzzle.number),
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
  assert.equal(new Set(PUZZLES.map((puzzle) => puzzle.id)).size, 100);
  for (const puzzle of PUZZLES) {
    assert.equal(puzzle.hints.length, 3);
    assert.ok(puzzle.acceptedAnswers.length >= 2);
    assert.equal(isAcceptedGuess(puzzle, puzzle.answer), true, `canonical answer rejected for #${puzzle.number}`);
    assert.ok(puzzle.id.length > 0);
    assert.ok(puzzle.emoji.length > 0);
    assert.ok(puzzle.category.length > 0);
    assert.ok(puzzle.explanation.length > 30);
  }
});

test("separates the active daily rotation from the spoiler-safe practice sequence", () => {
  assert.deepEqual(DAILY_PUZZLES.map((puzzle) => puzzle.number), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(ADDITIONAL_PRACTICE_PUZZLES.length, 250);
  assert.equal(PRACTICE_PUZZLES.length, 330);
  assert.equal(ALL_PUZZLES.length, 350);
  assert.deepEqual(ADDITIONAL_PRACTICE_PUZZLES.map((puzzle) => puzzle.number), Array.from({ length: 250 }, (_, index) => index + 101));
  assert.deepEqual(
    PRACTICE_PUZZLES.map((puzzle) => puzzle.number).toSorted((left, right) => left - right),
    Array.from({ length: 330 }, (_, index) => index + 21),
  );
  const firstFifty = PRACTICE_PUZZLES.slice(0, 50);
  assert.ok(firstFifty.some((puzzle) => puzzle.number <= 100), "the original records are mixed near the front");
  assert.ok(firstFifty.some((puzzle) => puzzle.number >= 101), "the new records are mixed near the front");
  assert.notEqual(getPracticePuzzleByPosition(1).number, 21, "Practice is no longer in authored-number order");
  assert.equal(new Set(ALL_PUZZLES.map((puzzle) => puzzle.id)).size, 350);
  assert.equal(getPuzzleById(DAILY_PUZZLES[0].id, "practice"), undefined);
  assert.equal(getPuzzleById(PRACTICE_PUZZLES[0].id, "daily"), undefined);
});

test("adds lenient authored variants for longer practice answers", () => {
  const lordOfTheRings = ADDITIONAL_PRACTICE_PUZZLES.find((puzzle) => puzzle.id === "lord-rings-practice");
  const peanutButter = ADDITIONAL_PRACTICE_PUZZLES.find((puzzle) => puzzle.id === "peanut-butter-jelly-practice");
  assert.ok(lordOfTheRings);
  assert.ok(peanutButter);
  assert.equal(isAcceptedGuess(lordOfTheRings, "lord of rings"), true);
  assert.equal(isAcceptedGuess(peanutButter, "pbj"), true);
  assert.ok(lordOfTheRings.acceptedAnswers.length >= 3);
});

test("normalizes diacritics, punctuation, casing, apostrophes, ampersands, and whitespace deterministically", () => {
  assert.equal(normalizeGuess("  It’s  RAINING, cats & dogs! "), "its raining cats and dogs");
  assert.equal(normalizeGuess("Víncent van Gogh"), "vincent van gogh");
  assert.equal(isAcceptedGuess(PUZZLES[0], "ITS raining, cats & dogs!"), true);
  assert.equal(isAcceptedGuess(PUZZLES[0], "cloudy with a chance of meatballs"), false);
});

test("accepts separator differences without accepting typos or semantic alternatives", () => {
  for (const guess of ["Víncent van Gogh", "Vincent van-Gogh", "Vincent van—Gogh", "VincentvanGogh"]) {
    assert.equal(isAcceptedGuess(PUZZLES[2], guess), true, `rejected ${guess}`);
  }

  assert.equal(isAcceptedGuess(PUZZLES[2], "Vincnet van Gogh"), false);
  assert.equal(isAcceptedGuess(PUZZLES[9], "Think inside the box"), false);
});

test("keeps shortened and cultural spellings explicitly authored", () => {
  assert.equal(isAcceptedGuess(PUZZLES[8], "Elvis"), true);

  const spellingVariantPuzzle = {
    ...PUZZLES[3],
    answer: "Color theory",
    acceptedAnswers: ["color theory", "colour theory"],
  };
  assert.equal(isAcceptedGuess(spellingVariantPuzzle, "colour theory"), true);
  assert.equal(isAcceptedGuess(spellingVariantPuzzle, "collour theory"), false);
});

test("uses one shared UTC puzzle for the whole calendar day", () => {
  const morning = getDailyPuzzle(new Date("2026-08-06T00:00:01Z"));
  const evening = getDailyPuzzle(new Date("2026-08-06T23:59:59Z"));
  assert.equal(morning.id, evening.id);
  assert.equal(morning.number, 2);
});

test("derives the daily edition code from the actual UTC date", () => {
  const now = new Date("2026-08-25T18:00:00Z");
  const publicPuzzle = toPublicPuzzle(getDailyPuzzle(now), { pool: "daily", context: "daily", now });
  assert.equal(getPuzzleDateCode(now), "260825");
  assert.equal(publicPuzzle.dateCode, "260825");
  assert.equal(publicPuzzle.rankingEligible, true);
  assert.equal(publicPuzzle.legacyStorageEligible, false, "a repeated puzzle must not restore its first-cycle save");
});

test("cycles Daily after 20 and Practice after its independent final puzzle", () => {
  assert.equal(getNextPuzzle(DAILY_PUZZLES[0], "daily").number, 2);
  assert.equal(getNextPuzzle(DAILY_PUZZLES.at(-1), "daily").number, 1);
  assert.equal(getNextPuzzle(PRACTICE_PUZZLES.at(-1), "practice").id, PRACTICE_PUZZLES[0].id);
  assert.equal(getDailyPuzzle(new Date("2026-08-25T00:00:00Z")).number, 1);
});

test("only the genuine daily context is ranking eligible", () => {
  assert.equal(isRankingEligible("daily"), true);
  for (const context of ["practice", "challenge", "author-test"]) {
    assert.equal(isRankingEligible(context), false);
  }
});

test("keeps saved play state isolated while advancing through sequence puzzles", () => {
  const puzzle2Key = dailyPlayStorageKey(PUZZLES[1].id, "260806");
  const puzzle3Key = dailyPlayStorageKey(PUZZLES[2].id, "260807");
  const puzzle2State = {
    playId: "puzzle-2-play",
    guessCount: 4,
    hints: ["A phrase"],
    outcome: "revealed",
    resolution: { answer: "The elephant in the room", category: "Idiom", explanation: "A hidden obvious problem." },
    feedbackSent: true,
  };
  const storage = memoryStorage({ [puzzle2Key]: JSON.stringify(puzzle2State) });

  assert.deepEqual(restorePlay(storage, puzzle2Key), puzzle2State);
  assert.equal(restorePlay(storage, puzzle3Key), null, "a puzzle without a save starts fresh");
  assert.equal(storage.getItem(puzzle3Key), null, "advancing does not copy the prior puzzle save");

  const puzzle3State = {
    playId: "puzzle-3-play",
    guessCount: 1,
    hints: [],
    outcome: "solved",
    resolution: { answer: "Vincent van Gogh", category: "Person", explanation: "A painter with a famous ear." },
    feedbackSent: false,
  };
  storage.setItem(puzzle3Key, JSON.stringify(puzzle3State));
  assert.deepEqual(restorePlay(storage, puzzle3Key), puzzle3State, "the next puzzle restores only its own save");
  assert.deepEqual(restorePlay(storage, puzzle2Key), puzzle2State, "the previous puzzle remains restorable");
  assert.deepEqual(
    feedbackPlayFields(PUZZLES[2], puzzle3State),
    {
      puzzleId: PUZZLES[2].id,
      puzzleNumber: 3,
      playId: "puzzle-3-play",
      outcome: "solved",
      guessCount: 1,
      hintCount: 0,
    },
    "feedback for puzzle 3 uses puzzle 3's play state, never puzzle 2's resolution or outcome",
  );
});

test("restores valid practice progress and isolates replay cycles", () => {
  const storage = memoryStorage({
    "emoji-daily-practice-progress": JSON.stringify({ position: 17, cycle: 2 }),
  });
  assert.deepEqual(restorePracticeProgress(storage, 330), { position: 17, cycle: 2 });
  assert.notEqual(practicePlayStorageKey("practice-puzzle", 2), practicePlayStorageKey("practice-puzzle", 3));
  assert.deepEqual(restorePracticeProgress(memoryStorage({ "emoji-daily-practice-progress": "broken" }), 330), { position: 1, cycle: 0 });
});

test("defaults a new tab session to Daily and retains an explicit Practice selection", () => {
  assert.equal(getActiveMode(memoryStorage()), "daily");
  assert.equal(getActiveMode(memoryStorage({ "emoji-daily-active-mode": "daily" })), "daily");
  assert.equal(getActiveMode(memoryStorage({ "emoji-daily-active-mode": "practice" })), "practice");
});

test("counts down to the next UTC puzzle launch in hours and minutes", () => {
  const now = new Date("2026-12-31T22:54:30Z");
  const launchAt = getNextPuzzleLaunchAt(now);
  assert.equal(launchAt, Date.parse("2027-01-01T00:00:00Z"));
  assert.equal(formatTimeUntilPuzzleLaunch(now.getTime(), launchAt), "1h 6m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt - 42 * 60_000, launchAt), "0h 42m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt - 1, launchAt), "0h 1m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt, launchAt), "0h 0m");
});

test("keeps answers server-side and includes the Azure interaction loop", async () => {
  const [page, practicePage, loader, client, api, storage, admin, editor, emojiSearch, nextRoute, startOverRoute, staticConfig] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/practice/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/GameLoader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DailyPuzzle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../api/src/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/src/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/puzzle/PuzzleEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/puzzle/EmojiSearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/next/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/startover/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../staticwebapp.config.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /acceptedAnswers|answer:/);
  assert.doesNotMatch(`${page}\n${practicePage}\n${loader}\n${client}`, /from ["']\.\.\/lib\/puzzles/);
  assert.match(client, /Need a hint\?/);
  assert.match(client, /Reveal answer/);
  assert.match(client, /Share result/);
  assert.match(client, /Copy link/);
  assert.match(client, /Messages/);
  assert.match(client, /Email/);
  assert.match(client, /Next puzzle/);
  assert.match(client, /Next puzzle arrives in/);
  assert.match(client, /hydratedPuzzleId === puzzle\.id/);
  assert.match(client, /PRACTICE_PROGRESS_KEY/);
  assert.match(client, /ACTIVE_MODE_KEY/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /challengePlayStorageKey/);
  assert.match(client, /feedbackPlayFields\(puzzle, play\)/);
  assert.match(client, /window\.location\.replace\("\/"\)/);
  assert.match(client, /How was this puzzle\?/);
  assert.match(client, /puzzle\.dateCode/);
  assert.match(client, /Daily/);
  assert.match(client, /Practice/);
  assert.match(client, /Can you beat my result/);
  assert.match(client, /puzzle\.pool !== "practice"/);
  assert.doesNotMatch(client, /PRACTICE \$\{puzzle\.sequenceNumber\}/);
  assert.match(api, /anonymousSessionId/);
  assert.match(api, /pool === "practice" && comment !== null/);
  assert.match(storage, /PuzzleCatalog/);
  assert.match(storage, /PuzzleFeedback/);
  assert.match(storage, /etag/);
  assert.match(admin, /New puzzle/);
  assert.match(editor, /Publish/);
  assert.match(editor, /Archive/);
  assert.match(emojiSearch, /Use suggested/);
  assert.match(emojiSearch, /Copy/);
  assert.match(emojiSearch, /Undo/);
  assert.match(loader, /context === "challenge"/);
  assert.match(practicePage, /GameLoader mode="practice"/);
  assert.match(nextRoute, /GameLoader mode="next"/);
  assert.doesNotMatch(nextRoute, /redirect/);
  assert.match(staticConfig, /node:22/);
  assert.match(startOverRoute, /localStorage\.clear\(\)/);
  assert.match(startOverRoute, /sessionStorage\.clear\(\)/);
  assert.match(startOverRoute, /window\.location\.replace\("\/"\)/);
});
