import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import azureFunctions from "@azure/functions";
const { HttpRequest, InvocationContext } = azureFunctions;
import { TableClient } from "@azure/data-tables";
import { createPlayerWithSession, createPuzzle, applyPlayAction, getPlayer, setPublicStats, listPlays, startPlay, playerTable, updatePuzzle } from "../dist/src/storage.js";
import { hashPlayerToken } from "../dist/src/player-identity.js";
import { ensureDailyAssignment, getDailyAssignment, getRankingsLaunchDate, voidDailyAssignment, recordPublicExposure } from "../dist/src/daily-schedule.js";
import { playerStats, rankingsPage } from "../dist/src/rankings.js";
import { currentPuzzle, playsStart, guess, hint, reveal, myStats, playerPreferences } from "../dist/src/index.js";

process.env.GAME_LAUNCH_DATE = "2090-01-01";
process.env.PLAYER_RECOVERY_HMAC_SECRET = "rankings-test-secret-at-least-32-characters";
const connection = process.env.TABLE_STORAGE_CONNECTION_STRING;
if (connection !== "UseDevelopmentStorage=true") throw new Error("Tests require disposable local storage");
await Promise.all(["PuzzleCatalog", "PuzzlePlays", "PlayerDirectory"].map(async (name) => {
  await TableClient.fromConnectionString(connection, name).createTable().catch((e) => { if (e.statusCode !== 409) throw e; });
}));
const context = new InvocationContext({ functionName: "rankings-test" });
const token = "a".repeat(43);
async function player() {
  const playerId = randomUUID();
  return createPlayerWithSession({ playerId, displayName: playerId.slice(0, 12), normalizedDisplayName: playerId, recoveryEmailKey: playerId.replaceAll("-", "").padEnd(64, "0"), sessionId: randomUUID(), tokenHash: hashPlayerToken(token) });
}
function request(path, identity, body, method = body ? "POST" : "GET") {
  return new HttpRequest({ url: `https://example.test/api/${path}`, method, headers: { origin: "https://example.test", "content-type": "application/json", ...(identity ? { "x-emojizzle-player-id": identity.player.playerId, "x-emojizzle-player-session-id": identity.session.sessionId, "x-emojizzle-player-token": token } : {}) }, ...(body ? { body: { string: JSON.stringify(body) } } : {}) });
}
const authored = (answer) => ({ pool: "daily", status: "published", emoji: "🌧️🐈🐕", answer, acceptedAnswers: [answer], category: "Phrase", structure: "literal", hints: ["Category", "Interpretation", "Near answer"], explanation: "A test explanation that stays server-side until completion." });

test("rankings storage, schedule and authenticated API integration", async (t) => {
  const ada = await player(); const bob = await player();
  const first = await createPuzzle(authored("First answer"));
  const second = await createPuzzle(authored("Second answer"));
  let day1;
  await t.test("date and puzzle reservations are atomic and snapshots survive edits", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => ensureDailyAssignment(new Date("2090-01-01T12:00:00Z"))));
    assert.equal(new Set(results.map((r) => r.puzzleId)).size, 1);
    day1 = results[0]; assert.equal(day1.puzzleId, first.id);
    assert.equal(await getRankingsLaunchDate(), "2090-01-01", "first deployed request fixes the rankings epoch");
    const edited = await updatePuzzle(first, { answer: "Edited answer", acceptedAnswers: ["Edited answer"], pool: "practice" }, first.etag);
    assert.equal(edited.answer, "Edited answer");
    assert.equal((await getDailyAssignment("2090-01-01")).puzzle.answer, "First answer");
    await assert.rejects(() => recordPublicExposure(first.id), /assigned Daily/);
    const next = await ensureDailyAssignment(new Date("2090-01-02T12:00:00Z"));
    assert.equal(next.puzzleId, second.id);
    assert.equal(await getRankingsLaunchDate(), "2090-01-01", "later requests and deployments reuse the persisted epoch");
    assert.equal((await ensureDailyAssignment(new Date("2090-01-03T12:00:00Z"))).void, true);
  });
  let canonical;
  await t.test("late results and action retries cannot gain or improve ranking credit", async () => {
    const input = { playerId: ada.player.playerId, playId: randomUUID(), puzzleId: first.id, puzzleNumber: first.number, pool: "daily", context: "daily", rankingEligible: true, dailyDate: day1.dailyDate, puzzleRevision: day1.revision, rankingOutcome: "pending" };
    canonical = (await startPlay(input)).play;
    // Clock used at action mutation controls the deadline, independent of client clocks.
    const action = { playerId: ada.player.playerId, playId: canonical.playId, puzzleId: first.id, pool: "daily", operationId: "one", kind: "hint", hintIndex: 0 };
    await applyPlayAction(action);
    await assert.rejects(() => applyPlayAction({ ...action, hintIndex: 2 }), /another action/);
    assert.equal((await applyPlayAction(action)).play.hintCount, 1);
    await assert.rejects(() => applyPlayAction({ ...action, kind: "reveal" }), /another action/);
    const completed = await applyPlayAction({ ...action, kind: "guess", operationId: "two", correct: true }, () => new Date("2090-01-02T00:00:00Z"));
    assert.equal(completed.play.rankingOutcome, "late");
    const replay = await startPlay({ ...input, playId: randomUUID(), dailyDate: "2090-01-20" });
    assert.equal(replay.play.dailyDate, "2090-01-01"); assert.equal(replay.play.outcome, "solved");
    assert.equal((await listPlays(ada.player.playerId)).length, 1, "action rows never become attempts");
  });
  await t.test("preference defaults on and opt-outs survive recovery and stats reads", async () => {
    assert.equal((await getPlayer(ada.player.playerId)).publicStats, true);
    await setPublicStats(ada.player.playerId, false);
    assert.equal((await getPlayer(ada.player.playerId)).publicStats, false);
    const legacy = await player();
    const entity = await playerTable().getEntity("Players", `player:${legacy.player.playerId}`);
    delete entity.publicStats;
    await playerTable().updateEntity(entity, "Replace", { etag: entity.etag });
    assert.equal((await getPlayer(legacy.player.playerId)).publicStats, true);
    const response = await playerPreferences(request("players/me/preferences", ada, { publicStats: true }, "PATCH"), context);
    assert.equal(response.status, 200); assert.equal((await getPlayer(ada.player.playerId)).publicStats, true);
  });
  await t.test("private stats require authentication and cannot select another player", async () => {
    assert.equal((await myStats(request("players/me/stats"), context)).status, 401);
    const response = await myStats(request(`players/me/stats?playerId=${ada.player.playerId}`, bob), context);
    assert.equal(response.status, 200); assert.equal(response.jsonBody.daily.started, 0);
    assert.equal(response.headers["cache-control"], "no-store");
  });
  await t.test("public preview and context spoofing cannot reveal Daily answers", async () => {
    assert.equal((await currentPuzzle(request("puzzles/current?mode=next"))).status, 403);
    assert.equal((await currentPuzzle(request("puzzles/current?puzzle=1"))).status, 403);
    for (const playContext of ["practice", "challenge", "author-test"]) {
      const response = await playsStart(request("plays/start", bob, { puzzleId: second.id, pool: "daily", playId: randomUUID(), context: playContext }), context);
      assert.ok([400, 403].includes(response.status));
      assert.equal(JSON.stringify(response).includes("Second answer"), false);
    }
    for (const handler of [guess, hint, reveal]) {
      const response = await handler(request("action", bob, { puzzleId: first.id, pool: "daily", playId: canonical.playId, operationId: randomUUID(), guess: "First answer", hintIndex: 0 }), context);
      assert.equal(response.status, 400); assert.equal(JSON.stringify(response).includes("First answer"), false);
    }
  });
  await t.test("gameplay uses the frozen Daily answer after catalog changes", async () => {
    const identity = await player();
    const { play } = await startPlay({ playerId: identity.player.playerId, playId: randomUUID(), puzzleId: first.id, puzzleNumber: first.number, pool: "daily", context: "daily", rankingEligible: true, dailyDate: day1.dailyDate, puzzleRevision: day1.revision, rankingOutcome: "pending" });
    const fields = { puzzleId: first.id, pool: "daily", playId: play.playId };
    const hintResponse = await hint(request("hint", identity, { ...fields, operationId: "hint-zero", hintIndex: 0 }), context);
    assert.equal(hintResponse.jsonBody.hint, "Category");
    const wrong = await guess(request("guess", identity, { ...fields, operationId: "guess-one", guess: "Edited answer" }), context);
    assert.equal(wrong.jsonBody.correct, false);
    const reused = await guess(request("guess", identity, { ...fields, operationId: "guess-one", guess: "First answer" }), context);
    assert.equal(reused.status, 409, "an operation ID cannot hide a second guess");
    const solved = await guess(request("guess", identity, { ...fields, operationId: "guess-two", guess: "First answer" }), context);
    assert.equal(solved.jsonBody.correct, true); assert.equal(solved.jsonBody.resolution.answer, "First answer");
    assert.equal((await listPlays(identity.player.playerId))[0].guessCount, 2);
  });
  await t.test("complete public snapshot respects current visibility and void dates", async () => {
    // Insert server-shaped historical facts at a known timestamp for aggregation.
    const day2 = await getDailyAssignment("2090-01-02");
    const started = await startPlay({ playerId: bob.player.playerId, playId: randomUUID(), puzzleId: second.id, puzzleNumber: second.number, pool: "daily", context: "daily", rankingEligible: true, dailyDate: day2.dailyDate, puzzleRevision: day2.revision, rankingOutcome: "pending" });
    const table = TableClient.fromConnectionString(connection, "PuzzlePlays");
    await table.updateEntity({ partitionKey: bob.player.playerId, rowKey: `play:${started.play.playId}`, startedAt: "2090-01-02T01:00:00Z" }, "Merge");
    await applyPlayAction({ playerId: bob.player.playerId, playId: started.play.playId, puzzleId: second.id, pool: "daily", operationId: "solve", kind: "guess", correct: true }, () => new Date("2090-01-02T02:00:00Z"));
    const board = await rankingsPage(undefined, new Date("2090-01-02T12:00:00Z"));
    assert.equal(board.total, 1); assert.equal(board.rows[0].displayName, bob.player.displayName);
    assert.deepEqual(Object.keys(board.rows[0]).sort(), ["currentStreak", "displayName", "rank", "solves", "unaidedSolves"]);
    await setPublicStats(bob.player.playerId, false);
    assert.equal((await rankingsPage(undefined, new Date("2090-01-02T12:00:01Z"))).total, 0);
    await setPublicStats(bob.player.playerId, true);
    const privateStats = await playerStats(await getPlayer(bob.player.playerId), "all", new Date("2090-01-02T12:00:02Z"));
    assert.equal(privateStats.streaks.current, 1); assert.equal(privateStats.ownRank.rank, 1);
    await voidDailyAssignment("2090-01-02");
    // A snapshot invalidated by a void must never expose its old credit while a
    // refresh lease is active. Returning unavailable is safer than stale rank.
    await assert.rejects(() => rankingsPage(undefined, new Date("2090-01-02T12:00:03Z")), /updating/);
    assert.equal((await rankingsPage(undefined, new Date("2090-01-02T12:06:00Z"))).total, 0);
  });
  await t.test("pagination shares ranks across pages and invalidates cursors after opt-out", async () => {
    const fresh = await createPuzzle(authored("Fresh fourth day"));
    const assignment = await ensureDailyAssignment(new Date("2090-01-04T01:00:00Z"));
    assert.equal(assignment.puzzleId, fresh.id);
    const players = await Promise.all(Array.from({ length: 27 }, () => player()));
    const table = TableClient.fromConnectionString(connection, "PuzzlePlays");
    for (const identity of players) {
      const { play } = await startPlay({ playerId: identity.player.playerId, playId: randomUUID(), puzzleId: fresh.id, puzzleNumber: fresh.number, pool: "daily", context: "daily", rankingEligible: true, dailyDate: assignment.dailyDate, puzzleRevision: assignment.revision, rankingOutcome: "pending" });
      await table.updateEntity({ partitionKey: identity.player.playerId, rowKey: `play:${play.playId}`, startedAt: "2090-01-04T01:00:00Z" }, "Merge");
      await applyPlayAction({ playerId: identity.player.playerId, playId: play.playId, puzzleId: fresh.id, pool: "daily", operationId: "solved", kind: "guess", correct: true }, () => new Date("2090-01-04T02:00:00Z"));
    }
    const now = new Date("2090-01-04T12:00:00Z");
    const firstPage = await rankingsPage(undefined, now);
    const secondPage = await rankingsPage(firstPage.nextCursor, now);
    assert.equal(firstPage.rows.length, 25); assert.equal(secondPage.rows.length, 2);
    assert.ok([...firstPage.rows, ...secondPage.rows].every((r) => r.rank === 1));
    assert.equal(new Set([...firstPage.rows, ...secondPage.rows].map((r) => r.displayName)).size, 27);
    await setPublicStats(players[0].player.playerId, false);
    await assert.rejects(() => rankingsPage(firstPage.nextCursor, now), (e) => e.status === 409);
    assert.equal((await rankingsPage(undefined, now)).total, 26);
    await assert.rejects(() => rankingsPage("not-a-cursor", now), (e) => e.status === 400);
    const original = TableClient.prototype.listEntities;
    TableClient.prototype.listEntities = function (options) {
      if (this.tableName === "PuzzlePlays") throw new Error("Simulated storage outage during refresh");
      return original.call(this, options);
    };
    try {
      const stale = await rankingsPage(undefined, new Date("2090-01-04T12:06:00Z"));
      assert.equal(stale.asOf, firstPage.asOf); assert.equal(stale.total, 26);
    } finally { TableClient.prototype.listEntities = original; }
  });
});
