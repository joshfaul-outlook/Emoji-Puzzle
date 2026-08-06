import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUZZLES,
  formatTimeUntilPuzzleLaunch,
  getDailyPuzzle,
  getNextPuzzle,
  getNextPuzzleLaunchAt,
  isAcceptedGuess,
  normalizeGuess,
} from "../lib/puzzles.ts";

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

test("advances through the playtest set and wraps after the final puzzle", () => {
  assert.equal(getNextPuzzle(PUZZLES[0]).number, 2);
  assert.equal(getNextPuzzle(PUZZLES.at(-1)).number, 1);
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
  assert.match(client, /window\.location\.replace\("\/"\)/);
  assert.match(client, /How was this puzzle\?/);
  assert.match(feedback, /anonymousSessionId/);
  assert.match(feedback, /metadataJson/);
  assert.doesNotMatch(`${client}\n${feedback}\n${schema}`, /elapsedSeconds|elapsed_seconds|startedAt|endedAt/);
  assert.match(page, /sequenceMode=\{false\}/);
  assert.match(nextRoute, /getNextPuzzle/);
  assert.match(nextRoute, /sequenceMode/);
  assert.match(nextRoute, /nextPuzzleNumber/);
  assert.doesNotMatch(nextRoute, /redirect/);
  assert.match(startOverRoute, /localStorage\.clear\(\)/);
  assert.match(startOverRoute, /sessionStorage\.clear\(\)/);
  assert.match(startOverRoute, /window\.location\.replace\("\/"\)/);
});
