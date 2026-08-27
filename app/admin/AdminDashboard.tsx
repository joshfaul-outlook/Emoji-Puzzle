"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  const [moving, setMoving] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const load = useCallback(async () => {
    setError("");
    const session = await fetch("/api/manage/session", { cache: "no-store" });
    if (!session.ok || !(await session.json() as { authenticated?: boolean }).authenticated) { setAuth("signed-out"); return; }
    const response = await fetch("/api/manage/puzzles", { cache: "no-store" });
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
  }).sort((a, b) => a.pool.localeCompare(b.pool) || a.position - b.position || a.number - b.number), [pool, puzzles, query, status]);
  const canReorder = !moving;

  async function movePuzzle(id: string, targetId: string, dropAfter = false) {
    if (!canReorder || id === targetId || moving) return;
    const source = puzzles.find((item) => item.id === id); const target = puzzles.find((item) => item.id === targetId);
    if (!source || !target || source.pool !== target.pool) return;
    const siblings = puzzles.filter((item) => item.pool === source.pool).sort((a, b) => a.position - b.position || a.number - b.number);
    const from = siblings.findIndex((item) => item.id === id); const to = siblings.findIndex((item) => item.id === targetId);
    const targetPosition = source.position < target.position ? target.position - 1 : target.position;
    const requestedPosition = targetPosition + (dropAfter ? 1 : 0);
    const next = siblings.filter((item) => item.id !== id); next.splice(Math.max(0, Math.min(next.length, requestedPosition - 1)), 0, source);
    const nextPuzzles = puzzles.map((item) => { const index = next.findIndex((entry) => entry.id === item.id); return index >= 0 ? { ...item, position: index + 1 } : item; });
    setPuzzles(nextPuzzles); setMoving(id); setError("");
    try {
      const response = await fetch(`/api/manage/puzzles/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json", "if-match": source.etag }, body: JSON.stringify({ position: requestedPosition }) });
      if (!response.ok) throw new Error(response.status === 409 ? "Someone else changed this puzzle. Reload before moving it." : "The move could not be saved.");
      await load();
    } catch (moveError) { setPuzzles(puzzles); setError(moveError instanceof Error ? moveError.message : "The move could not be saved."); }
    finally { setMoving(null); }
    void from; void to;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const source = puzzles.find((item) => item.id === active.id);
    const target = puzzles.find((item) => item.id === over.id);
    if (!source || !target || source.pool !== target.pool) return;
    const activeRect = active.rect.current.translated ?? active.rect.current.initial;
    const dropAfter = Boolean(activeRect && over.rect && activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2);
    void movePuzzle(String(active.id), String(over.id), dropAfter);
  }

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
      <p className="reorder-help" role="status">Drag any handle to reorder within its pool; moves save automatically.</p>
      <p className="results-count" aria-live="polite">Showing {visible.length} puzzles</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible.map((puzzle) => puzzle.id)} strategy={verticalListSortingStrategy}>
          <section className="puzzle-list" aria-label="Puzzle catalog">
            {visible.map((puzzle) => <SortablePuzzleRow key={puzzle.id} puzzle={puzzle} disabled={!canReorder} returnTo={`${window.location.pathname}${window.location.search}`} />)}
          </section>
        </SortableContext>
      </DndContext>
    </main>
  );
}

function SortablePuzzleRow({ puzzle, disabled, returnTo }: { puzzle: AdminPuzzle; disabled: boolean; returnTo: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: puzzle.id, disabled });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`puzzle-row ${isDragging ? "is-moving" : ""}`}>
    <button className="drag-handle" type="button" aria-label={`Drag ${puzzle.answer} to reorder`} disabled={disabled} {...attributes} {...listeners}>⠿</button>
    <a className="puzzle-row-link" href={`/admin/puzzle/?id=${encodeURIComponent(puzzle.id)}&returnTo=${encodeURIComponent(returnTo)}`}>
      <span className="puzzle-number"><strong>{puzzle.pool === "daily" ? "Daily" : "Practice"} {puzzle.position}</strong><small>Catalog #{puzzle.number}</small></span><span className="puzzle-row-emoji" aria-hidden="true">{puzzle.emoji}</span>
      <span className="puzzle-row-main"><strong>{puzzle.answer}</strong><small>{puzzle.category} · {puzzle.pool}</small></span>
      <span className={`status-badge ${puzzle.status}`}>{puzzle.status}</span><span className="row-arrow" aria-hidden="true">›</span>
    </a>
  </div>;
}
