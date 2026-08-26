export type PuzzlePool = "daily" | "practice";
export type PlayContext = "daily" | "practice" | "challenge" | "author-test";

export type PublicPuzzle = {
  id: string;
  number: number;
  emoji: string;
  hintCount: number;
  pool: PuzzlePool;
  context: PlayContext;
  sequenceNumber: number;
  sequenceLength: number;
  dateCode: string | null;
  rankingEligible: boolean;
  legacyStorageEligible: boolean;
};

export function getNextPuzzleLaunchAt(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

export function formatTimeUntilPuzzleLaunch(now: number, launchAt: number) {
  const remainingMinutes = Math.max(0, Math.ceil((launchAt - now) / 60_000));
  return `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`;
}
