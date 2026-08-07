import { getPuzzleById, puzzleResolution, type PuzzlePool } from "../../../lib/puzzles";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { puzzleId?: string; pool?: PuzzlePool } | null;
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = payload?.puzzleId && pool ? getPuzzleById(payload.puzzleId, pool) : undefined;
  if (!puzzle) return Response.json({ error: "Invalid puzzle" }, { status: 400 });
  return Response.json({ resolution: puzzleResolution(puzzle) });
}
