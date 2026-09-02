import { TableClient } from "@azure/data-tables";

const confirmation = process.argv[2];
if (confirmation !== "--confirm-reset-player-data") {
  throw new Error("Usage: TABLE_STORAGE_CONNECTION_STRING=... npm run reset:player-data -- --confirm-reset-player-data");
}
function requiredConnectionString() {
  const value = process.env.TABLE_STORAGE_CONNECTION_STRING;
  if (!value) throw new Error("TABLE_STORAGE_CONNECTION_STRING is required");
  return value;
}
const connectionString = requiredConnectionString();

const tables = ["PuzzleFeedback", "PlayerDirectory", "PuzzlePlays", "PlayerVerifications"];
for (const table of tables) {
  const client = TableClient.fromConnectionString(connectionString, table);
  let deleted = 0;
  for await (const entity of client.listEntities()) {
    if (typeof entity.partitionKey !== "string" || typeof entity.rowKey !== "string") throw new Error(`Malformed row in ${table}`);
    await client.deleteEntity(entity.partitionKey, entity.rowKey);
    deleted += 1;
  }
  console.log(`Reset ${table}: deleted ${deleted} rows`);
}

console.log("Player and feedback data reset complete. PuzzleCatalog was not modified.");
