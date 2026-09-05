export type RankingPlay = {
  playerId: string; playId: string; puzzleId: string; pool: "daily" | "practice";
  context: "daily" | "practice" | "challenge" | "author-test"; rankingEligible: boolean;
  startedAt: string; completedAt: string | null; outcome: "playing" | "solved" | "revealed";
  guessCount: number; hintCount: number; dailyDate?: string; puzzleRevision?: string; rankingOutcome?: string;
};
export type RankingAssignment = { dailyDate: string; puzzleId: string | null; revision: string | null; void: boolean };
const day = 86_400_000;
const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);
const uniquePlays = (plays: RankingPlay[]) => [...new Map(plays.map((p) => [`${p.playerId}:${p.playId}`, p])).values()];

export function summarizePlays(input: RankingPlay[]) {
  const plays = uniquePlays(input); const solved = plays.filter((p) => p.outcome === "solved");
  const revealed = plays.filter((p) => p.outcome === "revealed").length;
  return {
    started: plays.length, solved: solved.length, revealed, unfinished: plays.length - solved.length - revealed,
    solveRate: solved.length + revealed ? solved.length / (solved.length + revealed) : null,
    unaidedSolves: solved.filter((p) => p.hintCount === 0).length,
    averageGuesses: solved.length ? solved.reduce((n, p) => n + p.guessCount, 0) / solved.length : null,
    averageHints: solved.length ? solved.reduce((n, p) => n + p.hintCount, 0) / solved.length : null,
    distinctSolved: new Set(solved.map((p) => p.puzzleId)).size,
    unrankedCompleted: plays.filter((p) => p.outcome !== "playing" && p.rankingOutcome !== "solved" && p.rankingOutcome !== "revealed").length,
    coverageStart: plays.map((p) => p.startedAt).sort()[0] ?? null,
  };
}

function assignmentIndex(assignments: RankingAssignment[]) {
  const seen = new Set<string>(); const dates = new Map<string, RankingAssignment>();
  for (const a of [...assignments].sort((x, y) => x.dailyDate.localeCompare(y.dailyDate))) {
    const repeated = a.puzzleId !== null && seen.has(a.puzzleId);
    if (a.puzzleId) seen.add(a.puzzleId);
    dates.set(a.dailyDate, { ...a, void: a.void || repeated });
  }
  return dates;
}
function canonicalPlays(plays: RankingPlay[]) {
  const first = new Map<string, RankingPlay>();
  for (const p of uniquePlays(plays).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.playId.localeCompare(b.playId))) {
    if (p.context === "daily" && p.pool === "daily" && !first.has(`${p.playerId}:${p.puzzleId}`)) first.set(`${p.playerId}:${p.puzzleId}`, p);
  }
  return [...first.values()];
}
export function eligibleDailyPlays(plays: RankingPlay[], assignments: RankingAssignment[], launchDate: string, now: Date) {
  const dates = assignmentIndex(assignments);
  const exposed = new Set(plays.filter((p) => p.context === "author-test").map((p) => `${p.playerId}:${p.puzzleId}`));
  return canonicalPlays(plays).filter((p) => {
    const a = p.dailyDate ? dates.get(p.dailyDate) : null;
    return a && !a.void && a.dailyDate >= launchDate && a.puzzleId === p.puzzleId && a.revision === p.puzzleRevision &&
      p.rankingEligible && p.rankingOutcome === "solved" && p.outcome === "solved" &&
      p.startedAt.slice(0, 10) === a.dailyDate && p.completedAt?.slice(0, 10) === a.dailyDate &&
      Date.parse(p.completedAt) >= Date.parse(p.startedAt) && Date.parse(p.completedAt) <= now.getTime() &&
      !exposed.has(`${p.playerId}:${p.puzzleId}`);
  });
}

export function dailyStreaks(plays: RankingPlay[], assignments: RankingAssignment[], launchDate: string, now: Date) {
  const dates = assignmentIndex(assignments); const today = dateAt(now.getTime());
  const solved = new Set(eligibleDailyPlays(plays, assignments, launchDate, now).map((p) => p.dailyDate));
  let current = 0; let best = 0;
  for (let t = Date.parse(`${launchDate}T00:00:00Z`); t <= now.getTime(); t += day) {
    const date = dateAt(t); const assignment = dates.get(date);
    if (assignment?.void) continue;
    if (solved.has(date)) { current += 1; best = Math.max(best, current); }
    else if (date !== today || plays.some((p) => p.context === "daily" && p.pool === "daily" && p.dailyDate === date && p.puzzleId === assignment?.puzzleId && p.puzzleRevision === assignment.revision && p.outcome === "revealed" && p.completedAt && Date.parse(p.completedAt) <= now.getTime())) current = 0;
  }
  return { current, best };
}

export type RankingRow = { playerId: string; displayName: string; solves: number; unaidedSolves: number; currentStreak: number; rank: number };
export function assignRanks<T extends { playerId: string; solves: number; unaidedSolves: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.solves - a.solves || b.unaidedSolves - a.unaidedSolves || a.playerId.localeCompare(b.playerId));
  let rank = 0;
  return sorted.map((r, i) => {
    if (!i || r.solves !== sorted[i - 1].solves || r.unaidedSolves !== sorted[i - 1].unaidedSolves) rank = i + 1;
    return { ...r, rank };
  });
}
export function rankingWindow(launchDate: string, now: Date) {
  return { from: [launchDate, dateAt(Date.parse(`${dateAt(now.getTime())}T00:00:00Z`) - 29 * day)].sort()[1], through: dateAt(now.getTime()) };
}
export function buildRankings(plays: RankingPlay[], assignments: RankingAssignment[], players: { playerId: string; displayName: string; publicStats?: boolean }[], launchDate: string, now: Date): RankingRow[] {
  const { from } = rankingWindow(launchDate, now);
  const groups = new Map<string, RankingPlay[]>();
  for (const p of plays) { const group = groups.get(p.playerId) ?? []; group.push(p); groups.set(p.playerId, group); }
  const rows = players.filter((p) => p.publicStats !== false).map((player) => {
    const history = groups.get(player.playerId) ?? [];
    const eligible = eligibleDailyPlays(history, assignments, launchDate, now).filter((p) => p.dailyDate! >= from);
    return { playerId: player.playerId, displayName: player.displayName, solves: eligible.length, unaidedSolves: eligible.filter((p) => !p.hintCount).length, currentStreak: dailyStreaks(history, assignments, launchDate, now).current };
  }).filter((r) => r.solves > 0);
  return assignRanks(rows);
}
