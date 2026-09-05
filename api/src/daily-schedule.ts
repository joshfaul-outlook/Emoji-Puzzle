import { createHash } from "node:crypto";
import { TableTransaction, type TableEntity } from "@azure/data-tables";
import { listPlays, listPuzzles, puzzleTable, PlayConflictError } from "./storage.js";
import type { StoredPuzzle } from "./model.js";

export type DailyAssignment = {
  dailyDate: string; puzzleId: string | null; revision: string | null;
  void: boolean; reason?: string; puzzle: StoredPuzzle | null;
};
type AssignmentEntity = TableEntity & { assignmentJson: string };
type InitializationEntity = TableEntity & { launchDate: string; scheduleVersion?: number };
const partitionKey = "DailySchedule";
const scheduleVersion = 2;
export const utcDate = (now: Date) => now.toISOString().slice(0, 10);
export function puzzleRevision(puzzle: StoredPuzzle) {
  return createHash("sha256").update(JSON.stringify([puzzle.id, puzzle.emoji, puzzle.answer, puzzle.acceptedAnswers, puzzle.category, puzzle.hints, puzzle.explanation])).digest("hex");
}
async function optionalEntity<T extends TableEntity>(rowKey: string) {
  try { return await puzzleTable().getEntity<T>(partitionKey, rowKey); }
  catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
}
export async function getDailyAssignment(date: string): Promise<DailyAssignment | null> {
  const row = await optionalEntity<AssignmentEntity>(`date:${date}`);
  return row ? JSON.parse(row.assignmentJson) as DailyAssignment : null;
}
export async function listDailyAssignments() {
  const rows: DailyAssignment[] = [];
  for await (const row of puzzleTable().listEntities<AssignmentEntity>({ queryOptions: {
    filter: `PartitionKey eq '${partitionKey}' and RowKey ge 'date:' and RowKey lt 'date;'`,
  } })) rows.push(JSON.parse(row.assignmentJson) as DailyAssignment);
  return rows.sort((a, b) => a.dailyDate.localeCompare(b.dailyDate));
}

// All reservations and date rows use one partition, so issuing a date and
// consuming its puzzle is one atomic transaction across concurrent hosts.
async function migrateFailedInitialActivation(initialized: InitializationEntity) {
  const assignments = await listDailyAssignments();
  const isFailedInitialActivation = assignments.length === 1 && assignments[0].dailyDate === initialized.launchDate && assignments[0].void && assignments[0].reason === "inventory-exhausted";
  if (!isFailedInitialActivation) throw new Error("Daily schedule requires an explicit data migration");
  const rows: string[] = [];
  for await (const row of puzzleTable().listEntities({ queryOptions: { filter: `PartitionKey eq '${partitionKey}'` } })) {
    if (row.rowKey && row.rowKey !== "initialized") rows.push(row.rowKey);
  }
  for (let i = 0; i < rows.length; i += 100) {
    const transaction = new TableTransaction();
    for (const rowKey of rows.slice(i, i + 100)) transaction.deleteEntity(partitionKey, rowKey);
    try { await puzzleTable().submitTransaction(transaction.actions); }
    catch (error) { if ((error as { statusCode?: number }).statusCode !== 404) throw error; }
  }
  await puzzleTable().deleteEntity(partitionKey, "initialized").catch((error) => {
    if ((error as { statusCode?: number }).statusCode !== 404) throw error;
  });
}

async function initializeSchedule(launch: string) {
  const initialized = await optionalEntity<InitializationEntity>("initialized");
  if (initialized?.scheduleVersion === scheduleVersion) return initialized.launchDate;
  // The first deployment used a conservative retirement rule and could only
  // persist an exhausted void. Upgrade that failed, playless activation once.
  if (initialized) await migrateFailedInitialActivation(initialized);
  const [catalog, plays] = await Promise.all([listPuzzles(), listPlays()]);
  const known = new Set(plays.filter((p) => p.context === "practice" || p.context === "challenge").map((p) => p.puzzleId));
  // Predeployment Daily plays remain private, unranked history. The deployment
  // epoch starts the authoritative nonrepeating schedule. Practice exposure is
  // still permanent and prevents relabeling a Practice puzzle as ranked Daily.
  for (const p of catalog) {
    if (p.pool === "practice" && p.status === "published") known.add(p.id);
  }
  for (const id of known) {
    await puzzleTable().createEntity({ partitionKey, rowKey: `puzzle:${id}`, dailyDate: "prelaunch" }).catch((error) => {
      if ((error as { statusCode?: number }).statusCode !== 409) throw error;
    });
  }
  await puzzleTable().createEntity({ partitionKey, rowKey: "initialized", launchDate: launch, scheduleVersion }).catch((error) => {
    if ((error as { statusCode?: number }).statusCode !== 409) throw error;
  });
  const final = await optionalEntity<InitializationEntity>("initialized");
  if (!final) throw new Error("Daily schedule initialization was not persisted");
  return final.launchDate;
}

export async function getRankingsLaunchDate() {
  return (await optionalEntity<TableEntity & { launchDate: string }>("initialized"))?.launchDate ?? null;
}

export async function ensureDailyAssignment(now = new Date()): Promise<DailyAssignment> {
  const date = utcDate(now);
  await initializeSchedule(date);
  const existing = await getDailyAssignment(date);
  if (existing) return existing;
  const catalog = await listPuzzles({ status: "published", pool: "daily" });
  for (const puzzle of catalog) {
    if (await optionalEntity(`puzzle:${puzzle.id}`)) continue;
    const assignment: DailyAssignment = { dailyDate: date, puzzleId: puzzle.id, revision: puzzleRevision(puzzle), void: false, puzzle };
    const serialized = JSON.stringify(assignment);
    if (Buffer.byteLength(serialized, "utf16le") > 60_000) throw new Error("Daily puzzle exceeds snapshot storage limit");
    const transaction = new TableTransaction();
    transaction.createEntity({ partitionKey, rowKey: `date:${date}`, assignmentJson: serialized });
    transaction.createEntity({ partitionKey, rowKey: `puzzle:${puzzle.id}`, dailyDate: date });
    try { await puzzleTable().submitTransaction(transaction.actions); return assignment; }
    catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 409) throw error;
      const raced = await getDailyAssignment(date); if (raced) return raced;
    }
  }
  const unavailable: DailyAssignment = { dailyDate: date, puzzleId: null, revision: null, void: true, reason: "inventory-exhausted", puzzle: null };
  await puzzleTable().createEntity({ partitionKey, rowKey: `date:${date}`, assignmentJson: JSON.stringify(unavailable) }).catch((error) => {
    if ((error as { statusCode?: number }).statusCode !== 409) throw error;
  });
  console.warn(`Daily inventory exhausted for ${date}; publish fresh Daily content for upcoming dates`);
  return (await getDailyAssignment(date)) ?? unavailable;
}

export async function voidDailyAssignment(date: string) {
  const row = await optionalEntity<AssignmentEntity>(`date:${date}`);
  if (!row) return false;
  const assignment = JSON.parse(row.assignmentJson) as DailyAssignment;
  await puzzleTable().updateEntity({ partitionKey, rowKey: row.rowKey, assignmentJson: JSON.stringify({ ...assignment, void: true, reason: "operator-void" }) }, "Merge", { etag: row.etag });
  return true;
}

export async function recordPublicExposure(puzzleId: string) {
  try { await puzzleTable().createEntity({ partitionKey, rowKey: `puzzle:${puzzleId}`, dailyDate: "public-exposure" }); }
  catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 409) throw error;
    const used = await optionalEntity<TableEntity & { dailyDate: string }>(`puzzle:${puzzleId}`);
    if (used?.dailyDate !== "public-exposure" && used?.dailyDate !== "prelaunch") throw new PlayConflictError("An assigned Daily puzzle cannot be opened as Practice");
  }
}

export async function currentDaily(now = new Date()) {
  const assignment = await ensureDailyAssignment(now);
  return { puzzle: assignment.void ? null : assignment.puzzle, assignment };
}
