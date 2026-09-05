import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { TableClient } from "@azure/data-tables";
import { isGameHistoryTarget, resetGameHistory } from "../dist/scripts/reset-game-history.js";

test("game-history reset selects plays, feedback, schedules and ranking snapshots", () => {
  assert.equal(isGameHistoryTarget("PuzzlePlays", "player-id"), true);
  assert.equal(isGameHistoryTarget("PuzzleFeedback", "2026-09"), true);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "DailySchedule"), true);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "Rankings"), true);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "RankingSnapshot:snapshot-id"), true);
});

test("game-history reset preserves players, verification and authored catalog data", () => {
  assert.equal(isGameHistoryTarget("PlayerDirectory", "Players"), false);
  assert.equal(isGameHistoryTarget("PlayerVerifications", "Challenges"), false);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "Puzzle"), false);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "Metadata"), false);
  assert.equal(isGameHistoryTarget("PuzzleCatalog", "RankingSnapshot"), false);
  assert.equal(isGameHistoryTarget("Unrelated", "DailySchedule"), false);
});

test("game-history reset dry run is inert and apply deletes only selected rows", async () => {
  const rows = {
    PuzzlePlays: [{ partitionKey: "player", rowKey: "play:one" }, { partitionKey: "player", rowKey: "action:one" }],
    PuzzleFeedback: [{ partitionKey: "feedback", rowKey: "one" }],
    PuzzleCatalog: [
      { partitionKey: "Puzzle", rowKey: "daily-one" },
      { partitionKey: "Metadata", rowKey: "Catalog" },
      { partitionKey: "DailySchedule", rowKey: "initialized" },
      { partitionKey: "Rankings", rowKey: "current" },
      { partitionKey: "RankingSnapshot:snapshot", rowKey: "00000" },
    ],
  };
  const deleted = [];
  const factory = (tableName) => ({
    async *listEntities() { yield* rows[tableName]; },
    async deleteEntity(partitionKey, rowKey) { deleted.push([tableName, partitionKey, rowKey]); },
  });

  assert.deepEqual(await resetGameHistory("unused", false, factory), { PuzzlePlays: 2, PuzzleFeedback: 1, PuzzleCatalog: 3 });
  assert.deepEqual(deleted, []);
  assert.deepEqual(await resetGameHistory("unused", true, factory), { PuzzlePlays: 2, PuzzleFeedback: 1, PuzzleCatalog: 3 });
  assert.deepEqual(deleted, [
    ["PuzzlePlays", "player", "play:one"],
    ["PuzzlePlays", "player", "action:one"],
    ["PuzzleFeedback", "feedback", "one"],
    ["PuzzleCatalog", "DailySchedule", "initialized"],
    ["PuzzleCatalog", "Rankings", "current"],
    ["PuzzleCatalog", "RankingSnapshot:snapshot", "00000"],
  ]);
});

test("game-history reset removes stored history while preserving identities and catalog", async () => {
  const connection = process.env.TABLE_STORAGE_CONNECTION_STRING;
  assert.equal(connection, "UseDevelopmentStorage=true", "integration reset requires disposable local storage");
  const names = ["PuzzlePlays", "PuzzleFeedback", "PuzzleCatalog", "PlayerDirectory", "PlayerVerifications"];
  const clients = Object.fromEntries(names.map((name) => [name, TableClient.fromConnectionString(connection, name)]));
  await Promise.all(Object.values(clients).map((client) => client.createTable().catch((error) => { if (error.statusCode !== 409) throw error; })));
  const key = randomUUID();
  await Promise.all([
    clients.PuzzlePlays.createEntity({ partitionKey: key, rowKey: "play:one" }),
    clients.PuzzleFeedback.createEntity({ partitionKey: key, rowKey: "feedback:one" }),
    clients.PuzzleCatalog.createEntity({ partitionKey: "DailySchedule", rowKey: `test:${key}` }),
    clients.PuzzleCatalog.createEntity({ partitionKey: "Rankings", rowKey: `test:${key}` }),
    clients.PuzzleCatalog.createEntity({ partitionKey: `RankingSnapshot:${key}`, rowKey: "00000" }),
    clients.PuzzleCatalog.createEntity({ partitionKey: "Puzzle", rowKey: `puzzle:${key}` }),
    clients.PlayerDirectory.createEntity({ partitionKey: "Players", rowKey: `player:${key}` }),
    clients.PlayerVerifications.createEntity({ partitionKey: "Challenges", rowKey: `challenge:${key}` }),
  ]);

  await resetGameHistory(connection, true);
  for (const [client, partitionKey, rowKey] of [
    [clients.PuzzlePlays, key, "play:one"],
    [clients.PuzzleFeedback, key, "feedback:one"],
    [clients.PuzzleCatalog, "DailySchedule", `test:${key}`],
    [clients.PuzzleCatalog, "Rankings", `test:${key}`],
    [clients.PuzzleCatalog, `RankingSnapshot:${key}`, "00000"],
  ]) {
    await assert.rejects(() => client.getEntity(partitionKey, rowKey), (error) => error.statusCode === 404);
  }
  assert.equal((await clients.PuzzleCatalog.getEntity("Puzzle", `puzzle:${key}`)).rowKey, `puzzle:${key}`);
  assert.equal((await clients.PlayerDirectory.getEntity("Players", `player:${key}`)).rowKey, `player:${key}`);
  assert.equal((await clients.PlayerVerifications.getEntity("Challenges", `challenge:${key}`)).rowKey, `challenge:${key}`);
});
