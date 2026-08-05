"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { PublicPuzzle } from "../lib/puzzles";

type Resolution = {
  answer: string;
  category: string;
  explanation: string;
};

type Outcome = "playing" | "solved" | "revealed";

type PlayState = {
  playId: string;
  startedAt: number;
  endedAt: number | null;
  guessCount: number;
  hints: string[];
  outcome: Outcome;
  resolution: Resolution | null;
  feedbackSent: boolean;
};

const SESSION_KEY = "emoji-daily-anonymous-session";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function freshPlay(): PlayState {
  return {
    playId: createId(),
    startedAt: Date.now(),
    endedAt: null,
    guessCount: 0,
    hints: [],
    outcome: "playing",
    resolution: null,
    feedbackSent: false,
  };
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function timeUntilTomorrow(now: number) {
  const current = new Date(now);
  const midnight = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1,
  );
  const minutes = Math.max(0, Math.floor((midnight - now) / 60_000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function DailyPuzzle({ puzzle }: { puzzle: PublicPuzzle }) {
  const storageKey = `emoji-daily-play:${puzzle.id}`;
  const [play, setPlay] = useState<PlayState>(() => freshPlay());
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [now, setNow] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "error">("idle");
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    let restored: PlayState | null = null;
    try {
      restored = saved ? (JSON.parse(saved) as PlayState) : null;
    } catch {
      restored = null;
    }
    const task = window.setTimeout(() => {
      if (restored) {
        setPlay(restored);
      }
      setHydrated(true);
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(task);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(storageKey, JSON.stringify(play));
  }, [hydrated, play, storageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (hydrated && play.outcome === "playing") inputRef.current?.focus();
  }, [hydrated, play.outcome]);

  const elapsedSeconds = useMemo(() => {
    const end = play.endedAt ?? now;
    return Math.max(0, Math.floor((end - play.startedAt) / 1_000));
  }, [now, play.endedAt, play.startedAt]);

  async function submitGuess(event: FormEvent) {
    event.preventDefault();
    const trimmed = guess.trim();
    if (!trimmed || busy || play.outcome !== "playing") return;

    setBusy(true);
    setMessage("");
    const nextGuessCount = play.guessCount + 1;
    try {
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, guess: trimmed }),
      });
      const data = (await response.json()) as {
        correct?: boolean;
        resolution?: Resolution;
      };

      if (data.correct && data.resolution) {
        setPlay((current) => ({
          ...current,
          guessCount: nextGuessCount,
          outcome: "solved",
          endedAt: Date.now(),
          resolution: data.resolution ?? null,
        }));
        setMessage("");
      } else {
        setPlay((current) => ({ ...current, guessCount: nextGuessCount }));
        setGuess("");
        setMessage("Not quite — try another angle.");
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch {
      setMessage("Something hiccupped. Your guess wasn’t counted—try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestHint() {
    if (busy || play.hints.length >= puzzle.hintCount) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id, hintIndex: play.hints.length }),
      });
      const data = (await response.json()) as { hint?: string };
      if (data.hint) {
        setPlay((current) => ({ ...current, hints: [...current.hints, data.hint as string] }));
      }
    } catch {
      setMessage("That hint got lost. Give it another tap.");
    } finally {
      setBusy(false);
    }
  }

  async function revealAnswer() {
    if (busy || play.outcome !== "playing") return;
    setBusy(true);
    try {
      const response = await fetch("/api/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzleId: puzzle.id }),
      });
      const data = (await response.json()) as { resolution?: Resolution };
      if (data.resolution) {
        setPlay((current) => ({
          ...current,
          outcome: "revealed",
          endedAt: Date.now(),
          resolution: data.resolution ?? null,
        }));
      }
    } catch {
      setMessage("The answer wouldn’t open. Please try once more.");
    } finally {
      setBusy(false);
      setConfirmReveal(false);
    }
  }

  async function shareResult() {
    const solved = play.outcome === "solved";
    const result = [
      `Emoji Daily #${puzzle.number}`,
      `${solved ? "🟩 Solved" : "⬜ Revealed"} · ${play.guessCount} ${play.guessCount === 1 ? "guess" : "guesses"} · ${play.hints.length} ${play.hints.length === 1 ? "hint" : "hints"}`,
      `⏱ ${formatElapsed(elapsedSeconds)}`,
      window.location.origin,
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: `Emoji Daily #${puzzle.number}`, text: result });
        setShareState("shared");
      } else {
        await navigator.clipboard.writeText(result);
        setShareState("copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(result);
        setShareState("copied");
      } catch {
        setShareState("error");
      }
    }
  }

  function getAnonymousSessionId() {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = createId();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    if (!rating || feedbackState === "sending") return;
    setFeedbackState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.id,
          puzzleNumber: puzzle.number,
          rating,
          comment,
          playId: play.playId,
          anonymousSessionId: getAnonymousSessionId(),
          outcome: play.outcome,
          elapsedSeconds,
          guessCount: play.guessCount,
          hintCount: play.hints.length,
          metadata: {
            playedDateUtc: new Date(play.startedAt).toISOString().slice(0, 10),
            locale: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            pixelRatio: window.devicePixelRatio,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          },
        }),
      });
      if (!response.ok) throw new Error("feedback failed");
      setFeedbackState("sent");
      setPlay((current) => ({ ...current, feedbackSent: true }));
    } catch {
      setFeedbackState("error");
    }
  }

  const isFinished = play.outcome !== "playing" && play.resolution;

  return (
    <main className="game-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Emoji Daily home">
          <span className="brand-mark" aria-hidden="true">◒</span>
          <span>Emoji Daily</span>
        </Link>
        <div className="day-pill">Puzzle #{puzzle.number}</div>
      </header>

      {!isFinished ? (
        <section className="play-card" aria-labelledby="puzzle-title">
          <div className="eyebrow">Today’s puzzle</div>
          <h1 id="puzzle-title">What do these mean?</h1>
          <p className="intro">It could be a phrase, person, story—or something else entirely.</p>

          <div className="emoji-stage" aria-label={`Emoji puzzle: ${puzzle.emoji}`}>
            <div className="emoji-glow" aria-hidden="true" />
            <div className="emoji-line">{puzzle.emoji}</div>
          </div>

          <form className="guess-form" onSubmit={submitGuess}>
            <label className="sr-only" htmlFor="guess">Your answer</label>
            <input
              ref={inputRef}
              id="guess"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="What does it mean?"
              maxLength={120}
              autoComplete="off"
              enterKeyHint="done"
              disabled={busy}
            />
            <button className="primary-button" type="submit" disabled={!guess.trim() || busy}>
              {busy ? "Checking…" : "Guess"}
            </button>
          </form>

          <div className="status-row" aria-live="polite">
            <span className={message ? "wrong-message" : "quiet-stat"}>
              {message || (play.guessCount ? `${play.guessCount} ${play.guessCount === 1 ? "guess" : "guesses"} so far` : "Take your time. There’s no guess limit.")}
            </span>
          </div>

          {play.hints.length > 0 && (
            <div className="hints" aria-label="Revealed hints">
              {play.hints.map((hint, index) => (
                <div className="hint" key={hint}>
                  <span>{index + 1}</span>
                  <p>{hint}</p>
                </div>
              ))}
            </div>
          )}

          <div className="help-actions">
            {play.hints.length < puzzle.hintCount ? (
              <button className="text-button hint-button" type="button" onClick={requestHint} disabled={busy}>
                <span aria-hidden="true">✦</span>
                {play.hints.length ? "Another hint" : "Need a hint?"}
                <small>{play.hints.length}/{puzzle.hintCount}</small>
              </button>
            ) : (
              <span className="all-hints">All hints revealed</span>
            )}

            {!confirmReveal ? (
              <button className="text-button reveal-link" type="button" onClick={() => setConfirmReveal(true)}>
                Reveal answer
              </button>
            ) : (
              <div className="reveal-confirm" role="group" aria-label="Confirm answer reveal">
                <p>Give up and reveal today’s answer?</p>
                <button type="button" onClick={revealAnswer} disabled={busy}>Show me</button>
                <button type="button" onClick={() => setConfirmReveal(false)}>Keep trying</button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className={`result-card ${play.outcome}`} aria-labelledby="result-title">
          <div className="confetti" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </div>
          <div className="result-kicker">{play.outcome === "solved" ? "Aha—you got it!" : "Here’s the answer"}</div>
          <div className="result-emoji" aria-hidden="true">{puzzle.emoji}</div>
          <div className="category-pill">{play.resolution?.category}</div>
          <h1 id="result-title">{play.resolution?.answer}</h1>
          <p className="explanation">{play.resolution?.explanation}</p>

          <div className="result-stats" aria-label="Your result">
            <div><strong>{play.guessCount}</strong><span>{play.guessCount === 1 ? "guess" : "guesses"}</span></div>
            <div><strong>{play.hints.length}</strong><span>{play.hints.length === 1 ? "hint" : "hints"}</span></div>
            <div><strong>{formatElapsed(elapsedSeconds)}</strong><span>time</span></div>
          </div>

          <button className="share-button" type="button" onClick={shareResult}>
            <span aria-hidden="true">↗</span> Share result
          </button>
          <p className="share-status" aria-live="polite">
            {shareState === "copied" && "Spoiler-free result copied!"}
            {shareState === "shared" && "Thanks for sharing!"}
            {shareState === "error" && "Couldn’t share this time."}
          </p>

          <div className="tomorrow-rule" />
          <p className="tomorrow">A new puzzle arrives in <strong>{timeUntilTomorrow(now)}</strong></p>

          <aside className="feedback-card">
            {play.feedbackSent || feedbackState === "sent" ? (
              <div className="feedback-thanks">
                <span aria-hidden="true">✓</span>
                <div><strong>Feedback saved</strong><p>This is how the puzzles get better.</p></div>
              </div>
            ) : (
              <form onSubmit={sendFeedback}>
                <div className="feedback-topline">
                  <div><strong>How was this puzzle?</strong><p>Help shape the next batch.</p></div>
                  <div className="rating-buttons" role="group" aria-label="Rate this puzzle">
                    <button className={rating === "up" ? "selected" : ""} type="button" onClick={() => setRating("up")} aria-label="Good puzzle" aria-pressed={rating === "up"}>👍</button>
                    <button className={rating === "down" ? "selected" : ""} type="button" onClick={() => setRating("down")} aria-label="Needs work" aria-pressed={rating === "down"}>👎</button>
                  </div>
                </div>
                {rating && (
                  <div className="comment-area">
                    <label htmlFor="comment">Anything we should know? <span>Optional</span></label>
                    <textarea id="comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="Too easy, unclear, loved the aha…" />
                    <button type="submit" disabled={feedbackState === "sending"}>
                      {feedbackState === "sending" ? "Saving…" : "Send feedback"}
                    </button>
                    {feedbackState === "error" && <p className="feedback-error">Couldn’t save that. Please try again.</p>}
                  </div>
                )}
              </form>
            )}
          </aside>
        </section>
      )}

      <footer>
        <span>One puzzle. Every day. Everyone.</span>
        <span aria-hidden="true">No account · No feed · Just the puzzle</span>
      </footer>
    </main>
  );
}
