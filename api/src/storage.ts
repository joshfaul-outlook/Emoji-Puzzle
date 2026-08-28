import { randomUUID } from "node:crypto";
import { TableClient, TableTransaction, type TableEntity } from "@azure/data-tables";
import type { PuzzlePool, PuzzleStatus, PuzzleStructure, StoredPuzzle } from "./model.js";
import { deriveCatalogOrder, moveInCatalog, normalizeCatalogOrder, positionsForOrder, type CatalogOrder } from "./ordering.js";

const puzzleTableName = "PuzzleCatalog";
const feedbackTableName = "PuzzleFeedback";
const playerTableName = "PlayerDirectory";
const playTableName = "PuzzlePlays";
const orderRowKey = "__catalog_order__";

function connectionString() {
  const value = process.env.TABLE_STORAGE_CONNECTION_STRING;
  if (!value) throw new Error("TABLE_STORAGE_CONNECTION_STRING is not configured");
  return value;
}

export function puzzleTable() { return TableClient.fromConnectionString(connectionString(), puzzleTableName); }
export function feedbackTable() { return TableClient.fromConnectionString(connectionString(), feedbackTableName); }
export function playerTable() { return TableClient.fromConnectionString(connectionString(), playerTableName); }
export function playTable() { return TableClient.fromConnectionString(connectionString(), playTableName); }

type PuzzleEntity = TableEntity & {
  number: number; pool: string; position: number; status: string; emoji: string; answer: string;
  acceptedAnswersJson: string; category: string; structure: string; hintsJson: string; explanation: string;
  createdAt: string; updatedAt: string;
};

export function fromPuzzleEntity(entity: PuzzleEntity): StoredPuzzle {
  return { id: entity.rowKey, number: entity.number, pool: entity.pool as PuzzlePool, position: entity.position, status: entity.status as PuzzleStatus, emoji: entity.emoji, answer: entity.answer, acceptedAnswers: JSON.parse(entity.acceptedAnswersJson) as string[], category: entity.category, structure: entity.structure as PuzzleStructure, hints: JSON.parse(entity.hintsJson) as string[], explanation: entity.explanation, createdAt: entity.createdAt, updatedAt: entity.updatedAt, etag: String(entity.etag ?? "") };
}

type CatalogOrderEntity = TableEntity & { dailyIdsJson: string; practiceIdsJson: string; updatedAt: string };

async function rawPuzzles() {
  const client = puzzleTable(); const puzzles: StoredPuzzle[] = [];
  for await (const entity of client.listEntities<PuzzleEntity>({ queryOptions: { filter: `PartitionKey eq 'Puzzle' and RowKey ne '${orderRowKey}'` } })) puzzles.push(fromPuzzleEntity(entity));
  return puzzles;
}

async function getOrderEntity() {
  try { return await puzzleTable().getEntity<CatalogOrderEntity>("Puzzle", orderRowKey); }
  catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
}

function readOrder(entity: CatalogOrderEntity): CatalogOrder { return { daily: JSON.parse(entity.dailyIdsJson) as string[], practice: JSON.parse(entity.practiceIdsJson) as string[] }; }
function orderEntity(order: CatalogOrder, updatedAt: string): CatalogOrderEntity { return { partitionKey: "Puzzle", rowKey: orderRowKey, dailyIdsJson: JSON.stringify(order.daily), practiceIdsJson: JSON.stringify(order.practice), updatedAt }; }

async function orderSnapshot(puzzles: StoredPuzzle[], createIfMissing = false) {
  const existing = await getOrderEntity();
  if (existing) return { entity: existing, order: normalizeCatalogOrder(readOrder(existing), puzzles) };
  const order = deriveCatalogOrder(puzzles);
  if (createIfMissing) {
    try { await puzzleTable().createEntity(orderEntity(order, new Date().toISOString())); }
    catch (error) { if ((error as { statusCode?: number }).statusCode !== 409) throw error; }
    const entity = await getOrderEntity();
    if (entity) return { entity, order: normalizeCatalogOrder(readOrder(entity), puzzles) };
  }
  return { entity: null, order };
}

export function toPuzzleEntity(puzzle: Omit<StoredPuzzle, "etag">): PuzzleEntity {
  return { partitionKey: "Puzzle", rowKey: puzzle.id, number: puzzle.number, pool: puzzle.pool, position: puzzle.position, status: puzzle.status, emoji: puzzle.emoji, answer: puzzle.answer, acceptedAnswersJson: JSON.stringify(puzzle.acceptedAnswers), category: puzzle.category, structure: puzzle.structure, hintsJson: JSON.stringify(puzzle.hints), explanation: puzzle.explanation, createdAt: puzzle.createdAt, updatedAt: puzzle.updatedAt };
}

export async function listPuzzles(options: { status?: PuzzleStatus; pool?: PuzzlePool } = {}) {
  const puzzles = await rawPuzzles();
  const { order } = await orderSnapshot(puzzles);
  const positions = positionsForOrder(order);
  return puzzles.map((p) => ({ ...p, position: positions.get(p.id) ?? p.position })).filter((p) => (!options.status || p.status === options.status) && (!options.pool || p.pool === options.pool)).sort((a, b) => a.pool.localeCompare(b.pool) || a.position - b.position || a.number - b.number);
}

export async function getPuzzle(id: string) {
  try {
    const puzzle = fromPuzzleEntity(await puzzleTable().getEntity<PuzzleEntity>("Puzzle", id));
    const entity = await getOrderEntity();
    if (entity) { const position = positionsForOrder(readOrder(entity)).get(id); if (position) return { ...puzzle, position }; }
    return puzzle;
  }
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
  const siblings = await rawPuzzles();
  const number = await reserveNumber();
  const idBase = (input.answer ?? "puzzle").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "puzzle";
  const { entity, order } = await orderSnapshot(siblings, true);
  const puzzle: Omit<StoredPuzzle, "etag"> = { id: `${idBase}-${randomUUID().slice(0, 8)}`, number, pool, position: 0, status: input.status ?? "draft", emoji: input.emoji?.trim() ?? "", answer: input.answer?.trim() ?? "", acceptedAnswers: input.acceptedAnswers ?? [], category: input.category?.trim() ?? "", structure: input.structure ?? "literal", hints: (input.hints ?? ["", "", ""]).slice(0, 3), explanation: input.explanation?.trim() ?? "", createdAt: now, updatedAt: now };
  const nextOrder = moveInCatalog(order, puzzle.id, pool, input.position);
  puzzle.position = positionsForOrder(nextOrder).get(puzzle.id) ?? 1;
  if (entity) { const transaction = new TableTransaction(); transaction.createEntity(toPuzzleEntity(puzzle)); transaction.updateEntity(orderEntity(nextOrder, now), "Replace", { etag: entity.etag }); await puzzleTable().submitTransaction(transaction.actions); }
  else await puzzleTable().createEntity(toPuzzleEntity(puzzle));
  return getPuzzle(puzzle.id);
}

export async function updatePuzzle(existing: StoredPuzzle, input: Partial<StoredPuzzle>, etag: string) {
  const now = new Date().toISOString();
  const pool = input.pool ?? existing.pool;
  const puzzles = await rawPuzzles(); const snapshot = await orderSnapshot(puzzles, true);
  const nextOrder = (pool !== existing.pool || Number.isInteger(input.position)) ? moveInCatalog(snapshot.order, existing.id, pool, Number.isInteger(input.position) ? input.position : undefined) : snapshot.order;
  const positions = positionsForOrder(nextOrder);
  const next: Omit<StoredPuzzle, "etag"> = { ...existing, ...input, id: existing.id, number: existing.number, pool, position: positions.get(existing.id) ?? existing.position, acceptedAnswers: input.acceptedAnswers ?? existing.acceptedAnswers, hints: (input.hints ?? existing.hints).slice(0, 3), createdAt: existing.createdAt, updatedAt: now };
  if (snapshot.entity && JSON.stringify(nextOrder) !== JSON.stringify(snapshot.order)) { const transaction = new TableTransaction(); transaction.updateEntity(toPuzzleEntity(next), "Replace", { etag }); transaction.updateEntity(orderEntity(nextOrder, now), "Replace", { etag: snapshot.entity.etag }); await puzzleTable().submitTransaction(transaction.actions); }
  else await puzzleTable().updateEntity(toPuzzleEntity(next), "Replace", { etag });
  return getPuzzle(existing.id);
}

export type PlayerRecord = {
  playerId: string;
  displayName: string;
  normalizedDisplayName: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
};

type PlayerEntity = TableEntity & PlayerRecord;

export class NameUnavailableError extends Error {}
export class PlayConflictError extends Error {}

export async function playerNameAvailable(normalizedDisplayName: string) {
  try {
    await playerTable().getEntity("Players", `name:${normalizedDisplayName}`);
    return false;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return true;
    throw error;
  }
}

export async function createPlayer(input: { playerId: string; displayName: string; normalizedDisplayName: string; tokenHash: string }) {
  const now = new Date().toISOString();
  const record: PlayerRecord = { ...input, createdAt: now, lastSeenAt: now };
  const transaction = new TableTransaction();
  transaction.createEntity({ partitionKey: "Players", rowKey: `player:${input.playerId}`, ...record });
  transaction.createEntity({ partitionKey: "Players", rowKey: `name:${input.normalizedDisplayName}`, playerId: input.playerId, createdAt: now });
  try {
    await playerTable().submitTransaction(transaction.actions);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 409) throw new NameUnavailableError("Display name is unavailable");
    throw error;
  }
  return record;
}

export async function getPlayer(playerId: string) {
  try {
    const entity = await playerTable().getEntity<PlayerEntity>("Players", `player:${playerId}`);
    return { playerId: entity.playerId, displayName: entity.displayName, normalizedDisplayName: entity.normalizedDisplayName, tokenHash: entity.tokenHash, createdAt: entity.createdAt, lastSeenAt: entity.lastSeenAt } satisfies PlayerRecord;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}

export async function touchPlayer(player: PlayerRecord) {
  const lastSeenAt = new Date().toISOString();
  await playerTable().updateEntity({ partitionKey: "Players", rowKey: `player:${player.playerId}`, lastSeenAt }, "Merge", { etag: "*" });
  return { ...player, lastSeenAt };
}

export type PlayContext = "daily" | "practice" | "challenge" | "author-test";
export type PuzzlePlay = {
  playerId: string; playId: string; puzzleId: string; puzzleNumber: number; pool: PuzzlePool; context: PlayContext; rankingEligible: boolean;
  startedAt: string; lastActionAt: string; completedAt: string | null; guessCount: number; hintCount: number;
  outcome: "playing" | "solved" | "revealed"; createdAt: string; updatedAt: string;
};

type PlayEntity = TableEntity & PuzzlePlay;

function fromPlayEntity(entity: PlayEntity): PuzzlePlay {
  return { playerId: entity.playerId, playId: entity.playId, puzzleId: entity.puzzleId, puzzleNumber: entity.puzzleNumber, pool: entity.pool, context: entity.context, rankingEligible: entity.rankingEligible, startedAt: entity.startedAt, lastActionAt: entity.lastActionAt, completedAt: entity.completedAt ?? null, guessCount: entity.guessCount, hintCount: entity.hintCount, outcome: entity.outcome, createdAt: entity.createdAt, updatedAt: entity.updatedAt };
}

function playEntity(play: PuzzlePlay) { return { partitionKey: play.playerId, rowKey: `play:${play.playId}`, ...play }; }

export async function getPlay(playerId: string, playId: string) {
  try { return fromPlayEntity(await playTable().getEntity<PlayEntity>(playerId, `play:${playId}`)); }
  catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
}

export async function startPlay(input: Omit<PuzzlePlay, "startedAt" | "lastActionAt" | "completedAt" | "guessCount" | "hintCount" | "outcome" | "createdAt" | "updatedAt">) {
  const existing = await getPlay(input.playerId, input.playId);
  if (existing) {
    if (existing.puzzleId !== input.puzzleId || existing.pool !== input.pool || existing.context !== input.context) throw new PlayConflictError("Play ID belongs to another attempt");
    return { play: existing, created: false };
  }
  const now = new Date().toISOString();
  const play: PuzzlePlay = { ...input, startedAt: now, lastActionAt: now, completedAt: null, guessCount: 0, hintCount: 0, outcome: "playing", createdAt: now, updatedAt: now };
  try { await playTable().createEntity(playEntity(play)); return { play, created: true }; }
  catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 409) throw error;
    const raced = await getPlay(input.playerId, input.playId);
    if (!raced || raced.puzzleId !== input.puzzleId || raced.pool !== input.pool || raced.context !== input.context) throw new PlayConflictError("Play ID belongs to another attempt");
    return { play: raced, created: false };
  }
}

type PlayAction = { playerId: string; playId: string; puzzleId: string; pool: PuzzlePool; operationId: string; kind: "guess" | "hint" | "reveal"; correct?: boolean; hintIndex?: number };

export async function applyPlayAction(action: PlayAction) {
  const actionRowKey = `action:${action.playId}:${action.operationId}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await playTable().getEntity(action.playerId, actionRowKey);
      const repeated = await getPlay(action.playerId, action.playId);
      if (!repeated) throw new PlayConflictError("Play not found");
      return { play: repeated, repeated: true };
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) throw error;
    }
    const entity = await playTable().getEntity<PlayEntity>(action.playerId, `play:${action.playId}`).catch((error) => {
      if ((error as { statusCode?: number }).statusCode === 404) throw new PlayConflictError("Play not found");
      throw error;
    });
    if (entity.puzzleId !== action.puzzleId || entity.pool !== action.pool) throw new PlayConflictError("Play does not match puzzle");
    if (entity.outcome !== "playing") throw new PlayConflictError("Play is already complete");
    const now = new Date().toISOString();
    const next = fromPlayEntity(entity);
    next.lastActionAt = now; next.updatedAt = now;
    if (action.kind === "guess") {
      next.guessCount += 1;
      if (action.correct) { next.outcome = "solved"; next.completedAt = now; }
    } else if (action.kind === "hint") {
      if (action.hintIndex === undefined || action.hintIndex > next.hintCount) throw new PlayConflictError("Hints must be requested in order");
      next.hintCount = Math.max(next.hintCount, action.hintIndex + 1);
    } else { next.outcome = "revealed"; next.completedAt = now; }
    const transaction = new TableTransaction();
    transaction.updateEntity(playEntity(next), "Replace", { etag: entity.etag });
    transaction.createEntity({ partitionKey: action.playerId, rowKey: actionRowKey, playId: action.playId, kind: action.kind, createdAt: now });
    try { await playTable().submitTransaction(transaction.actions); return { play: next, repeated: false }; }
    catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 409) {
        const repeated = await getPlay(action.playerId, action.playId);
        if (!repeated) throw new PlayConflictError("Play not found");
        return { play: repeated, repeated: true };
      }
      if (status !== 412) throw error;
    }
  }
  throw new PlayConflictError("Play changed too many times");
}

export type FeedbackRecord = { puzzleId: string; puzzleNumber: number; puzzlePool: PuzzlePool; rating: "up" | "down"; comment: string | null; playId: string; anonymousSessionId: string; playerId?: string; displayName?: string; outcome: "solved" | "revealed"; guessCount: number; hintCount: number; metadataJson: string };

export async function insertFeedback(record: FeedbackRecord) {
  const createdAt = new Date().toISOString();
  const id = `${createdAt}-${randomUUID()}`;
  await feedbackTable().createEntity({ partitionKey: createdAt.slice(0, 7).replace("-", ""), rowKey: id, ...record, createdAt });
}

export async function listFeedback(limit = 250) {
  const items: Array<FeedbackRecord & { id: string; createdAt: string }> = [];
  for await (const entity of feedbackTable().listEntities<TableEntity & FeedbackRecord & { createdAt: string }>()) {
    items.push({ id: entity.rowKey, createdAt: entity.createdAt, puzzleId: entity.puzzleId, puzzleNumber: entity.puzzleNumber, puzzlePool: entity.puzzlePool, rating: entity.rating, comment: entity.comment, outcome: entity.outcome, guessCount: entity.guessCount, hintCount: entity.hintCount, playId: entity.playId ?? "", anonymousSessionId: "", playerId: entity.playerId, displayName: entity.displayName, metadataJson: "" });
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map((item) => ({ id: item.id, createdAt: item.createdAt, puzzleId: item.puzzleId, puzzleNumber: item.puzzleNumber, puzzlePool: item.puzzlePool, rating: item.rating, comment: item.comment ?? null, outcome: item.outcome, guessCount: item.guessCount, hintCount: item.hintCount, playerId: item.playerId ?? null, displayName: item.displayName ?? null, playId: item.playId }));
}
