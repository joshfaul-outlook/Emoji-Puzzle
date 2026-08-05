import { GAME_CONFIG, getPuzzleById, isAcceptedGuess, puzzleResolution } from "../../../lib/puzzles";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { puzzleId?: string; guess?: string }
    | null;
  const puzzle = payload?.puzzleId ? getPuzzleById(payload.puzzleId) : undefined;
  const guess = payload?.guess?.trim() ?? "";

  if (!puzzle || !guess || guess.length > GAME_CONFIG.maxGuessLength) {
    return Response.json({ error: "Invalid guess" }, { status: 400 });
  }

  if (!isAcceptedGuess(puzzle, guess)) {
    return Response.json({ correct: false });
  }

  return Response.json({ correct: true, resolution: puzzleResolution(puzzle) });
}
