import assert from "node:assert/strict";
import test from "node:test";
import { buildRankings, dailyStreaks, eligibleDailyPlays, summarizePlays } from "../dist/src/ranking-math.js";

const launch = "2026-08-01";
const date = (i) => new Date(Date.parse(`${launch}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
const assignment = (i, extra = {}) => ({ dailyDate: date(i), puzzleId: `p${i}`, revision: `r${i}`, void: false, ...extra });
const play = (i, extra = {}) => ({ playerId: "a", playId: `play${i}`, puzzleId: `p${i}`, pool: "daily", context: "daily", rankingEligible: true, startedAt: `${date(i)}T01:00:00Z`, completedAt: `${date(i)}T02:00:00Z`, outcome: "solved", guessCount: 2, hintCount: 0, dailyDate: date(i), puzzleRevision: `r${i}`, rankingOutcome: "solved", ...extra });
const now = (i, time = "12:00:00") => new Date(`${date(i)}T${time}Z`);

test("summaries use completed solve rates, solved averages and distinct attempts", () => {
  const first = play(0); const revealed = play(1, { outcome: "revealed", guessCount: 20, hintCount: 3 });
  const unfinished = play(2, { outcome: "playing", completedAt: null });
  const summary = summarizePlays([first, first, revealed, unfinished, play(3, { puzzleId: "p0", guessCount: 4, hintCount: 2 })]);
  assert.equal(summary.started, 4); assert.equal(summary.solved, 2); assert.equal(summary.distinctSolved, 1);
  assert.equal(summary.solveRate, 2 / 3); assert.equal(summary.averageGuesses, 3); assert.equal(summary.averageHints, 1);
  assert.equal(summary.unfinished, 1); assert.equal(summary.unaidedSolves, 1);
  assert.equal(summarizePlays([]).solveRate, null); assert.equal(summarizePlays([]).averageGuesses, null);
});

test("ranking excludes non-Daily noise, late completions, wrong revisions and previews", () => {
  const assignments = Array.from({ length: 8 }, (_, i) => assignment(i));
  const plays = [play(0), play(1, { context: "practice", pool: "practice" }), play(2, { context: "challenge", pool: "practice" }), play(3, { completedAt: `${date(4)}T00:00:00Z` }), play(4, { puzzleRevision: "wrong" }), play(5, { rankingEligible: false }), play(6), play(6, { context: "author-test", playId: "preview" }), play(7, { rankingOutcome: undefined })];
  assert.deepEqual(eligibleDailyPlays(plays, assignments, launch, now(8)).map((p) => p.puzzleId), ["p0"]);
  const baseline = buildRankings([play(0)], assignments, [{ playerId: "a", displayName: "Ada" }], launch, now(8));
  assert.deepEqual(buildRankings(plays, assignments, [{ playerId: "a", displayName: "Ada" }], launch, now(8)), baseline);
});

test("repeats cannot replace a reveal, improve a solve or count after window expiry", () => {
  const assignments = [assignment(0), assignment(35, { puzzleId: "p0", revision: "r0" })];
  const replay = play(35, { puzzleId: "p0", puzzleRevision: "r0" });
  assert.equal(eligibleDailyPlays([play(0, { outcome: "revealed", rankingOutcome: "revealed" }), replay], assignments, launch, now(35)).length, 0);
  assert.equal(eligibleDailyPlays([replay], assignments, launch, now(35)).length, 0, "missing the original does not make a repeat eligible");
  assert.equal(buildRankings([play(0), replay], assignments, [{ playerId: "a", displayName: "Ada" }], launch, now(35)).length, 0);
  assert.equal(eligibleDailyPlays([play(0), play(0, { playId: "new", hintCount: 0, startedAt: `${date(0)}T03:00:00Z` })], assignments, launch, now(1)).length, 1);
});

test("Daily deadline is exclusive at midnight and never accepts future completions", () => {
  const a = [assignment(0)];
  assert.equal(eligibleDailyPlays([play(0, { completedAt: `${date(0)}T23:59:59.999Z` })], a, launch, now(1)).length, 1);
  assert.equal(eligibleDailyPlays([play(0, { completedAt: `${date(1)}T00:00:00Z` })], a, launch, now(1)).length, 0);
  assert.equal(eligibleDailyPlays([play(0)], a, launch, now(0, "01:30:00")).length, 0);
});

test("streaks span more than 30 days and today's pending solve has a grace period", () => {
  const assignments = Array.from({ length: 41 }, (_, i) => assignment(i));
  const plays = Array.from({ length: 40 }, (_, i) => play(i, { hintCount: 2 }));
  assert.deepEqual(dailyStreaks(plays, assignments, launch, now(40)), { current: 40, best: 40 });
  assert.deepEqual(dailyStreaks([...plays, play(40, { outcome: "revealed", rankingOutcome: "revealed" })], assignments, launch, now(40)), { current: 0, best: 40 });
  assert.deepEqual(dailyStreaks(plays, assignments, launch, now(41, "00:00:00")), { current: 0, best: 40 });
  assert.deepEqual(dailyStreaks([...plays, play(40)], assignments, launch, now(40)), { current: 41, best: 41 });
});

test("void and repeated dates preserve but do not extend streaks; missing dates break them", () => {
  const plays = [play(0), play(1), play(3)];
  assert.deepEqual(dailyStreaks(plays, [assignment(0), assignment(1), assignment(2, { void: true }), assignment(3)], launch, now(3)), { current: 3, best: 3 });
  assert.deepEqual(dailyStreaks(plays, [assignment(0), assignment(1), assignment(2, { puzzleId: "p0" }), assignment(3)], launch, now(3)), { current: 3, best: 3 });
  assert.deepEqual(dailyStreaks(plays, [assignment(0), assignment(1), assignment(3)], launch, now(3)), { current: 1, best: 2 });
});

test("public participation defaults on, explicit opt-out is excluded, equal metrics share ranks", () => {
  const players = ["a", "b", "c", "d", "e"].map((playerId) => ({ playerId, displayName: playerId, ...(playerId === "e" ? { publicStats: false } : {}) }));
  const plays = [play(0), play(1), ...["b", "c", "d", "e"].map((playerId) => play(0, { playerId, hintCount: playerId === "d" ? 1 : 0 }))];
  const rows = buildRankings(plays, [assignment(0), assignment(1)], players, launch, now(1));
  assert.deepEqual(rows.map((r) => [r.playerId, r.rank]), [["a", 1], ["b", 2], ["c", 2], ["d", 4]]);
});

test("streaks cross UTC year boundaries without local-time assumptions", () => {
  const a = assignment(0, { dailyDate: "2026-12-31" });
  const b = assignment(1, { dailyDate: "2027-01-01" });
  const p = (assignment) => play(0, { playId: assignment.puzzleId, puzzleId: assignment.puzzleId, dailyDate: assignment.dailyDate, puzzleRevision: assignment.revision, startedAt: `${assignment.dailyDate}T01:00:00Z`, completedAt: `${assignment.dailyDate}T02:00:00Z` });
  assert.deepEqual(dailyStreaks([p(a), p(b)], [a, b], "2026-12-31", new Date("2027-01-01T23:00:00Z")), { current: 2, best: 2 });
});
