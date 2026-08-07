export type Resolution = {
  answer: string;
  category: string;
  explanation: string;
};

export type Outcome = "playing" | "solved" | "revealed";

export type PlayState = {
  playId: string;
  guessCount: number;
  hints: string[];
  outcome: Outcome;
  resolution: Resolution | null;
  feedbackSent: boolean;
};

type StorageLike = Pick<Storage, "getItem">;

export const ACTIVE_MODE_KEY = "emoji-daily-active-mode";
export const PRACTICE_PROGRESS_KEY = "emoji-daily-practice-progress";

export type PracticeProgress = {
  position: number;
  cycle: number;
};

export function getActiveMode(storage: StorageLike): "daily" | "practice" {
  return storage.getItem(ACTIVE_MODE_KEY) === "practice" ? "practice" : "daily";
}

export function restorePlay(storage: StorageLike, storageKey: string): PlayState | null {
  const saved = storage.getItem(storageKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as PlayState;
  } catch {
    return null;
  }
}

export function restorePracticeProgress(
  storage: StorageLike,
  practiceLength: number,
): PracticeProgress {
  const saved = storage.getItem(PRACTICE_PROGRESS_KEY);
  if (!saved) return { position: 1, cycle: 0 };

  try {
    const parsed = JSON.parse(saved) as Partial<PracticeProgress>;
    if (
      Number.isInteger(parsed.position) &&
      Number.isInteger(parsed.cycle) &&
      (parsed.position as number) >= 1 &&
      (parsed.position as number) <= practiceLength &&
      (parsed.cycle as number) >= 0
    ) {
      return { position: parsed.position as number, cycle: parsed.cycle as number };
    }
  } catch {
    // Fall through to a safe first-puzzle default.
  }

  return { position: 1, cycle: 0 };
}

export function dailyPlayStorageKey(puzzleId: string, dateCode: string) {
  return `emoji-daily-play:daily:${dateCode}:${puzzleId}`;
}

export function practicePlayStorageKey(puzzleId: string, cycle: number) {
  return `emoji-daily-play:practice:${cycle}:${puzzleId}`;
}

export function challengePlayStorageKey(puzzleId: string, challengeKey: string) {
  return `emoji-daily-play:challenge:${puzzleId}:${challengeKey}`;
}
