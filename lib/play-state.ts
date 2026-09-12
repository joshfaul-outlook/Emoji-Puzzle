export type Resolution = {
  answer: string;
  category: string;
  explanation: string;
};

export type Outcome = "playing" | "solved" | "revealed";

export type PlayState = {
  version: 1;
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
  order: number[];
};

type RandomSource = () => number;

function shuffled<T>(values: T[], random: RandomSource) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function shuffledPositions(practiceLength: number, random: RandomSource) {
  return shuffled(Array.from({ length: practiceLength }, (_, index) => index + 1), random);
}

export function createPracticeProgress(
  practiceLength: number,
  startingPosition: number,
  cycle = 0,
  random: RandomSource = Math.random,
): PracticeProgress {
  const order = shuffledPositions(practiceLength, random);
  const startIndex = order.indexOf(startingPosition);
  if (startIndex > 0) [order[0], order[startIndex]] = [order[startIndex], order[0]];
  return { position: order[0] ?? 1, cycle, order };
}

export function advancePracticeProgress(
  progress: PracticeProgress,
  practiceLength: number,
  random: RandomSource = Math.random,
): PracticeProgress {
  const currentIndex = progress.order.indexOf(progress.position);
  if (currentIndex >= 0 && currentIndex < progress.order.length - 1) {
    return { ...progress, position: progress.order[currentIndex + 1] };
  }

  const next = createPracticeProgress(practiceLength, 1, progress.cycle + 1, random);
  if (practiceLength > 1 && next.position === progress.position) {
    [next.order[0], next.order[1]] = [next.order[1], next.order[0]];
    next.position = next.order[0];
  }
  return next;
}

export function getActiveMode(storage: StorageLike): "daily" | "practice" {
  return storage.getItem(ACTIVE_MODE_KEY) === "practice" ? "practice" : "daily";
}

export function restoreOpaquePlayId(storage: StorageLike, storageKey: string) {
  const saved = storage.getItem(storageKey);
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as { playId?: unknown };
    return typeof parsed.playId === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(parsed.playId) ? parsed.playId : null;
  } catch {
    return null;
  }
}

export function restorePracticeProgress(
  storage: StorageLike,
  practiceLength: number,
  fallbackPosition = 1,
  random: RandomSource = Math.random,
): PracticeProgress {
  const saved = storage.getItem(PRACTICE_PROGRESS_KEY);
  if (!saved) return createPracticeProgress(practiceLength, fallbackPosition, 0, random);

  try {
    const parsed = JSON.parse(saved) as Partial<PracticeProgress>;
    if (
      Number.isInteger(parsed.position) &&
      Number.isInteger(parsed.cycle) &&
      (parsed.position as number) >= 1 &&
      (parsed.position as number) <= practiceLength &&
      (parsed.cycle as number) >= 0
    ) {
      const position = parsed.position as number;
      const cycle = parsed.cycle as number;
      if (
        Array.isArray(parsed.order) &&
        parsed.order.length === practiceLength &&
        new Set(parsed.order).size === practiceLength &&
        parsed.order.every((item) => Number.isInteger(item) && item >= 1 && item <= practiceLength) &&
        parsed.order.includes(position)
      ) {
        return { position, cycle, order: parsed.order };
      }
      if (
        Array.isArray(parsed.order) &&
        parsed.order.length < practiceLength &&
        new Set(parsed.order).size === parsed.order.length &&
        parsed.order.every((item) => Number.isInteger(item) && item >= 1 && item <= parsed.order!.length) &&
        parsed.order.includes(position)
      ) {
        const currentIndex = parsed.order.indexOf(position);
        const additions = Array.from(
          { length: practiceLength - parsed.order.length },
          (_, index) => parsed.order!.length + index + 1,
        );
        return {
          position,
          cycle,
          order: [
            ...parsed.order.slice(0, currentIndex + 1),
            ...shuffled([...parsed.order.slice(currentIndex + 1), ...additions], random),
          ],
        };
      }
      return createPracticeProgress(practiceLength, position, cycle, random);
    }
  } catch {
    // Fall through to a fresh shuffled deck.
  }

  return createPracticeProgress(practiceLength, fallbackPosition, 0, random);
}

export function restorePracticePosition(storage: StorageLike) {
  const saved = storage.getItem(PRACTICE_PROGRESS_KEY);
  if (!saved) return null;
  try {
    const position = (JSON.parse(saved) as Partial<PracticeProgress>).position;
    return Number.isInteger(position) && (position as number) >= 1 ? position as number : null;
  } catch {
    return null;
  }
}

export function practicePlayStorageKey(puzzleId: string, cycle: number) {
  return `emoji-daily-play:practice:${cycle}:${puzzleId}`;
}

export function challengePlayStorageKey(puzzleId: string, challengeKey: string) {
  return `emoji-daily-play:challenge:${puzzleId}:${challengeKey}`;
}
