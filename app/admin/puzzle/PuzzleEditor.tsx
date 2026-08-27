"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminPuzzle, PuzzleStatus, PuzzleStructure } from "../../../lib/admin-types";
import { AdminHeader } from "../AdminHeader";
import { AdminLogin } from "../AdminLogin";
import { EmojiSearch } from "./EmojiSearch";

const blank: AdminPuzzle = { id: "", number: 0, pool: "practice", position: 0, status: "draft", emoji: "", answer: "", acceptedAnswers: [], category: "", structure: "literal", hints: ["", "", ""], explanation: "", createdAt: "", updatedAt: "", etag: "" };

export function PuzzleEditor() {
  const [puzzle, setPuzzle] = useState<AdminPuzzle>(blank);
  const [auth, setAuth] = useState<"loading" | "signed-in" | "signed-out">("loading");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [loadedPosition, setLoadedPosition] = useState(0);

  const load = useCallback(async () => {
    if (id === null) return;
    if (!id) { setPuzzle(blank); setAuth("signed-in"); return; }
    const response = await fetch(`/api/manage/puzzles/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (response.status === 401) { setAuth("signed-out"); return; }
    if (!response.ok) { setError("This puzzle could not be loaded."); setAuth("signed-in"); return; }
    const loaded = await response.json() as AdminPuzzle;
    setPuzzle(loaded);
    setLoadedPosition(loaded.position);
    setDirty(false);
    setAuth("signed-in");
  }, [id]);

  useEffect(() => { const task = window.setTimeout(() => setId(new URLSearchParams(window.location.search).get("id") ?? ""), 0); return () => window.clearTimeout(task); }, []);
  useEffect(() => { if (id === null) return; const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [id, load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof AdminPuzzle>(key: K, value: AdminPuzzle[K]) {
    setPuzzle((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice("");
  }

  async function save(event?: FormEvent, requestedStatus?: PuzzleStatus) {
    event?.preventDefault();
    const next = { ...puzzle, status: requestedStatus ?? puzzle.status, acceptedAnswers: Array.from(new Set([puzzle.answer, ...puzzle.acceptedAnswers].map((value) => value.trim()).filter(Boolean))) };
    if (requestedStatus === "published" && !window.confirm("Publish this puzzle to the live catalog?")) return;
    if (!requestedStatus && id && puzzle.status === "published" && !window.confirm("Save these changes to the live puzzle?")) return;
    if (id && puzzle.pool === "daily" && loadedPosition > 0 && next.position !== loadedPosition && !window.confirm("Change this puzzle’s position in the Daily rotation?")) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(id ? `/api/manage/puzzles/${encodeURIComponent(id)}` : "/api/manage/puzzles", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json", ...(id && puzzle.etag ? { "if-match": puzzle.etag } : {}) },
      body: JSON.stringify(next),
    });
    setBusy(false);
    const data = await response.json().catch(() => ({})) as AdminPuzzle & { error?: string };
    if (!response.ok) { setError(response.status === 409 ? "Someone else changed this puzzle. Reload before saving again." : data.error ?? "The puzzle could not be saved."); return; }
    setPuzzle(data); setLoadedPosition(data.position); setDirty(false); setNotice("Saved");
    if (!id) { window.history.replaceState(null, "", `/admin/puzzle/?id=${encodeURIComponent(data.id)}`); setId(data.id); }
  }

  async function archive() {
    if (!id || !window.confirm("Archive this puzzle? It will leave the playable catalog.")) return;
    setBusy(true);
    const response = await fetch(`/api/manage/puzzles/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "if-match": puzzle.etag } });
    setBusy(false);
    if (!response.ok) { setError("The puzzle could not be archived."); return; }
    setPuzzle(await response.json() as AdminPuzzle); setDirty(false); setNotice("Archived");
  }

  if (auth === "loading") return <main className="utility-page" aria-busy="true"><h1>Opening editor…</h1></main>;
  if (auth === "signed-out") return <AdminLogin onSuccess={() => void load()} />;

  return (
    <main className="admin-shell editor-shell">
      <AdminHeader title={id ? `Puzzle #${puzzle.number}` : "New puzzle"} />
      <form className="puzzle-editor" onSubmit={(event) => void save(event)}>
        <div className="editor-title"><div><a className="back-link" href="/admin/">← All puzzles</a><p className="admin-eyebrow">{id ? `${puzzle.pool} · ${puzzle.status}` : "New draft"}</p><h1>{puzzle.answer || "Untitled puzzle"}</h1></div><div className="live-preview"><span>{puzzle.emoji || "✨  ❓"}</span><small>Player preview</small></div></div>
        <section className="editor-card">
          <h2>Puzzle</h2>
          <div className="field-grid two"><label><span>Answer</span><input value={puzzle.answer} onChange={(e) => update("answer", e.target.value)} required /></label><label><span>Emoji sequence</span><div className="input-action"><input value={puzzle.emoji} onChange={(e) => update("emoji", e.target.value)} /><button type="button" onClick={() => setShowEmoji(true)}>Find emoji</button></div></label></div>
          <div className="field-grid two"><label><span>Pool</span><select value={puzzle.pool} onChange={(e) => update("pool", e.target.value as AdminPuzzle["pool"])}><option value="daily">Daily</option><option value="practice">Practice</option></select></label><label><span>Structure</span><select value={puzzle.structure} onChange={(e) => update("structure", e.target.value as PuzzleStructure)}>{["literal", "idiom", "rebus", "person", "story", "movie", "historical", "interpretive"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          {puzzle.pool === "daily" && id && <label><span>Daily position</span><input type="number" min="1" value={puzzle.position || 1} onChange={(e) => update("position", Math.max(1, Number.parseInt(e.target.value, 10) || 1))} /></label>}
          <label><span>Category</span><input value={puzzle.category} onChange={(e) => update("category", e.target.value)} /></label>
          <label><span>Accepted answers <small>one per line</small></span><textarea rows={5} value={puzzle.acceptedAnswers.join("\n")} onChange={(e) => update("acceptedAnswers", e.target.value.split("\n"))} /></label>
        </section>
        <section className="editor-card"><h2>Progressive hints</h2>{[0,1,2].map((index) => <label key={index}><span>Hint {index + 1}</span><input value={puzzle.hints[index] ?? ""} onChange={(e) => { const hints = [...puzzle.hints]; hints[index] = e.target.value; update("hints", hints); }} /></label>)}</section>
        <section className="editor-card"><h2>The reveal</h2><label><span>Explanation</span><textarea rows={5} value={puzzle.explanation} onChange={(e) => update("explanation", e.target.value)} /></label></section>
        {showEmoji && <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Emoji search"><div className="emoji-sheet"><button className="sheet-close" type="button" onClick={() => setShowEmoji(false)} aria-label="Close emoji search">×</button><EmojiSearch phrase={puzzle.answer} value={puzzle.emoji} onChange={(value) => update("emoji", value)} /></div></div>}
        <div className="editor-actions">
          <a className="secondary-button" href="/admin/">Cancel</a>
          {id && puzzle.status !== "archived" && <button className="danger-button" type="button" disabled={busy} onClick={() => void archive()}>Archive</button>}
          {puzzle.status === "archived" && <button className="secondary-button" type="button" disabled={busy} onClick={() => void save(undefined, "draft")}>Restore draft</button>}
          <button className="secondary-button" type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : puzzle.status === "published" ? "Save changes" : "Save draft"}</button>
          <button className="primary-button admin-primary" type="button" disabled={busy} onClick={() => void save(undefined, "published")}>Publish</button>
          <span className="save-notice" aria-live="polite">{notice}</span>
        </div>
        {error && <p className="form-error sticky-error" role="alert">{error}</p>}
      </form>
    </main>
  );
}
