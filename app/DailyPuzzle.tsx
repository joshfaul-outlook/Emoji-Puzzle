"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  formatTimeUntilPuzzleLaunch,
  getNextPuzzleLaunchAt,
  type PublicPuzzle,
} from "../lib/public-puzzle";
import {
  ACTIVE_MODE_KEY,
  PRACTICE_PROGRESS_KEY,
  challengePlayStorageKey,
  dailyPlayStorageKey,
  getActiveMode,
  practicePlayStorageKey,
  restorePlay,
  restorePracticeProgress,
  type PlayState,
  type PracticeProgress,
  type Resolution,
} from "../lib/play-state";
import { feedbackPlayFields } from "../lib/feedback-payload";
import { BrandWordmark } from "./components/BrandWordmark";
import { KnowingMark } from "./components/KnowingMark";

const SESSION_KEY = "emoji-daily-anonymous-session";

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function freshPlay(): PlayState {
  return {
    playId: createId(),
    guessCount: 0,
    hints: [],
    outcome: "playing",
    resolution: null,
    feedbackSent: false,
  };
}

type DailyPuzzleProps = {
  puzzle: PublicPuzzle;
  nextPuzzleNumber?: number;
  challengeBenchmark?: ChallengeBenchmark | null;
  resumePractice?: boolean;
};

export type ChallengeBenchmark = {
  outcome: "solved" | "revealed";
  guessCount: number;
  hintCount: number;
};

export function DailyPuzzle({
  puzzle,
  nextPuzzleNumber,
  challengeBenchmark = null,
  resumePractice = false,
}: DailyPuzzleProps) {
  const [play, setPlay] = useState<PlayState>(() => freshPlay());
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [hydratedPuzzleId, setHydratedPuzzleId] = useState<string | null>(null);
  const [nextPuzzleCountdown, setNextPuzzleCountdown] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "error">("idle");
  const [nativeSharingAvailable, setNativeSharingAvailable] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [playStorageKey, setPlayStorageKey] = useState<string | null>(null);
  const [practiceProgress, setPracticeProgress] = useState<PracticeProgress>({ position: 1, cycle: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const sharePanelRef = useRef<HTMLDivElement>(null);
  const isFinished = play.outcome !== "playing" && play.resolution !== null;

  useEffect(() => {
    const task = window.setTimeout(() => {
      if (puzzle.context === "daily") {
        const dateCode = puzzle.dateCode ?? new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const nextStorageKey = dailyPlayStorageKey(puzzle.id, dateCode);
        const legacyStorageKey = `emoji-daily-play:${puzzle.id}`;
        const restored = restorePlay(localStorage, nextStorageKey) ?? (
          puzzle.legacyStorageEligible ? restorePlay(localStorage, legacyStorageKey) : null
        );
        setPlay(restored ?? freshPlay());
        setPlayStorageKey(nextStorageKey);
      } else if (puzzle.context === "practice") {
        sessionStorage.setItem(ACTIVE_MODE_KEY, "practice");
        const progress = restorePracticeProgress(localStorage, puzzle.sequenceLength);
        if (resumePractice && progress.position !== puzzle.sequenceNumber) {
          window.location.replace(`/practice?puzzle=${progress.position}`);
          return;
        }
        const currentProgress = progress.position === puzzle.sequenceNumber
          ? progress
          : { position: puzzle.sequenceNumber, cycle: progress.cycle };
        localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(currentProgress));
        setPracticeProgress(currentProgress);
        const nextStorageKey = practicePlayStorageKey(puzzle.id, currentProgress.cycle);
        setPlay(restorePlay(localStorage, nextStorageKey) ?? freshPlay());
        setPlayStorageKey(nextStorageKey);
      } else if (puzzle.context === "challenge") {
        sessionStorage.setItem(ACTIVE_MODE_KEY, "practice");
        const challengeKey = challengeBenchmark
          ? `${challengeBenchmark.outcome}-${challengeBenchmark.guessCount}-${challengeBenchmark.hintCount}`
          : "open";
        const nextStorageKey = challengePlayStorageKey(puzzle.id, challengeKey);
        setPlay(restorePlay(localStorage, nextStorageKey) ?? freshPlay());
        setPlayStorageKey(nextStorageKey);
      } else {
        const nextStorageKey = `emoji-daily-play:author-test:${puzzle.id}`;
        setPlay(restorePlay(localStorage, nextStorageKey) ?? freshPlay());
        setPlayStorageKey(nextStorageKey);
      }
      setGuess("");
      setMessage("");
      setBusy(false);
      setConfirmReveal(false);
      setNextPuzzleCountdown("");
      setShareOpen(false);
      setShareState("idle");
      setNativeSharingAvailable(typeof navigator.share === "function");
      setRating(null);
      setComment("");
      setFeedbackState("idle");
      setHydratedPuzzleId(puzzle.id);
    }, 0);
    return () => window.clearTimeout(task);
  }, [challengeBenchmark, puzzle, resumePractice]);

  useEffect(() => {
    if (hydratedPuzzleId === puzzle.id && playStorageKey) {
      localStorage.setItem(playStorageKey, JSON.stringify(play));
    }
  }, [hydratedPuzzleId, play, playStorageKey, puzzle.id]);

  useEffect(() => {
    if (puzzle.context !== "daily") return;
    if (getActiveMode(sessionStorage) !== "practice") return;
    const progress = restorePracticeProgress(localStorage, Number.MAX_SAFE_INTEGER);
    window.location.replace(`/practice?puzzle=${progress.position}`);
  }, [puzzle.context]);

  useEffect(() => {
    if (
      hydratedPuzzleId === puzzle.id &&
      play.outcome === "playing" &&
      window.matchMedia("(pointer: fine)").matches
    ) {
      inputRef.current?.focus();
    }
  }, [hydratedPuzzleId, play.outcome, puzzle.id]);

  useEffect(() => {
    if (!shareOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShareOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => sharePanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [shareOpen]);

  useEffect(() => {
    if (!isFinished || puzzle.context !== "daily") return;
    const nextLaunchAt = getNextPuzzleLaunchAt();

    const updateCountdown = () => {
      const currentTime = Date.now();
      if (currentTime >= nextLaunchAt) {
        window.location.replace("/");
        return;
      }
      setNextPuzzleCountdown(formatTimeUntilPuzzleLaunch(currentTime, nextLaunchAt));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(interval);
  }, [isFinished, puzzle.context]);

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
        body: JSON.stringify({ puzzleId: puzzle.id, pool: puzzle.pool, guess: trimmed }),
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
        body: JSON.stringify({ puzzleId: puzzle.id, pool: puzzle.pool, hintIndex: play.hints.length }),
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
        body: JSON.stringify({ puzzleId: puzzle.id, pool: puzzle.pool }),
      });
      const data = (await response.json()) as { resolution?: Resolution };
      if (data.resolution) {
        setPlay((current) => ({
          ...current,
          outcome: "revealed",
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

  function switchMode(mode: "daily" | "practice") {
    sessionStorage.setItem(ACTIVE_MODE_KEY, mode);
    if (mode === "daily") {
      window.location.replace("/");
      return;
    }
    const progress = restorePracticeProgress(localStorage, Number.MAX_SAFE_INTEGER);
    window.location.replace(`/practice?puzzle=${progress.position}`);
  }

  function advancePractice() {
    const wraps = puzzle.sequenceNumber >= puzzle.sequenceLength;
    const nextProgress = {
      position: wraps ? 1 : puzzle.sequenceNumber + 1,
      cycle: wraps ? practiceProgress.cycle + 1 : practiceProgress.cycle,
    };
    localStorage.setItem(PRACTICE_PROGRESS_KEY, JSON.stringify(nextProgress));
    sessionStorage.setItem(ACTIVE_MODE_KEY, "practice");
    window.location.replace(`/practice?puzzle=${nextProgress.position}`);
  }

  function returnToPractice() {
    const progress = restorePracticeProgress(localStorage, Number.MAX_SAFE_INTEGER);
    sessionStorage.setItem(ACTIVE_MODE_KEY, "practice");
    window.location.replace(`/practice?puzzle=${progress.position}`);
  }

  function shareUrl() {
    if (puzzle.pool === "daily") return new URL("/", window.location.origin).toString();
    const url = new URL("/practice", window.location.origin);
    url.searchParams.set("challenge", String(puzzle.sequenceNumber));
    if (play.outcome !== "playing") {
      url.searchParams.set("outcome", play.outcome);
      url.searchParams.set("guesses", String(play.guessCount));
      url.searchParams.set("hints", String(play.hints.length));
    }
    return url.toString();
  }

  function shareText() {
    if (puzzle.pool === "practice") {
      if (play.outcome === "playing") {
        return "Can you solve this Emojizzle practice puzzle?";
      }
      const result = `${play.guessCount} ${play.guessCount === 1 ? "guess" : "guesses"} and ${play.hints.length} ${play.hints.length === 1 ? "hint" : "hints"}`;
      return play.outcome === "solved"
        ? `I solved an Emojizzle practice puzzle in ${result}. Can you beat my result?`
        : `I revealed an Emojizzle practice puzzle after ${result}. Can you solve it?`;
    }
    if (play.outcome === "playing") {
      return "Can you decode today’s Emojizzle?";
    }
    const solved = play.outcome === "solved";
    return [
      `Emojizzle #${puzzle.dateCode}`,
      `${solved ? "🟩 Solved" : "⬜ Revealed"} · ${play.guessCount} ${play.guessCount === 1 ? "guess" : "guesses"} · ${play.hints.length} ${play.hints.length === 1 ? "hint" : "hints"}`,
      "Can you decode today’s puzzle?",
    ].join("\n");
  }

  function openShareSheet() {
    setShareState("idle");
    setShareOpen(true);
  }

  async function shareWithDevice() {
    if (!navigator.share) return;

    try {
      await navigator.share({
        title: puzzle.pool === "practice"
          ? "Emojizzle Practice"
          : `Emojizzle #${puzzle.dateCode}`,
        text: shareText(),
        url: shareUrl(),
      });
      setShareState("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareState("error");
    }
  }

  async function copyShareLink() {
    try {
      const url = shareUrl();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = url;
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) throw new Error("copy failed");
      }
      setShareState("copied");
    } catch {
      setShareState("error");
    }
  }

  function shareByMessage() {
    window.location.href = `sms:?&body=${encodeURIComponent(`${shareText()}\n${shareUrl()}`)}`;
  }

  function shareByEmail() {
    const subject = encodeURIComponent(
      puzzle.pool === "practice"
        ? "Try Emojizzle Practice"
        : `Try Emojizzle #${puzzle.dateCode}`,
    );
    const body = encodeURIComponent(`${shareText()}\n\n${shareUrl()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function getAnonymousSessionId() {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = createId();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  async function submitFeedback(nextRating: "up" | "down", nextComment: string) {
    if (feedbackState === "sending" || feedbackState === "sent") return;
    setRating(nextRating);
    setFeedbackState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating: nextRating,
          comment: puzzle.pool === "practice" ? "" : nextComment,
          pool: puzzle.pool,
          ...feedbackPlayFields(puzzle, play),
          anonymousSessionId: getAnonymousSessionId(),
          metadata: {
            playedDateUtc: new Date().toISOString().slice(0, 10),
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

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    if (!rating) return;
    await submitFeedback(rating, comment);
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => switchMode("daily")} aria-label="Emojizzle home">
          <KnowingMark size={42} className="header-brand-mark" />
          <BrandWordmark />
        </button>
        <div className="topbar-actions">
          <button className="topbar-share" type="button" onClick={openShareSheet} aria-label="Share Emojizzle">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V3" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            <span>Share</span>
          </button>
          <div className="day-pill">
            {puzzle.pool === "practice"
              ? "PRACTICE"
              : puzzle.context === "daily"
                ? `PUZZLE #${puzzle.dateCode}`
                : `TEST #${puzzle.number}`}
          </div>
        </div>
      </header>

      <nav className="mode-switch" aria-label="Game mode">
        <button
          type="button"
          className={puzzle.pool === "daily" ? "selected" : ""}
          aria-current={puzzle.pool === "daily" ? "page" : undefined}
          onClick={() => switchMode("daily")}
        >
          Daily
        </button>
        <button
          type="button"
          className={puzzle.pool === "practice" ? "selected" : ""}
          aria-current={puzzle.pool === "practice" ? "page" : undefined}
          onClick={() => switchMode("practice")}
        >
          Practice
        </button>
      </nav>

      {!isFinished ? (
        <section className="play-card" aria-labelledby="puzzle-title">
          <div className="eyebrow">
            {puzzle.context === "challenge"
              ? "Practice challenge"
              : puzzle.pool === "practice"
                ? "Practice puzzle"
                : puzzle.context === "daily"
                  ? "Today’s puzzle"
                  : "Author test"}
          </div>
          <h1 id="puzzle-title">What do these mean?</h1>
          <p className="intro">
            {puzzle.context === "challenge"
              ? challengeBenchmark?.outcome === "revealed"
                ? "A friend revealed this one. Can you solve it?"
                : "A friend challenged you to beat their result."
              : "It could be a phrase, person, story—or something else entirely."}
          </p>

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
                <p>Give up and reveal {puzzle.pool === "practice" ? "this practice" : "today’s"} answer?</p>
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
          <div className="result-brand-mark" aria-hidden="true"><KnowingMark size={48} /></div>
          <div className="result-kicker">{play.outcome === "solved" ? "Aha—you got it!" : "Here’s the answer"}</div>
          <div className="result-emoji" aria-hidden="true">{puzzle.emoji}</div>
          <div className="category-pill">{play.resolution?.category}</div>
          <h1 id="result-title">{play.resolution?.answer}</h1>
          <p className="explanation">{play.resolution?.explanation}</p>

          <div className="result-stats" aria-label="Your result">
            <div><strong>{play.guessCount}</strong><span>{play.guessCount === 1 ? "guess" : "guesses"}</span></div>
            <div><strong>{play.hints.length}</strong><span>{play.hints.length === 1 ? "hint" : "hints"}</span></div>
          </div>

          {puzzle.context === "challenge" && challengeBenchmark && (
            <div className="challenge-comparison" aria-label="Challenge result comparison">
              <div>
                <span>Friend’s result</span>
                <strong>{challengeBenchmark.outcome === "solved" ? "Solved" : "Revealed"}</strong>
                <small>{challengeBenchmark.guessCount} guesses · {challengeBenchmark.hintCount} hints</small>
              </div>
              <div>
                <span>Your result</span>
                <strong>{play.outcome === "solved" ? "Solved" : "Revealed"}</strong>
                <small>{play.guessCount} guesses · {play.hints.length} hints</small>
              </div>
            </div>
          )}

          <button className="share-button" type="button" onClick={openShareSheet}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V3" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
            Share result
          </button>
          {puzzle.context === "practice" ? (
            <button className="next-button" type="button" onClick={advancePractice}>
              Next puzzle <span aria-hidden="true">→</span>
            </button>
          ) : puzzle.context === "challenge" ? (
            <button className="next-button" type="button" onClick={returnToPractice}>
              Back to your practice <span aria-hidden="true">→</span>
            </button>
          ) : puzzle.context === "author-test" && nextPuzzleNumber ? (
            <Link className="next-button" href={`/next?puzzle=${nextPuzzleNumber}`}>
              Next puzzle <span aria-hidden="true">→</span>
            </Link>
          ) : puzzle.context === "daily" ? (
            <div className="next-release">
              <span>Next puzzle arrives in</span>
              <strong role="timer">{nextPuzzleCountdown || "…"}</strong>
            </div>
          ) : null}

          <aside className="feedback-card">
            {play.feedbackSent || feedbackState === "sent" ? (
              <div className="feedback-thanks">
                <span aria-hidden="true">✓</span>
                <div><strong>Feedback saved</strong><p>This is how the puzzles get better.</p></div>
              </div>
            ) : puzzle.pool === "practice" ? (
              <div className="feedback-topline">
                <div><strong>How was this puzzle?</strong><p>A quick rating helps tune Practice.</p></div>
                <div className="rating-buttons" role="group" aria-label="Rate this puzzle">
                  <button type="button" onClick={() => submitFeedback("up", "")} aria-label="Good puzzle" disabled={feedbackState === "sending"}>👍</button>
                  <button type="button" onClick={() => submitFeedback("down", "")} aria-label="Needs work" disabled={feedbackState === "sending"}>👎</button>
                </div>
                {feedbackState === "error" && <p className="feedback-error">Couldn’t save that. Please try again.</p>}
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

      {shareOpen && (
        <div className="share-overlay" role="presentation" onPointerDown={(event) => {
          if (event.target === event.currentTarget) setShareOpen(false);
        }}>
          <div className="share-sheet" ref={sharePanelRef} role="dialog" aria-modal="true" aria-labelledby="share-title">
            <div className="share-handle" aria-hidden="true" />
            <div className="share-heading">
              <div>
                <div className="eyebrow">Invite someone</div>
                <h2 id="share-title">Share {puzzle.pool === "practice" ? "this practice puzzle" : "today’s puzzle"}</h2>
              </div>
              <button className="share-close" type="button" onClick={() => setShareOpen(false)} aria-label="Close share options">×</button>
            </div>
            <p className="share-description">
              {puzzle.pool === "practice"
                ? "The link opens this exact puzzle as a standalone challenge. The answer and emojis stay private."
                : "The link opens the daily puzzle. Your answer and emojis stay private."}
            </p>
            <div className="share-options">
              <button type="button" onClick={shareByMessage}><span aria-hidden="true">💬</span><strong>Messages</strong></button>
              <button type="button" onClick={shareByEmail}><span aria-hidden="true">✉️</span><strong>Email</strong></button>
              <button type="button" onClick={copyShareLink}><span aria-hidden="true">🔗</span><strong>Copy link</strong></button>
              {nativeSharingAvailable && (
                <button type="button" onClick={shareWithDevice}><span aria-hidden="true">•••</span><strong>More apps</strong></button>
              )}
            </div>
            <p className="share-status" aria-live="polite">
              {shareState === "copied" && "Emojizzle link copied!"}
              {shareState === "shared" && "Thanks for sharing!"}
              {shareState === "error" && "Couldn’t share this time. Please try again."}
            </p>
          </div>
        </div>
      )}

      <footer>
        <span>Looks obvious. Eventually.</span>
        <span aria-hidden="true">No account · No feed · Just the puzzle</span>
      </footer>
    </main>
  );
}
