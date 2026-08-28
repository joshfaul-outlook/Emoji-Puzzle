import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { TableClient } from "@azure/data-tables";
import { applyPlayAction, createPlayer, feedbackTable, getPlay, insertFeedback, listFeedback, NameUnavailableError, playerNameAvailable, startPlay } from "../dist/src/storage.js";
import { hashPlayerToken } from "../dist/src/player-identity.js";

const connection = process.env.TABLE_STORAGE_CONNECTION_STRING;
if (!connection) throw new Error("TABLE_STORAGE_CONNECTION_STRING is required for storage tests");

await Promise.all(["PlayerDirectory", "PuzzlePlays", "PuzzleFeedback"].map(async (name) => {
  const table = TableClient.fromConnectionString(connection, name);
  await table.createTable().catch((error) => { if (error.statusCode !== 409) throw error; });
}));

test("atomically reserves normalized player names under concurrency", async () => {
  const suffix = randomUUID().slice(0, 8); const normalizedDisplayName = `racer-${suffix}`;
  assert.equal(await playerNameAvailable(normalizedDisplayName), true);
  const make = (displayName) => createPlayer({ playerId: randomUUID(), displayName, normalizedDisplayName, tokenHash: hashPlayerToken("a".repeat(43)) });
  const results = await Promise.allSettled([make(`Racer-${suffix}`), make(`RACER-${suffix}`)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = results.find((item) => item.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof NameUnavailableError);
  assert.equal(await playerNameAvailable(normalizedDisplayName), false);
});

test("starts once and records idempotent play actions", async () => {
  const playerId = randomUUID(); const playId = randomUUID();
  const input = { playerId, playId, puzzleId: "puzzle-one", puzzleNumber: 1, pool: "daily", context: "daily", rankingEligible: true };
  assert.equal((await startPlay(input)).created, true);
  assert.equal((await startPlay(input)).created, false);
  const guess = { playerId, playId, puzzleId: "puzzle-one", pool: "daily", operationId: "guess-one", kind: "guess", correct: false };
  assert.equal((await applyPlayAction(guess)).play.guessCount, 1);
  assert.equal((await applyPlayAction(guess)).play.guessCount, 1);
  const hint = { playerId, playId, puzzleId: "puzzle-one", pool: "daily", operationId: "hint-0", kind: "hint", hintIndex: 0 };
  assert.equal((await applyPlayAction(hint)).play.hintCount, 1);
  assert.equal((await applyPlayAction(hint)).play.hintCount, 1);
  const solve = { playerId, playId, puzzleId: "puzzle-one", pool: "daily", operationId: "guess-two", kind: "guess", correct: true };
  const completed = (await applyPlayAction(solve)).play;
  assert.equal(completed.guessCount, 2); assert.equal(completed.outcome, "solved"); assert.ok(completed.completedAt);
  assert.deepEqual(await getPlay(playerId, playId), completed);
  await assert.rejects(() => applyPlayAction({ ...guess, playerId: randomUUID(), operationId: "stolen" }), /Play not found/);
});

test("keeps non-daily contexts ranking-ineligible and reveal retries idempotent", async () => {
  for (const context of ["practice", "challenge", "author-test"]) {
    const playerId = randomUUID(); const playId = randomUUID();
    const started = await startPlay({ playerId, playId, puzzleId: `p-${context}`, puzzleNumber: 2, pool: context === "author-test" ? "daily" : "practice", context, rankingEligible: false });
    assert.equal(started.play.rankingEligible, false);
    const action = { playerId, playId, puzzleId: `p-${context}`, pool: started.play.pool, operationId: "reveal", kind: "reveal" };
    assert.equal((await applyPlayAction(action)).play.outcome, "revealed");
    assert.equal((await applyPlayAction(action)).play.outcome, "revealed");
  }
});

test("returns attributed and legacy feedback together", async () => {
  const suffix = randomUUID(); const now = new Date().toISOString();
  await insertFeedback({ puzzleId: `new-${suffix}`, puzzleNumber: 1, puzzlePool: "daily", rating: "up", comment: null, playId: suffix, anonymousSessionId: "legacy", playerId: suffix, displayName: "PuzzleDad", outcome: "solved", guessCount: 1, hintCount: 0, metadataJson: "{}" });
  await feedbackTable().createEntity({ partitionKey: "Legacy", rowKey: `legacy-${suffix}`, puzzleId: `old-${suffix}`, puzzleNumber: 2, puzzlePool: "daily", rating: "down", comment: null, playId: "", anonymousSessionId: "old", outcome: "revealed", guessCount: 2, hintCount: 1, metadataJson: "{}", createdAt: now });
  const rows = await listFeedback(500);
  const attributed = rows.find((row) => row.puzzleId === `new-${suffix}`); const legacy = rows.find((row) => row.puzzleId === `old-${suffix}`);
  assert.equal(attributed?.displayName, "PuzzleDad"); assert.equal(attributed?.playerId, suffix);
  assert.equal(legacy?.displayName, null); assert.equal(legacy?.playerId, null);
});
