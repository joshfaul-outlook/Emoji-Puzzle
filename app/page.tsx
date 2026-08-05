import { DailyPuzzle } from "./DailyPuzzle";
import { getDailyPuzzle, getPuzzleByNumber, toPublicPuzzle } from "../lib/puzzles";

type HomeProps = {
  searchParams: Promise<{ puzzle?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const requestedPuzzle = Number.parseInt(params.puzzle ?? "", 10);
  const selected =
    Number.isInteger(requestedPuzzle) && requestedPuzzle >= 1
      ? getPuzzleByNumber(requestedPuzzle) ?? getDailyPuzzle()
      : getDailyPuzzle();

  return <DailyPuzzle puzzle={toPublicPuzzle(selected)} sequenceMode={false} />;
}
