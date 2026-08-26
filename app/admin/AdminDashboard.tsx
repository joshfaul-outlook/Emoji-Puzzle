"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminPuzzle, PuzzleStatus } from "../../lib/admin-types";
import { AdminHeader } from "./AdminHeader";
import { AdminLogin } from "./AdminLogin";

export function AdminDashboard() {
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [auth, setAuth] = useState<"loading" | "signed-in" | "signed-out">("loading");
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState("all");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/puzzles", { cache: "no-store" });
    if (response.status === 401) { setAuth("signed-out"); return; }
    if (!response.ok) { setError("Puzzles could not be loaded."); setAuth("signed-in"); return; }
    const data = await response.json() as { puzzles: AdminPuzzle[] };
    setPuzzles(data.puzzles);
    setAuth("signed-in");
  }, []);

  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);

  const visible = useMemo(() => puzzles.filter((puzzle) => {
    const text = `${puzzle.number} ${puzzle.answer} ${puzzle.emoji} ${puzzle.category}`.toLocaleLowerCase();
    return (!query || text.includes(query.toLocaleLowerCase())) &&
      (pool === "all" || puzzle.pool === pool) &&
      (status === "all" || (status === "active" ? puzzle.status !== "archived" : puzzle.status === status));
  }), [pool, puzzles, query, status]);

  if (auth === "loading") return <main className="utility-page" aria-busy="true"><h1>Opening admin…</h1></main>;
  if (auth === "signed-out") return <AdminLogin onSuccess={() => void load()} />;

  return (
    <main className="admin-shell">
      <AdminHeader title="Puzzles" />
      <section className="admin-toolbar">
        <div><p className="admin-eyebrow">Puzzle catalog</p><h1>Shape the next “aha.”</h1><p>{puzzles.length} puzzles in Azure Table Storage</p></div>
        <div className="admin-toolbar-actions"><a className="secondary-button" href="/admin/feedback/">Feedback</a><a className="primary-button admin-primary" href="/admin/puzzle/">New puzzle</a></div>
      </section>
      <section className="admin-filters" aria-label="Puzzle filters">
        <label><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Answer, emoji, category…" /></label>
        <label><span>Pool</span><select value={pool} onChange={(event) => setPool(event.target.value)}><option value="all">All pools</option><option value="daily">Daily</option><option value="practice">Practice</option></select></label>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="all">All</option>{(["draft", "published", "archived"] as PuzzleStatus[]).map((value) => <option key={value}>{value}</option>)}</select></label>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="results-count" aria-live="polite">Showing {visible.length} puzzles</p>
      <section className="puzzle-list" aria-label="Puzzle catalog">
        {visible.map((puzzle) => (
          <a className="puzzle-row" href={`/admin/puzzle/?id=${encodeURIComponent(puzzle.id)}`} key={puzzle.id}>
            <span className="puzzle-number">#{puzzle.number}</span><span className="puzzle-row-emoji" aria-hidden="true">{puzzle.emoji}</span>
            <span className="puzzle-row-main"><strong>{puzzle.answer}</strong><small>{puzzle.category} · {puzzle.pool}</small></span>
            <span className={`status-badge ${puzzle.status}`}>{puzzle.status}</span><span className="row-arrow" aria-hidden="true">›</span>
          </a>
        ))}
      </section>
    </main>
  );
}
