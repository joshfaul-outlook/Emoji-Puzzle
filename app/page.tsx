import { DailyPuzzle } from "./DailyPuzzle";
import { getDailyPuzzle, getPuzzleByNumber, toPublicPuzzle } from "../lib/puzzles";

type HomeProps = {
  searchParams: Promise<{ puzzle?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const requestedPuzzle = Number.parseInt(params.puzzle ?? "", 10);
  const isAuthorTest = Number.isInteger(requestedPuzzle) && requestedPuzzle >= 1;
  const selected =
    isAuthorTest
      ? getPuzzleByNumber(requestedPuzzle) ?? getDailyPuzzle()
      : getDailyPuzzle();

  const puzzle = toPublicPuzzle(selected, {
    pool: "daily",
    context: isAuthorTest ? "author-test" : "daily",
  });
  return <DailyPuzzle key={`${puzzle.context}:${puzzle.id}`} puzzle={puzzle} />;
}
