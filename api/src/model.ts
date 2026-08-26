export type PuzzlePool = "daily" | "practice";
export type PuzzleStatus = "draft" | "published" | "archived";
export type PuzzleStructure = "literal" | "idiom" | "rebus" | "person" | "story" | "movie" | "historical" | "interpretive";

export type StoredPuzzle = {
  id: string;
  number: number;
  pool: PuzzlePool;
  position: number;
  status: PuzzleStatus;
  emoji: string;
  answer: string;
  acceptedAnswers: string[];
  category: string;
  structure: PuzzleStructure;
  hints: string[];
  explanation: string;
  createdAt: string;
  updatedAt: string;
  etag: string;
};

export function normalizeGuess(value: string) {
  return value.normalize("NFKD").toLocaleLowerCase("en").replace(/\p{M}+/gu, "").replace(/[’‘`]/g, "'").replace(/&/g, " and ").replace(/[^a-z0-9\s']/g, " ").replace(/'/g, "").replace(/\s+/g, " ").trim();
}

export function isAcceptedGuess(puzzle: StoredPuzzle, guess: string) {
  const normalized = normalizeGuess(guess);
  const compact = normalized.replace(/\s/g, "");
  return puzzle.acceptedAnswers.some((answer) => {
    const candidate = normalizeGuess(answer);
    return candidate === normalized || candidate.replace(/\s/g, "") === compact;
  });
}

export function validatePuzzle(input: Partial<StoredPuzzle>, status: PuzzleStatus) {
  if (!input.answer?.trim()) return "An answer is required.";
  if (input.pool !== "daily" && input.pool !== "practice") return "Choose a puzzle pool.";
  if (status !== "published") return null;
  if (!input.emoji?.trim()) return "Published puzzles need an emoji sequence.";
  if (!input.category?.trim()) return "Published puzzles need a category.";
  if (!input.explanation?.trim()) return "Published puzzles need an explanation.";
  if (!input.acceptedAnswers?.some((answer) => normalizeGuess(answer) === normalizeGuess(input.answer ?? ""))) return "Accepted answers must include the canonical answer.";
  if (input.hints?.length !== 3 || input.hints.some((hint) => !hint.trim())) return "Published puzzles need three complete hints.";
  return null;
}
