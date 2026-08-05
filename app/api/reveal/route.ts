import { getPuzzleById, puzzleResolution } from "../../../lib/puzzles";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { puzzleId?: string } | null;
  const puzzle = payload?.puzzleId ? getPuzzleById(payload.puzzleId) : undefined;
  if (!puzzle) return Response.json({ error: "Invalid puzzle" }, { status: 400 });
  return Response.json({ resolution: puzzleResolution(puzzle) });
}
