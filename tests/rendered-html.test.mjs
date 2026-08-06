import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUZZLES,
  formatTimeUntilPuzzleLaunch,
  getDailyPuzzle,
  getNextPuzzle,
  getNextPuzzleLaunchAt,
  getPuzzleDateCode,
  isAcceptedGuess,
  normalizeGuess,
  toPublicPuzzle,
} from "../lib/puzzles.ts";
import { restorePlay } from "../lib/play-state.ts";
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
  const structures = new Set(PUZZLES.map((puzzle) => puzzle.structure));
  for (const expected of ["literal", "idiom", "rebus", "person", "story", "movie", "historical", "interpretive"]) {
    assert.equal(structures.has(expected), true, `missing ${expected} puzzle`);
  }
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

test("derives the public YYMMDD code from each puzzle's scheduled UTC date", () => {
  assert.equal(getPuzzleDateCode(PUZZLES[0]), "260805");
  assert.equal(getPuzzleDateCode(PUZZLES[1]), "260806");
  assert.equal(toPublicPuzzle(PUZZLES[0]).dateCode, "260805");
});

test("advances through the playtest set and wraps after the final puzzle", () => {
  assert.equal(getNextPuzzle(PUZZLES[0]).number, 2);
  assert.equal(getNextPuzzle(PUZZLES.at(-1)).number, 1);
});

test("keeps saved play state isolated while advancing through sequence puzzles", () => {
  const puzzle2Key = `emoji-daily-play:${PUZZLES[1].id}`;
  const puzzle3Key = `emoji-daily-play:${PUZZLES[2].id}`;
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

test("counts down to the next UTC puzzle launch in hours and minutes", () => {
  const now = new Date("2026-12-31T22:54:30Z");
  const launchAt = getNextPuzzleLaunchAt(now);
  assert.equal(launchAt, Date.parse("2027-01-01T00:00:00Z"));
  assert.equal(formatTimeUntilPuzzleLaunch(now.getTime(), launchAt), "1h 6m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt - 42 * 60_000, launchAt), "0h 42m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt - 1, launchAt), "0h 1m");
  assert.equal(formatTimeUntilPuzzleLaunch(launchAt, launchAt), "0h 0m");
});

test("keeps answers server-side and includes the complete interaction loop", async () => {
  const [page, client, feedback, nextRoute, startOverRoute, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DailyPuzzle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/next/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/startover/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /acceptedAnswers|answer:/);
  assert.match(client, /Need a hint\?/);
  assert.match(client, /Reveal answer/);
  assert.match(client, /Share result/);
  assert.match(client, /Copy link/);
  assert.match(client, /Messages/);
  assert.match(client, /Email/);
  assert.match(client, /Next puzzle/);
  assert.match(client, /Next puzzle arrives in/);
  assert.match(client, /sequenceMode && nextPuzzleNumber/);
  assert.match(client, /hydratedPuzzleId === puzzle\.id/);
  assert.match(client, /setPlay\(restorePlay\(localStorage, storageKey\) \?\? freshPlay\(\)\)/);
  assert.match(client, /feedbackPlayFields\(puzzle, play\)/);
  assert.match(client, /window\.location\.replace\("\/"\)/);
  assert.match(client, /How was this puzzle\?/);
  assert.match(client, /PUZZLE #\{puzzle\.dateCode\}/);
  assert.match(feedback, /anonymousSessionId/);
  assert.match(feedback, /metadataJson/);
  assert.doesNotMatch(`${client}\n${feedback}\n${schema}`, /elapsedSeconds|elapsed_seconds|startedAt|endedAt/);
  assert.match(page, /sequenceMode=\{false\}/);
  assert.match(page, /key=\{puzzle\.id\}/);
  assert.match(nextRoute, /getNextPuzzle/);
  assert.match(nextRoute, /sequenceMode/);
  assert.match(nextRoute, /nextPuzzleNumber/);
  assert.match(nextRoute, /key=\{puzzle\.id\}/);
  assert.doesNotMatch(nextRoute, /redirect/);
  assert.match(startOverRoute, /localStorage\.clear\(\)/);
  assert.match(startOverRoute, /sessionStorage\.clear\(\)/);
  assert.match(startOverRoute, /window\.location\.replace\("\/"\)/);
});
