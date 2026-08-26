import type { PublicPuzzle } from "./public-puzzle";
import type { PlayState } from "./play-state";

export function feedbackPlayFields(
  puzzle: Pick<PublicPuzzle, "id" | "number">,
  play: PlayState,
) {
  return {
    puzzleId: puzzle.id,
    puzzleNumber: puzzle.number,
    playId: play.playId,
    outcome: play.outcome,
    guessCount: play.guessCount,
    hintCount: play.hints.length,
  };
}
