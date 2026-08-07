import { DailyPuzzle } from "../DailyPuzzle";
import { getDailyPuzzle, getNextPuzzle, getPuzzleByNumber, toPublicPuzzle } from "../../lib/puzzles";

type NextPuzzleProps = {
  searchParams: Promise<{ puzzle?: string }>;
};

export default async function NextPuzzle({ searchParams }: NextPuzzleProps) {
  const params = await searchParams;
  const requestedPuzzle = Number.parseInt(params.puzzle ?? "", 10);
  const selected =
    Number.isInteger(requestedPuzzle) && requestedPuzzle >= 1
      ? getPuzzleByNumber(requestedPuzzle) ?? getNextPuzzle(getDailyPuzzle())
      : getNextPuzzle(getDailyPuzzle());
  const next = getNextPuzzle(selected, "daily");

  const puzzle = toPublicPuzzle(selected, { pool: "daily", context: "author-test" });
  return (
    <DailyPuzzle
      key={`${puzzle.context}:${puzzle.id}`}
      puzzle={puzzle}
      nextPuzzleNumber={next.number}
    />
  );
}
