import { TableClient } from "@azure/data-tables";
import { pathToFileURL } from "node:url";

type EntityKey = { partitionKey: string; rowKey: string };
type ResetTarget = { tableName: "PuzzlePlays" | "PuzzleFeedback" | "PuzzleCatalog"; entity: EntityKey };
type HistoryTableClient = {
  listEntities(): AsyncIterable<{ partitionKey?: string; rowKey?: string }>;
  deleteEntity(partitionKey: string, rowKey: string): Promise<unknown>;
};

const applyFlag = "--confirm-reset-game-history";

export function isGameHistoryTarget(tableName: string, partitionKey: string) {
  if (tableName === "PuzzlePlays" || tableName === "PuzzleFeedback") return true;
  return tableName === "PuzzleCatalog" && (
    partitionKey === "DailySchedule" ||
    partitionKey === "Rankings" ||
    partitionKey.startsWith("RankingSnapshot:")
  );
}

async function targets(client: HistoryTableClient, tableName: ResetTarget["tableName"]) {
  const rows: ResetTarget[] = [];
  for await (const entity of client.listEntities()) {
    if (typeof entity.partitionKey !== "string" || typeof entity.rowKey !== "string") {
      throw new Error(`Malformed row in ${tableName}`);
    }
    if (isGameHistoryTarget(tableName, entity.partitionKey)) {
      rows.push({ tableName, entity: { partitionKey: entity.partitionKey, rowKey: entity.rowKey } });
    }
  }
  return rows;
}

export async function resetGameHistory(
  connectionString: string,
  apply: boolean,
  clientFactory: (tableName: ResetTarget["tableName"]) => HistoryTableClient = (tableName) => TableClient.fromConnectionString(connectionString, tableName),
) {
  const tableNames: ResetTarget["tableName"][] = ["PuzzlePlays", "PuzzleFeedback", "PuzzleCatalog"];
  const selected = new Map<ResetTarget["tableName"], ResetTarget[]>();
  for (const tableName of tableNames) {
    const client = clientFactory(tableName);
    selected.set(tableName, await targets(client, tableName));
  }

  for (const tableName of tableNames) {
    const rows = selected.get(tableName) ?? [];
    console.log(`${apply ? "Reset" : "Would reset"} ${tableName}: ${rows.length} rows`);
    if (!apply) continue;
    const client = clientFactory(tableName);
    for (const { entity } of rows) {
      await client.deleteEntity(entity.partitionKey, entity.rowKey).catch((error: { statusCode?: number }) => {
        if (error.statusCode !== 404) throw error;
      });
    }
  }

  console.log(apply
    ? "Game history reset complete. Player identities and puzzle catalog records were preserved."
    : `Dry run only. Re-run with ${applyFlag} to apply.`);
  return Object.fromEntries(tableNames.map((name) => [name, selected.get(name)?.length ?? 0]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = process.argv[2];
  if (argument !== undefined && argument !== "--dry-run" && argument !== applyFlag) {
    throw new Error(`Usage: TABLE_STORAGE_CONNECTION_STRING=... npm run reset:game-history -- [--dry-run|${applyFlag}]`);
  }
  const connectionString = process.env.TABLE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("TABLE_STORAGE_CONNECTION_STRING is required");
  await resetGameHistory(connectionString, argument === applyFlag);
}
