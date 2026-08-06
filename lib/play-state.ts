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

export function restorePlay(storage: StorageLike, storageKey: string): PlayState | null {
  const saved = storage.getItem(storageKey);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as PlayState;
  } catch {
    return null;
  }
}
