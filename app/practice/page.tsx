import { DailyPuzzle, type ChallengeBenchmark } from "../DailyPuzzle";
import { getPracticePuzzleByPosition, toPublicPuzzle } from "../../lib/puzzles";

type PracticePageProps = {
  searchParams: Promise<{
    puzzle?: string;
    challenge?: string;
    outcome?: string;
    guesses?: string;
    hints?: string;
  }>;
};

function boundedCount(value: string | undefined, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
  const challengePosition = Number.parseInt(params.challenge ?? "", 10);
  const requestedPosition = Number.parseInt(params.puzzle ?? "", 10);
  const isChallenge = Boolean(getPracticePuzzleByPosition(challengePosition));
  const position = isChallenge
    ? challengePosition
    : Number.isInteger(requestedPosition) && requestedPosition >= 1
      ? requestedPosition
      : 1;
  const selected = getPracticePuzzleByPosition(position) ?? getPracticePuzzleByPosition(1);

  if (!selected) {
    return (
      <main className="utility-page">
        <div className="brand-mark" aria-hidden="true">◒</div>
        <h1>Practice is warming up</h1>
        <p>The first practice set will be ready soon.</p>
      </main>
    );
  }

  const outcome = params.outcome === "solved" || params.outcome === "revealed"
    ? params.outcome
    : null;
  const guesses = boundedCount(params.guesses, 1_000);
  const hints = boundedCount(params.hints, 20);
  const benchmark: ChallengeBenchmark | null = isChallenge && outcome && guesses !== null && hints !== null
    ? { outcome, guessCount: guesses, hintCount: hints }
    : null;
  const puzzle = toPublicPuzzle(selected, {
    pool: "practice",
    context: isChallenge ? "challenge" : "practice",
  });

  return (
    <DailyPuzzle
      key={`${puzzle.context}:${puzzle.id}`}
      puzzle={puzzle}
      challengeBenchmark={benchmark}
      resumePractice={!isChallenge && !params.puzzle}
    />
  );
}
