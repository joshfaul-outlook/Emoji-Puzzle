import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { TableClient } from "@azure/data-tables";
import { applyPlayAction, consumeVerificationChallenge, createPlayerSession, createPlayerWithSession, createVerificationChallenge, feedbackTable, getPlay, getPlayerSession, getVerificationChallenge, insertFeedback, listFeedback, NameUnavailableError, playerNameAvailable, revokePlayerSession, startPlay, VerificationRateLimitError } from "../dist/src/storage.js";
import { hashPlayerToken, hashVerificationCode, verificationCodeMatches } from "../dist/src/player-identity.js";

const connection = process.env.TABLE_STORAGE_CONNECTION_STRING;
if (!connection) throw new Error("TABLE_STORAGE_CONNECTION_STRING is required for storage tests");
process.env.PLAYER_RECOVERY_HMAC_SECRET = "test-recovery-secret-with-at-least-32-characters";

await Promise.all(["PlayerDirectory", "PuzzlePlays", "PuzzleFeedback", "PlayerVerifications"].map(async (name) => {
  const table = TableClient.fromConnectionString(connection, name);
  await table.createTable().catch((error) => { if (error.statusCode !== 409) throw error; });
}));

test("atomically reserves normalized player names under concurrency", async () => {
  const suffix = randomUUID().slice(0, 8); const normalizedDisplayName = `racer-${suffix}`;
  assert.equal(await playerNameAvailable(normalizedDisplayName), true);
  const make = (displayName) => createPlayerWithSession({ playerId: randomUUID(), displayName, normalizedDisplayName, recoveryEmailKey: randomUUID().replaceAll("-", "").padEnd(64, "0"), sessionId: randomUUID(), tokenHash: hashPlayerToken("a".repeat(43)) });
  const results = await Promise.allSettled([make(`Racer-${suffix}`), make(`RACER-${suffix}`)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  const rejected = results.find((item) => item.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof NameUnavailableError);
  assert.equal(await playerNameAvailable(normalizedDisplayName), false);
});

test("supports independent revocable sessions for one player", async () => {
  const suffix = randomUUID().slice(0, 8); const token = "a".repeat(43);
  const created = await createPlayerWithSession({ playerId: randomUUID(), displayName: `Player-${suffix}`, normalizedDisplayName: `player-${suffix}`, recoveryEmailKey: randomUUID().replaceAll("-", "").padEnd(64, "1"), sessionId: randomUUID(), tokenHash: hashPlayerToken(token) });
  const second = await createPlayerSession({ sessionId: randomUUID(), playerId: created.player.playerId, tokenHash: hashPlayerToken("b".repeat(43)) });
  assert.equal((await getPlayerSession(created.session.sessionId))?.playerId, created.player.playerId);
  assert.equal((await getPlayerSession(second.sessionId))?.playerId, created.player.playerId);
  await revokePlayerSession(second.sessionId);
  assert.ok((await getPlayerSession(second.sessionId))?.revokedAt);
  assert.equal((await getPlayerSession(created.session.sessionId))?.revokedAt, null);
});

test("stores hashed, expiring, single-use verification challenges", async () => {
  const challengeId = randomUUID(); const code = "123456"; const emailKey = randomUUID().replaceAll("-", "").padEnd(64, "2");
  await createVerificationChallenge({ challengeId, purpose: "recover", emailKey, codeHash: hashVerificationCode(challengeId, code) });
  const stored = await getVerificationChallenge(challengeId);
  assert.ok(stored); assert.notEqual(stored.codeHash, code); assert.equal(verificationCodeMatches(challengeId, code, stored.codeHash), true); assert.equal(Date.parse(stored.expiresAt) - Date.parse(stored.createdAt), 600_000);
  await assert.rejects(() => createVerificationChallenge({ challengeId: randomUUID(), purpose: "recover", emailKey, codeHash: hashVerificationCode(randomUUID(), code) }), VerificationRateLimitError);
  await consumeVerificationChallenge(stored);
  assert.ok((await getVerificationChallenge(challengeId))?.consumedAt);
});

test("starts once and records idempotent play actions", async () => {
  const playerId = randomUUID(); const playId = randomUUID();
  const input = { playerId, playId, puzzleId: "puzzle-one", puzzleNumber: 1, pool: "daily", context: "daily", rankingEligible: true };
  const first = await startPlay(input); assert.equal(first.created, true); assert.notEqual(first.play.playId, playId);
  assert.equal((await startPlay({ ...input, playId: randomUUID() })).play.playId, first.play.playId);
  const canonicalPlayId = first.play.playId;
  const guess = { playerId, playId: canonicalPlayId, puzzleId: "puzzle-one", pool: "daily", operationId: "guess-one", kind: "guess", correct: false };
  assert.equal((await applyPlayAction(guess)).play.guessCount, 1);
  assert.equal((await applyPlayAction(guess)).play.guessCount, 1);
  const hint = { playerId, playId: canonicalPlayId, puzzleId: "puzzle-one", pool: "daily", operationId: "hint-0", kind: "hint", hintIndex: 0 };
  assert.equal((await applyPlayAction(hint)).play.hintCount, 1);
  assert.equal((await applyPlayAction(hint)).play.hintCount, 1);
  const solve = { playerId, playId: canonicalPlayId, puzzleId: "puzzle-one", pool: "daily", operationId: "guess-two", kind: "guess", correct: true };
  const completed = (await applyPlayAction(solve)).play;
  assert.equal(completed.guessCount, 2); assert.equal(completed.outcome, "solved"); assert.ok(completed.completedAt);
  assert.deepEqual(await getPlay(playerId, canonicalPlayId), completed);
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
  const feedback = { puzzleId: `new-${suffix}`, puzzleNumber: 1, puzzlePool: "daily", rating: "up", comment: null, playId: suffix, anonymousSessionId: "legacy", playerId: suffix, displayName: "PuzzleDad", outcome: "solved", guessCount: 1, hintCount: 0, metadataJson: "{}" };
  assert.equal(await insertFeedback(feedback), true);
  assert.equal(await insertFeedback(feedback), false);
  await feedbackTable().createEntity({ partitionKey: "Legacy", rowKey: `legacy-${suffix}`, puzzleId: `old-${suffix}`, puzzleNumber: 2, puzzlePool: "daily", rating: "down", comment: null, playId: "", anonymousSessionId: "old", outcome: "revealed", guessCount: 2, hintCount: 1, metadataJson: "{}", createdAt: now });
  const rows = await listFeedback(500);
  const attributed = rows.find((row) => row.puzzleId === `new-${suffix}`); const legacy = rows.find((row) => row.puzzleId === `old-${suffix}`);
  assert.equal(attributed?.displayName, "PuzzleDad"); assert.equal(attributed?.playerId, suffix);
  assert.equal(rows.filter((row) => row.puzzleId === `new-${suffix}`).length, 1);
  assert.equal(legacy?.displayName, null); assert.equal(legacy?.playerId, null);
});
