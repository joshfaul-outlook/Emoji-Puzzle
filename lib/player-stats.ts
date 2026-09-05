export type PlaySummary = {
  started: number; solved: number; revealed: number; unfinished: number;
  solveRate: number | null; unaidedSolves: number; averageGuesses: number | null;
  averageHints: number | null; distinctSolved: number; unrankedCompleted: number; coverageStart: string | null;
};
export type PublicRank = { rank: number; displayName: string; solves: number; unaidedSolves: number; currentStreak: number };
export type PlayerStats = {
  daily: PlaySummary; practice: PlaySummary;
  streaks: { current: number; best: number }; publicStats: boolean;
  ownRank: PublicRank | null; rankingsAsOf: string | null;
  rankingsStatus: "ready" | "unavailable";
  launchDate: string | null; window: "all" | "30d"; asOf: string;
};
export type RankingsPage = { rows: PublicRank[]; total: number; from: string; through: string; asOf: string; ruleVersion: number; nextCursor: string | null };
export type PlayerGlance = {
  daily: { currentStreak: number; currentPublicRank: number | null; rankingsStatus: "ready" | "unavailable"; rankingsAsOf: string | null };
  practice: { solved: number; solveRate: number | null };
  publicStats: boolean;
};
