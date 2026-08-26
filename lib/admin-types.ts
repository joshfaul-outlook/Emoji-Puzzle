import type { PuzzlePool } from "./public-puzzle";

export type PuzzleStatus = "draft" | "published" | "archived";
export type PuzzleStructure = "literal" | "idiom" | "rebus" | "person" | "story" | "movie" | "historical" | "interpretive";

export type AdminPuzzle = {
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

export type FeedbackItem = {
  id: string;
  createdAt: string;
  puzzleId: string;
  puzzleNumber: number;
  puzzlePool: PuzzlePool;
  rating: "up" | "down";
  comment: string | null;
  outcome: "solved" | "revealed";
  guessCount: number;
  hintCount: number;
};
