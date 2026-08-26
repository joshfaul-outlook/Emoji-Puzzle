import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { TableClient } from "@azure/data-tables";

const [, , inputPath] = process.argv;
const connectionString = process.env.TABLE_STORAGE_CONNECTION_STRING;
if (!inputPath || !connectionString) throw new Error("Usage: TABLE_STORAGE_CONNECTION_STRING=... npm run import:feedback -- export.json");
const parsed = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
const rows = Array.isArray(parsed) ? parsed : (parsed as { results?: unknown[] }).results;
if (!Array.isArray(rows)) throw new Error("Expected an array or a D1 export object with a results array");
const client = TableClient.fromConnectionString(connectionString, "PuzzleFeedback");
await client.createTable().catch((error: { statusCode?: number }) => { if (error.statusCode !== 409) throw error; });

let imported = 0;
for (const raw of rows) {
  const row = raw as Record<string, unknown>;
  const rawCreatedAt = String(row.created_at ?? row.createdAt);
  const createdAt = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(rawCreatedAt) ? rawCreatedAt : `${rawCreatedAt.replace(" ", "T")}Z`).toISOString();
  const stable = createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 32);
  await client.upsertEntity({
    partitionKey: createdAt.slice(0, 7).replace("-", ""), rowKey: `${createdAt}-${stable}`,
    puzzleId: String(row.puzzle_id ?? row.puzzleId), puzzleNumber: Number(row.puzzle_number ?? row.puzzleNumber),
    puzzlePool: String(row.puzzle_pool ?? row.puzzlePool ?? "daily"), rating: String(row.rating),
    comment: row.comment == null ? null : String(row.comment), createdAt,
    playId: String(row.play_id ?? row.playId ?? ""), anonymousSessionId: String(row.anonymous_session_id ?? row.anonymousSessionId ?? ""),
    outcome: String(row.outcome), guessCount: Number(row.guess_count ?? row.guessCount ?? 0),
    hintCount: Number(row.hint_count ?? row.hintCount ?? 0), metadataJson: String(row.metadata_json ?? row.metadataJson ?? "{}"),
    importedFrom: "d1-read-only-export",
  }, "Replace");
  imported += 1;
}
console.log(`Imported ${imported} feedback records idempotently.`);
