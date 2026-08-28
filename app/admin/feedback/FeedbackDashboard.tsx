"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeedbackItem } from "../../../lib/admin-types";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";

export function FeedbackDashboard() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [auth, setAuth] = useState<"loading" | "signed-in" | "signed-out">("loading");
  const [pool, setPool] = useState("all");
  const [rating, setRating] = useState("all");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const session = await fetch("/api/manage/session", { cache: "no-store" });
    if (!session.ok || !(await session.json() as { authenticated?: boolean }).authenticated) { setAuth("signed-out"); return; }
    const response = await fetch("/api/manage/feedback?limit=250", { cache: "no-store" });
    if (!response.ok) { setError("Feedback could not be loaded."); setAuth("signed-in"); return; }
    setItems((await response.json() as { feedback: FeedbackItem[] }).feedback); setAuth("signed-in");
  }, []);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  const visible = useMemo(() => items.filter((item) => (pool === "all" || item.puzzlePool === pool) && (rating === "all" || item.rating === rating)), [items, pool, rating]);
  const positive = visible.length ? Math.round(visible.filter((item) => item.rating === "up").length / visible.length * 100) : 0;

  if (auth === "loading") return <main className="utility-page" aria-busy="true"><h1>Loading feedback…</h1></main>;
  if (auth === "signed-out") return <AdminLogin onSuccess={() => void load()} />;
  return (
    <main className="admin-shell">
      <AdminHeader title="Feedback" />
      <section className="admin-toolbar"><div><a className="back-link" href="/admin/">← Puzzles</a><p className="admin-eyebrow">Player signals</p><h1>What landed?</h1></div></section>
      <section className="feedback-summary" aria-label="Feedback summary"><div><strong>{visible.length}</strong><span>Responses</span></div><div><strong>{positive}%</strong><span>Positive</span></div><div><strong>{visible.filter((item) => item.comment).length}</strong><span>Written notes</span></div></section>
      <section className="admin-filters compact"><label><span>Pool</span><select value={pool} onChange={(e) => setPool(e.target.value)}><option value="all">All pools</option><option value="daily">Daily</option><option value="practice">Practice</option></select></label><label><span>Rating</span><select value={rating} onChange={(e) => setRating(e.target.value)}><option value="all">All ratings</option><option value="down">Thumbs down</option><option value="up">Thumbs up</option></select></label></section>
      {error && <p className="form-error">{error}</p>}
      <section className="feedback-list">
        {visible.map((item) => <article className="feedback-item" key={item.id}><div className={`rating-mark ${item.rating}`} aria-label={item.rating === "up" ? "Thumbs up" : "Thumbs down"}>{item.rating === "up" ? "👍" : "👎"}</div><div><div className="feedback-meta"><strong>Puzzle #{item.puzzleNumber}</strong><span>{item.puzzlePool}</span><span className="player-name">{item.displayName || "Anonymous"}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.comment || <em>No written comment</em>}</p><small>{item.outcome} · {item.guessCount} guesses · {item.hintCount} hints</small></div></article>)}
        {!visible.length && <div className="empty-state"><span>💬</span><h2>No feedback here yet</h2><p>New player responses will appear automatically.</p></div>}
      </section>
    </main>
  );
}
