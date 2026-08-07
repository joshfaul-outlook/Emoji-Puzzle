import { getPuzzleById, type PuzzlePool } from "../../../lib/puzzles";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | { puzzleId?: string; pool?: PuzzlePool; hintIndex?: number }
    | null;
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = payload?.puzzleId && pool ? getPuzzleById(payload.puzzleId, pool) : undefined;
  const hintIndex = payload?.hintIndex;

  if (!puzzle || !Number.isInteger(hintIndex) || (hintIndex as number) < 0) {
    return Response.json({ error: "Invalid hint request" }, { status: 400 });
  }

  const hint = puzzle.hints[hintIndex as number];
  if (!hint) return Response.json({ error: "No more hints" }, { status: 404 });
  return Response.json({ hint });
}
