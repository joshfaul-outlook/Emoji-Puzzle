"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Clue = { id: string; version: number; priority: number; title: string; copy: string };
type Guidance = { register: (clue: Clue) => () => void; active: string | null; open: (id: string, restoreFocus?: boolean) => void; dismiss: (id: string, version: number) => void; close: () => void };
const ClueContext = createContext<Guidance | null>(null);
const storageKey = "emojizzle.clue-tags:v1";
let memoryDismissals: Record<string, number> = {};

function dismissals() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return value && typeof value === "object" ? value as Record<string, number> : memoryDismissals;
  } catch { return memoryDismissals; }
}

export function ClueTagProvider({ children }: { children: ReactNode }) {
  const [clues, setClues] = useState<Clue[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const automaticallyOpened = useRef(false);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const open = useCallback((id: string, shouldRestoreFocus = false) => {
    if (shouldRestoreFocus) restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActive(id);
  }, []);
  const close = useCallback(() => {
    setActive(null);
    const target = restoreFocus.current; restoreFocus.current = null; target?.focus();
  }, []);
  const dismiss = useCallback((id: string, version: number) => {
    memoryDismissals = { ...dismissals(), [id]: version };
    try { window.localStorage.setItem(storageKey, JSON.stringify(memoryDismissals)); } catch { /* Memory fallback keeps the hint optional. */ }
    close();
  }, [close]);
  const register = useCallback((clue: Clue) => {
    setClues((current) => [...current.filter((item) => item.id !== clue.id), clue]);
    return () => setClues((current) => current.filter((item) => item.id !== clue.id));
  }, []);
  useEffect(() => {
    if (automaticallyOpened.current || active || !clues.length) return;
    const next = clues.filter((clue) => dismissals()[clue.id] !== clue.version).sort((a, b) => a.priority - b.priority)[0];
    if (!next) return;
    const task = window.setTimeout(() => { automaticallyOpened.current = true; setActive(next.id); }, 0);
    return () => window.clearTimeout(task);
  }, [active, clues]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && active) { event.preventDefault(); close(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [active, close]);
  const value = useMemo<Guidance>(() => ({ register, active, open, dismiss, close }), [active, close, dismiss, open, register]);
  return <ClueContext.Provider value={value}>{children}<ClueMenu clues={clues} /></ClueContext.Provider>;
}

function ClueMenu({ clues }: { clues: Clue[] }) {
  const guidance = useContext(ClueContext)!;
  const [expanded, setExpanded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !expanded) return;
      event.preventDefault(); setExpanded(false); button.current?.focus();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [expanded]);
  if (!clues.length) return null;
  return <div className="clue-help"><button ref={button} type="button" className="clue-help-button" aria-label={expanded ? "Close player help" : "Open player help"} aria-expanded={expanded} aria-controls="clue-help-topics" onClick={() => setExpanded((value) => !value)}>?</button>{expanded && <div className="clue-help-menu" id="clue-help-topics" role="group" aria-label="Player choices help">{[...clues].sort((a, b) => a.priority - b.priority).map((clue) => <button type="button" key={clue.id} onClick={() => { setExpanded(false); guidance.open(clue.id, true); }}>{clue.title}</button>)}</div>}</div>;
}

export function ClueTag({ id, title, copy, priority, version = 1, children }: { id: string; title: string; copy: string; priority: number; version?: number; children: ReactNode }) {
  const guidance = useContext(ClueContext);
  const clue = useMemo<Clue>(() => ({ id, title, copy, priority, version }), [copy, id, priority, title, version]);
  useEffect(() => guidance?.register(clue), [clue, guidance]);
  if (!guidance) return <>{children}</>;
  const isOpen = guidance.active === id;
  const noteId = `clue-${id}`;
  return <div className="clue-target">{children}<button className="clue-tag-button" type="button" aria-label={`Learn more: ${title}`} aria-expanded={isOpen} aria-controls={noteId} onClick={() => guidance.open(id, true)}>✦</button>{isOpen && <aside id={noteId} className="clue-tag" role="note" aria-live="polite" tabIndex={-1}><span className="clue-tag-cord" aria-hidden="true" /><span className="clue-tag-mark" aria-hidden="true">✦</span><div><strong>{title}</strong><p>{copy}</p><button type="button" className="clue-tag-dismiss" onClick={() => guidance.dismiss(id, version)}>Got it</button></div></aside>}</div>;
}
