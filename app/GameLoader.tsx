"use client";

import { useEffect, useState } from "react";
import { DailyPuzzle, type ChallengeBenchmark } from "./DailyPuzzle";
import type { PublicPuzzle } from "../lib/public-puzzle";
import { KnowingMark } from "./components/KnowingMark";
import { PlayerIdentityGate } from "./PlayerIdentityGate";

type LoaderMode = "daily" | "practice" | "next";

export function GameLoader({ mode }: { mode: LoaderMode }) {
  const [result, setResult] = useState<{ puzzle: PublicPuzzle; nextPuzzleNumber?: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    parameters.set("mode", mode);
    fetch(`/api/puzzles/current?${parameters.toString()}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) {
          const failure = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(failure?.error ?? "The puzzle could not load. Please try again.");
        }
        return response.json() as Promise<{ puzzle: PublicPuzzle; nextPuzzleNumber?: number }>;
      })
      .then(setResult)
      .catch((failure) => setError(failure instanceof Error ? failure.message : "The puzzle could not load. Please try again."));
  }, [mode]);

  if (error) {
    return (
      <main className="utility-page">
        <KnowingMark size={64} />
        <h1>Puzzle temporarily unavailable</h1>
        <p>{error}</p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>Try again</button>
        <a href="/practice/">Play Practice</a>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="utility-page" aria-busy="true">
        <KnowingMark size={64} />
        <h1>Setting today’s puzzle…</h1>
        <p aria-live="polite">Just a moment.</p>
      </main>
    );
  }

  const query = new URLSearchParams(window.location.search);
  const outcome = query.get("outcome");
  const guesses = Number.parseInt(query.get("guesses") ?? "", 10);
  const hints = Number.parseInt(query.get("hints") ?? "", 10);
  const challengeBenchmark: ChallengeBenchmark | null =
    result.puzzle.context === "challenge" &&
    (outcome === "solved" || outcome === "revealed") &&
    Number.isInteger(guesses) && guesses >= 0 && guesses <= 1000 &&
    Number.isInteger(hints) && hints >= 0 && hints <= 20
      ? { outcome, guessCount: guesses, hintCount: hints }
      : null;

  return <PlayerIdentityGate>{(identity, invalidateIdentity) => (
    <DailyPuzzle
      key={`${result.puzzle.context}:${result.puzzle.id}:${identity.playerId}`}
      puzzle={result.puzzle}
      identity={identity}
      invalidateIdentity={invalidateIdentity}
      nextPuzzleNumber={result.nextPuzzleNumber}
      challengeBenchmark={challengeBenchmark}
      resumePractice={mode === "practice" && !query.has("puzzle") && !query.has("challenge")}
    />
  )}</PlayerIdentityGate>;
}
