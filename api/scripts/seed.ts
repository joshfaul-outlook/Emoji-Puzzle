import { TableClient } from "@azure/data-tables";
import { ALL_PUZZLES, DAILY_PUZZLES, PRACTICE_PUZZLES } from "../../lib/puzzles.ts";

const connectionString = process.env.TABLE_STORAGE_CONNECTION_STRING;
if (!connectionString) throw new Error("TABLE_STORAGE_CONNECTION_STRING is required");

const client = TableClient.fromConnectionString(connectionString, "PuzzleCatalog");
await client.createTable().catch((error: { statusCode?: number }) => { if (error.statusCode !== 409) throw error; });

let seeded = false;
try {
  const metadata = await client.getEntity<{ seedVersion: string }>("Metadata", "Catalog");
  seeded = metadata.seedVersion === "catalog-v1";
} catch (error) {
  if ((error as { statusCode?: number }).statusCode !== 404) throw error;
}

if (!seeded) {
  const now = new Date().toISOString();
  const dailyPositions = new Map(DAILY_PUZZLES.map((puzzle, index) => [puzzle.id, index + 1]));
  const practicePositions = new Map(PRACTICE_PUZZLES.map((puzzle, index) => [puzzle.id, index + 1]));
  for (const puzzle of ALL_PUZZLES) {
    const pool = dailyPositions.has(puzzle.id) ? "daily" : "practice";
    await client.upsertEntity({
      partitionKey: "Puzzle", rowKey: puzzle.id, number: puzzle.number, pool,
      position: pool === "daily" ? dailyPositions.get(puzzle.id)! : practicePositions.get(puzzle.id)!,
      status: "published", emoji: puzzle.emoji, answer: puzzle.answer,
      acceptedAnswersJson: JSON.stringify(Array.from(new Set([puzzle.answer, ...puzzle.acceptedAnswers]))),
      category: puzzle.category, structure: puzzle.structure, hintsJson: JSON.stringify(puzzle.hints),
      explanation: puzzle.explanation, createdAt: now, updatedAt: now,
    }, "Replace");
  }
  await client.upsertEntity({ partitionKey: "Metadata", rowKey: "Catalog", nextNumber: 351, seedVersion: "catalog-v1", seededAt: now }, "Replace");
}

const feedback = TableClient.fromConnectionString(connectionString, "PuzzleFeedback");
await feedback.createTable().catch((error: { statusCode?: number }) => { if (error.statusCode !== 409) throw error; });
for (const tableName of ["PlayerDirectory", "PuzzlePlays", "PlayerVerifications"]) {
  const table = TableClient.fromConnectionString(connectionString, tableName);
  await table.createTable().catch((error: { statusCode?: number }) => { if (error.statusCode !== 409) throw error; });
}
console.log(seeded ? "Catalog already seeded." : `Seeded ${ALL_PUZZLES.length} puzzles.`);
