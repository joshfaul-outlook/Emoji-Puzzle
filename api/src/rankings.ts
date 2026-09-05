import { createHash, randomUUID } from "node:crypto";
import type { TableEntity } from "@azure/data-tables";
import { ensureDailyAssignment, getRankingsLaunchDate, listDailyAssignments } from "./daily-schedule.js";
import { assignRanks, buildRankings, dailyStreaks, rankingWindow, summarizePlays, type RankingRow } from "./ranking-math.js";
import { listPlays, listRankingPlayers, puzzleTable, type PlayerRecord } from "./storage.js";

type Snapshot = { id: string; asOf: string; launchDate: string; from: string; through: string; chunks: number; ruleVersion: number; assignmentsVersion: string };
type Meta = TableEntity & { snapshotJson: string };
const refreshMs = 5 * 60_000;
export class RankingsError extends Error { constructor(message: string, public status = 503) { super(message); } }
async function metadata() {
  try { return await puzzleTable().getEntity<Meta>("Rankings", "current"); }
  catch (error) { if ((error as { statusCode?: number }).statusCode === 404) return null; throw error; }
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("base64url");

// Managed Static Web Apps supports HTTP triggers only. A persisted lease makes
// this an awaited, on-demand refresh, with no detached/background promises.
export async function rankingSnapshot(now = new Date()) {
  await ensureDailyAssignment(now);
  const launch = await getRankingsLaunchDate();
  if (!launch) throw new RankingsError("Daily rankings could not initialize.");
  const assignments = await listDailyAssignments();
  const assignmentsVersion = digest(assignments.map(({ dailyDate, puzzleId, revision, void: isVoid }) => [dailyDate, puzzleId, revision, isVoid]));
  const previousMeta = await metadata();
  const previous: Snapshot | null = previousMeta ? JSON.parse(previousMeta.snapshotJson) as Snapshot : null;
  if (previous && previous.assignmentsVersion === assignmentsVersion && previous.launchDate === launch && now.getTime() - Date.parse(previous.asOf) < refreshMs) return previous;
  const client = puzzleTable();
  let lease: TableEntity & { expiresAt: number };
  try {
    const old = await client.getEntity<TableEntity & { expiresAt: number }>("Rankings", "lease").catch((error) => {
      if ((error as { statusCode?: number }).statusCode === 404) return null; throw error;
    });
    if (old && old.expiresAt > now.getTime()) {
      if (previous && previous.assignmentsVersion === assignmentsVersion) return previous;
      throw new RankingsError("Rankings are updating. Please try again shortly.");
    }
    const lock = { partitionKey: "Rankings", rowKey: "lease", expiresAt: now.getTime() + refreshMs, owner: randomUUID() };
    if (old) await client.updateEntity(lock, "Replace", { etag: old.etag });
    else await client.createEntity(lock);
    lease = await client.getEntity<TableEntity & { expiresAt: number }>("Rankings", "lease");
    if (lease.owner !== lock.owner) throw new RankingsError("Rankings are updating.");
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if ((status === 409 || status === 412) && previous && previous.assignmentsVersion === assignmentsVersion) return previous;
    if (status === 409 || status === 412) throw new RankingsError("Rankings are updating. Please try again shortly.");
    throw error;
  }
  try {
    const [plays, players] = await Promise.all([listPlays(), listRankingPlayers()]);
    // Include opted-out players internally so a preference change can be applied
    // immediately at read time without rebuilding or exposing their private rows.
    const rows = buildRankings(plays, assignments, players.map((p) => ({ ...p, publicStats: true })), launch, now);
    if (rows.length > 10_000) throw new Error("Rankings exceed the v1 snapshot bound");
    const id = randomUUID(); const chunks = Math.ceil(rows.length / 100);
    for (let i = 0; i < chunks; i++) {
      await client.createEntity({ partitionKey: `RankingSnapshot:${id}`, rowKey: String(i).padStart(5, "0"), rowsJson: JSON.stringify(rows.slice(i * 100, (i + 1) * 100)) });
    }
    const snapshot: Snapshot = { id, asOf: now.toISOString(), launchDate: launch, ...rankingWindow(launch, now), chunks, ruleVersion: 1, assignmentsVersion };
    // Publish only while still owning the lease; older workers cannot replace a
    // newer complete snapshot after a long scan or process suspension.
    await client.submitTransaction([
      ["update", { partitionKey: "Rankings", rowKey: "lease", expiresAt: now.getTime() + refreshMs }, "Replace", { etag: String(lease.etag) }],
      ["upsert", { partitionKey: "Rankings", rowKey: "current", snapshotJson: JSON.stringify(snapshot) }, "Replace"],
    ]);
    if (previous) {
      // Old cursors already require a restart once the current snapshot changes.
      for (let i = 0; i < previous.chunks; i++) await client.deleteEntity(`RankingSnapshot:${previous.id}`, String(i).padStart(5, "0")).catch(() => undefined);
    }
    return snapshot;
  } catch (error) {
    console.error("Ranking snapshot refresh failed", error instanceof Error ? error.message : "Unknown error");
    if (previous && previous.assignmentsVersion === assignmentsVersion && previous.launchDate === launch) return previous;
    throw new RankingsError("Rankings are temporarily unavailable. Your play is saved.");
  }
}

export async function visibleRankings(now = new Date()) {
  const snapshot = await rankingSnapshot(now);
  const [players, chunks] = await Promise.all([
    listRankingPlayers(),
    Promise.all(Array.from({ length: snapshot.chunks }, (_, i) => puzzleTable().getEntity<TableEntity & { rowsJson: string }>(`RankingSnapshot:${snapshot.id}`, String(i).padStart(5, "0")))),
  ]);
  const visible = new Map(players.filter((p) => p.publicStats).map((p) => [p.playerId, p.displayName]));
  const rows = assignRanks(chunks.flatMap((r) => JSON.parse(r.rowsJson) as RankingRow[]).filter((r) => visible.has(r.playerId)).map((r) => ({ ...r, displayName: visible.get(r.playerId)! })));
  return { snapshot, rows, version: digest([snapshot.id, rows.map((r) => [r.playerId, r.displayName])]) };
}
export function publicRankingRow(row: RankingRow) {
  return { rank: row.rank, displayName: row.displayName, solves: row.solves, unaidedSolves: row.unaidedSolves, currentStreak: row.currentStreak };
}

export type PlayerGlance = {
  daily: {
    currentStreak: number;
    currentPublicRank: number | null;
    rankingsStatus: "ready" | "unavailable";
    rankingsAsOf: string | null;
  };
  practice: { solved: number; solveRate: number | null };
  publicStats: boolean;
};

// This intentionally uses the same aggregation and visibility paths as the
// detailed view, but does not return its history, rankings rows, or challenges.
export async function playerGlance(player: PlayerRecord, now = new Date()): Promise<PlayerGlance> {
  await ensureDailyAssignment(now);
  const launch = await getRankingsLaunchDate();
  const [plays, assignments] = await Promise.all([listPlays(player.playerId), listDailyAssignments()]);
  const practice = summarizePlays(plays.filter((p) => p.context === "practice" && p.pool === "practice"));
  let currentPublicRank: number | null = null;
  let rankingsAsOf: string | null = null;
  let rankingsStatus: "ready" | "unavailable" = launch ? "ready" : "unavailable";
  if (launch && player.publicStats) {
    try {
      const visible = await visibleRankings(now);
      rankingsAsOf = visible.snapshot.asOf;
      currentPublicRank = visible.rows.find((row) => row.playerId === player.playerId)?.rank ?? null;
    } catch {
      rankingsStatus = "unavailable";
    }
  }
  return {
    daily: {
      currentStreak: launch ? dailyStreaks(plays, assignments, launch, now).current : 0,
      currentPublicRank,
      rankingsStatus,
      rankingsAsOf,
    },
    practice: { solved: practice.solved, solveRate: practice.solveRate },
    publicStats: player.publicStats,
  };
}

export async function rankingsPage(cursor?: string, now = new Date()) {
  const { snapshot, rows, version } = await visibleRankings(now);
  let offset = 0;
  if (cursor) {
    try {
      if (cursor.length > 512) throw new Error();
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString()) as { version: string; offset: number };
      if (parsed.version !== version) throw new RankingsError("The board changed. Refresh to see the latest rankings.", 409);
      if (!Number.isSafeInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > rows.length) throw new Error();
      offset = parsed.offset;
    } catch (error) { if (error instanceof RankingsError) throw error; throw new RankingsError("Invalid rankings cursor", 400); }
  }
  const end = offset + 25;
  return { rows: rows.slice(offset, end).map(publicRankingRow), total: rows.length, from: snapshot.from, through: snapshot.through, asOf: snapshot.asOf, ruleVersion: snapshot.ruleVersion,
    nextCursor: end < rows.length ? Buffer.from(JSON.stringify({ version, offset: end })).toString("base64url") : null };
}

export async function playerStats(player: PlayerRecord, window: "all" | "30d" = "all", now = new Date()) {
  await ensureDailyAssignment(now);
  const launch = await getRankingsLaunchDate();
  const [plays, assignments] = await Promise.all([listPlays(player.playerId), listDailyAssignments()]);
  const from = new Date(Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`) - 29 * 86_400_000).toISOString();
  const filtered = window === "30d" ? plays.filter((p) => p.startedAt >= from) : plays;
  const select = (context: "daily" | "practice") => filtered.filter((p) => p.context === context && p.pool === context);
  let ownRank: ReturnType<typeof publicRankingRow> | null = null; let rankingsAsOf: string | null = null;
  let rankingsStatus: "ready" | "unavailable" = launch ? "ready" : "unavailable";
  if (rankingsStatus === "ready") {
    try {
      const visible = await visibleRankings(now); rankingsAsOf = visible.snapshot.asOf;
      const row = visible.rows.find((r) => r.playerId === player.playerId);
      if (row) ownRank = publicRankingRow(row);
    } catch { rankingsStatus = "unavailable"; }
  }
  return { daily: summarizePlays(select("daily")), practice: summarizePlays(select("practice")),
    streaks: launch ? dailyStreaks(plays, assignments, launch, now) : { current: 0, best: 0 },
    publicStats: player.publicStats, ownRank, rankingsAsOf, rankingsStatus, launchDate: launch, window,
    asOf: now.toISOString() };
}
