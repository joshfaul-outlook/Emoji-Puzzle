import { GAME_CONFIG, getPuzzleById, isAcceptedGuess, puzzleResolution, type PuzzlePool } from "../../../lib/puzzles";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { puzzleId?: string; pool?: PuzzlePool; guess?: string }
    | null;
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = payload?.puzzleId && pool ? getPuzzleById(payload.puzzleId, pool) : undefined;
  const guess = payload?.guess?.trim() ?? "";

  if (!puzzle || !guess || guess.length > GAME_CONFIG.maxGuessLength) {
    return Response.json({ error: "Invalid guess" }, { status: 400 });
  }

  if (!isAcceptedGuess(puzzle, guess)) {
    return Response.json({ correct: false });
  }

  return Response.json({ correct: true, resolution: puzzleResolution(puzzle) });
}
