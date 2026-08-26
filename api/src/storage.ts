import { randomUUID } from "node:crypto";
import { TableClient, TableTransaction, type TableEntity } from "@azure/data-tables";
import type { PuzzlePool, PuzzleStatus, PuzzleStructure, StoredPuzzle } from "./model.js";

const puzzleTableName = "PuzzleCatalog";
const feedbackTableName = "PuzzleFeedback";

function connectionString() {
  const value = process.env.TABLE_STORAGE_CONNECTION_STRING;
  if (!value) throw new Error("TABLE_STORAGE_CONNECTION_STRING is not configured");
  return value;
}

export function puzzleTable() { return TableClient.fromConnectionString(connectionString(), puzzleTableName); }
export function feedbackTable() { return TableClient.fromConnectionString(connectionString(), feedbackTableName); }

type PuzzleEntity = TableEntity & {
  number: number; pool: string; position: number; status: string; emoji: string; answer: string;
  acceptedAnswersJson: string; category: string; structure: string; hintsJson: string; explanation: string;
  createdAt: string; updatedAt: string;
};

export function fromPuzzleEntity(entity: PuzzleEntity): StoredPuzzle {
  return { id: entity.rowKey, number: entity.number, pool: entity.pool as PuzzlePool, position: entity.position, status: entity.status as PuzzleStatus, emoji: entity.emoji, answer: entity.answer, acceptedAnswers: JSON.parse(entity.acceptedAnswersJson) as string[], category: entity.category, structure: entity.structure as PuzzleStructure, hints: JSON.parse(entity.hintsJson) as string[], explanation: entity.explanation, createdAt: entity.createdAt, updatedAt: entity.updatedAt, etag: String(entity.etag ?? "") };
}

export function toPuzzleEntity(puzzle: Omit<StoredPuzzle, "etag">): PuzzleEntity {
  return { partitionKey: "Puzzle", rowKey: puzzle.id, number: puzzle.number, pool: puzzle.pool, position: puzzle.position, status: puzzle.status, emoji: puzzle.emoji, answer: puzzle.answer, acceptedAnswersJson: JSON.stringify(puzzle.acceptedAnswers), category: puzzle.category, structure: puzzle.structure, hintsJson: JSON.stringify(puzzle.hints), explanation: puzzle.explanation, createdAt: puzzle.createdAt, updatedAt: puzzle.updatedAt };
}

export async function listPuzzles(options: { status?: PuzzleStatus; pool?: PuzzlePool } = {}) {
  const client = puzzleTable();
  const puzzles: StoredPuzzle[] = [];
  for await (const entity of client.listEntities<PuzzleEntity>({ queryOptions: { filter: `PartitionKey eq 'Puzzle'` } })) {
    const puzzle = fromPuzzleEntity(entity);
    if ((!options.status || puzzle.status === options.status) && (!options.pool || puzzle.pool === options.pool)) puzzles.push(puzzle);
  }
  return puzzles.sort((a, b) => a.number - b.number);
}

export async function getPuzzle(id: string) {
  try { return fromPuzzleEntity(await puzzleTable().getEntity<PuzzleEntity>("Puzzle", id)); }
  catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
}

async function reserveNumber() {
  const client = puzzleTable();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const metadata = await client.getEntity<TableEntity & { nextNumber: number }>("Metadata", "Catalog");
      const number = metadata.nextNumber;
      await client.updateEntity({ ...metadata, nextNumber: number + 1 }, "Replace", { etag: metadata.etag });
      return number;
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        try { await client.createEntity({ partitionKey: "Metadata", rowKey: "Catalog", nextNumber: 352, seedVersion: "catalog-v1" }); return 351; } catch { /* retry */ }
      } else if ((error as { statusCode?: number }).statusCode !== 412) throw error;
    }
  }
  throw new Error("Could not reserve a puzzle number");
}

export async function createPuzzle(input: Partial<StoredPuzzle>) {
  const now = new Date().toISOString();
  const pool = input.pool === "daily" ? "daily" : "practice";
  const siblings = await listPuzzles({ pool });
  const number = await reserveNumber();
  const idBase = (input.answer ?? "puzzle").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "puzzle";
  const puzzle: Omit<StoredPuzzle, "etag"> = { id: `${idBase}-${randomUUID().slice(0, 8)}`, number, pool, position: siblings.reduce((max, item) => Math.max(max, item.position), 0) + 1, status: input.status ?? "draft", emoji: input.emoji?.trim() ?? "", answer: input.answer?.trim() ?? "", acceptedAnswers: input.acceptedAnswers ?? [], category: input.category?.trim() ?? "", structure: input.structure ?? "literal", hints: (input.hints ?? ["", "", ""]).slice(0, 3), explanation: input.explanation?.trim() ?? "", createdAt: now, updatedAt: now };
  await puzzleTable().createEntity(toPuzzleEntity(puzzle));
  return getPuzzle(puzzle.id);
}

export async function updatePuzzle(existing: StoredPuzzle, input: Partial<StoredPuzzle>, etag: string) {
  const now = new Date().toISOString();
  const pool = input.pool ?? existing.pool;
  let position = input.position ?? existing.position;
  if (pool !== existing.pool) {
    const siblings = await listPuzzles({ pool });
    position = siblings.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  }
  const next: Omit<StoredPuzzle, "etag"> = { ...existing, ...input, id: existing.id, number: existing.number, pool, position, acceptedAnswers: input.acceptedAnswers ?? existing.acceptedAnswers, hints: (input.hints ?? existing.hints).slice(0, 3), createdAt: existing.createdAt, updatedAt: now };
  if (pool === "daily" && pool === existing.pool && Number.isInteger(input.position) && input.position !== existing.position) {
    const siblings = (await listPuzzles({ pool })).filter((puzzle) => puzzle.id !== existing.id).sort((a, b) => a.position - b.position);
    const target = Math.max(0, Math.min(siblings.length, (input.position as number) - 1));
    const ordered = [...siblings.slice(0, target), { ...next, etag }, ...siblings.slice(target)];
    if (ordered.length > 100) throw new Error("Daily reordering supports up to 100 records");
    const transaction = new TableTransaction();
    ordered.forEach((puzzle, index) => transaction.updateEntity(toPuzzleEntity({ ...puzzle, position: index + 1, updatedAt: puzzle.id === existing.id ? now : puzzle.updatedAt }), "Replace", { etag: puzzle.etag }));
    await puzzleTable().submitTransaction(transaction.actions);
    return getPuzzle(existing.id);
  }
  await puzzleTable().updateEntity(toPuzzleEntity(next), "Replace", { etag });
  return getPuzzle(existing.id);
}

export type FeedbackRecord = { puzzleId: string; puzzleNumber: number; puzzlePool: PuzzlePool; rating: "up" | "down"; comment: string | null; playId: string; anonymousSessionId: string; outcome: "solved" | "revealed"; guessCount: number; hintCount: number; metadataJson: string };

export async function insertFeedback(record: FeedbackRecord) {
  const createdAt = new Date().toISOString();
  const id = `${createdAt}-${randomUUID()}`;
  await feedbackTable().createEntity({ partitionKey: createdAt.slice(0, 7).replace("-", ""), rowKey: id, ...record, createdAt });
}

export async function listFeedback(limit = 250) {
  const items: Array<FeedbackRecord & { id: string; createdAt: string }> = [];
  for await (const entity of feedbackTable().listEntities<TableEntity & FeedbackRecord & { createdAt: string }>()) {
    items.push({ id: entity.rowKey, createdAt: entity.createdAt, puzzleId: entity.puzzleId, puzzleNumber: entity.puzzleNumber, puzzlePool: entity.puzzlePool, rating: entity.rating, comment: entity.comment, outcome: entity.outcome, guessCount: entity.guessCount, hintCount: entity.hintCount, playId: "", anonymousSessionId: "", metadataJson: "" });
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((item) => ({ id: item.id, createdAt: item.createdAt, puzzleId: item.puzzleId, puzzleNumber: item.puzzleNumber, puzzlePool: item.puzzlePool, rating: item.rating, comment: item.comment ?? null, outcome: item.outcome, guessCount: item.guessCount, hintCount: item.hintCount }));
}
