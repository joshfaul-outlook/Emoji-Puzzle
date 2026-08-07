import { insertFeedback } from "../../../db/feedback";
import { GAME_CONFIG, getPuzzleById, type PuzzlePool } from "../../../lib/puzzles";

type FeedbackPayload = {
  puzzleId?: string;
  puzzleNumber?: number;
  pool?: PuzzlePool;
  rating?: "up" | "down";
  comment?: string;
  playId?: string;
  anonymousSessionId?: string;
  outcome?: "solved" | "revealed";
  guessCount?: number;
  hintCount?: number;
  metadata?: Record<string, unknown>;
};

function cleanCount(value: unknown, maximum: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.round(value)))
    : 0;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as FeedbackPayload;
    const pool = payload.pool === "daily" || payload.pool === "practice" ? payload.pool : null;
    const puzzle = payload.puzzleId && pool ? getPuzzleById(payload.puzzleId, pool) : undefined;
    const comment = payload.comment?.trim() || null;
    const validRating = payload.rating === "up" || payload.rating === "down";
    const validOutcome = payload.outcome === "solved" || payload.outcome === "revealed";

    if (
      !puzzle ||
      !pool ||
      puzzle.number !== payload.puzzleNumber ||
      !validRating ||
      !validOutcome ||
      !payload.playId ||
      !payload.anonymousSessionId ||
      (comment?.length ?? 0) > GAME_CONFIG.maxCommentLength ||
      (pool === "practice" && comment !== null)
    ) {
      return Response.json({ error: "Invalid feedback" }, { status: 400 });
    }

    await insertFeedback({
      puzzleId: puzzle.id,
      puzzleNumber: puzzle.number,
      puzzlePool: pool,
      rating: payload.rating as "up" | "down",
      comment,
      playId: payload.playId.slice(0, 80),
      anonymousSessionId: payload.anonymousSessionId.slice(0, 80),
      outcome: payload.outcome as "solved" | "revealed",
      guessCount: cleanCount(payload.guessCount, 1_000),
      hintCount: cleanCount(payload.hintCount, 20),
      metadataJson: JSON.stringify(payload.metadata ?? {}).slice(0, 2_000),
    });

    return Response.json({ saved: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save feedback" }, { status: 500 });
  }
}
