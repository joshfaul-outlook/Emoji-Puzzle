"use client";

import { useMemo, useState } from "react";
import emojiData from "emojibase-data/en/data.json";

type EmojiEntry = { emoji: string; label: string; tags?: string[] };
const entries = emojiData as EmojiEntry[];
const stopWords = new Set(["a", "an", "and", "at", "for", "from", "in", "is", "it", "of", "on", "or", "the", "to", "with"]);

function matches(entry: EmojiEntry, term: string) {
  const words = `${entry.label} ${(entry.tags ?? []).join(" ")}`.toLocaleLowerCase();
  if (words === term) return 0;
  if (words.split(/\s+/).includes(term)) return 1;
  return words.includes(term) ? 2 : 99;
}

function suggestionFor(phrase: string) {
  const terms = phrase.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !stopWords.has(word));
  const selected: string[] = [];
  for (const term of terms) {
    const found = entries
      .map((entry) => ({ entry, score: matches(entry, term) }))
      .filter(({ score }) => score < 99)
      .sort((left, right) => left.score - right.score)[0]?.entry;
    if (found && !selected.includes(found.emoji)) selected.push(found.emoji);
    if (selected.length === 6) break;
  }
  return selected.join("  ");
}

export function EmojiSearch({ phrase, value, onChange }: { phrase: string; value: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const [previous, setPrevious] = useState<string | null>(null);
  const [copyState, setCopyState] = useState("");
  const suggested = useMemo(() => suggestionFor(phrase), [phrase]);
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return entries.slice(0, 48);
    return entries.map((entry) => ({ entry, score: matches(entry, term) })).filter(({ score }) => score < 99).sort((a, b) => a.score - b.score).slice(0, 60).map(({ entry }) => entry);
  }, [query]);

  function useSuggested() {
    setPrevious(value);
    onChange(suggested);
  }

  async function copySuggested() {
    if (!suggested) return;
    await navigator.clipboard.writeText(suggested);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(""), 1500);
  }

  return (
    <section className="emoji-helper" aria-labelledby="emoji-helper-title">
      <div className="emoji-helper-heading"><div><p className="admin-eyebrow">Emoji helper</p><h2 id="emoji-helper-title">Find the clearest clues</h2></div></div>
      <div className="suggestion-card">
        <span>Suggested for “{phrase || "your answer"}”</span>
        <strong>{suggested || "Add a phrase to see suggestions"}</strong>
        <div className="suggestion-actions">
          <button type="button" onClick={useSuggested} disabled={!suggested}>Use suggested</button>
          <button type="button" onClick={copySuggested} disabled={!suggested}>{copyState || "Copy"}</button>
          {previous !== null && <button type="button" onClick={() => { onChange(previous); setPrevious(null); }}>Undo</button>}
        </div>
      </div>
      <label className="emoji-search-label"><span>Search emoji by keyword</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try rain, movie, heart…" /></label>
      <div className="emoji-grid" aria-label="Emoji search results">
        {results.map((entry) => <button type="button" key={`${entry.emoji}-${entry.label}`} title={entry.label} aria-label={`Add ${entry.label}`} onClick={() => onChange(`${value}${value ? "  " : ""}${entry.emoji}`)}>{entry.emoji}</button>)}
        {!results.length && <p>No emoji matched that keyword.</p>}
      </div>
    </section>
  );
}
