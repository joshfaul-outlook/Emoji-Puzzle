import { redirect } from "next/navigation";
import { getDailyPuzzle, getNextPuzzle, getPuzzleByNumber } from "../../lib/puzzles";

type NextPuzzleProps = {
  searchParams: Promise<{ puzzle?: string }>;
};

export default async function NextPuzzle({ searchParams }: NextPuzzleProps) {
  const params = await searchParams;
  const requestedPuzzle = Number.parseInt(params.puzzle ?? "", 10);
  const current =
    Number.isInteger(requestedPuzzle) && requestedPuzzle >= 1
      ? getPuzzleByNumber(requestedPuzzle) ?? getDailyPuzzle()
      : getDailyPuzzle();
  const next = getNextPuzzle(current);

  redirect(`/?puzzle=${next.number}`);
}
