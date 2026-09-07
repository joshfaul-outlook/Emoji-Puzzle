"use client";

import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import emojiData from "emojibase-data/en/data.json";
import { dismissAdminKeyboard, emojiTokens, normalizeEmojiSequence } from "../../../lib/admin-ui";

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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const suggested = useMemo(() => suggestionFor(phrase), [phrase]);
  const sequence = useMemo(() => emojiTokens(value), [value]);
  const sequenceIds = useMemo(() => {
    const occurrences = new Map<string, number>();
    return sequence.map((emoji) => {
      const occurrence = (occurrences.get(emoji) ?? 0) + 1;
      occurrences.set(emoji, occurrence);
      return `${emoji}-${occurrence}`;
    });
  }, [sequence]);
  const results = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return entries.slice(0, 48);
    return entries.map((entry) => ({ entry, score: matches(entry, term) })).filter(({ score }) => score < 99).sort((a, b) => a.score - b.score).slice(0, 60).map(({ entry }) => entry);
  }, [query]);

  function useSuggested() {
    dismissAdminKeyboard();
    setPrevious(value);
    onChange(normalizeEmojiSequence(suggested));
  }

  async function copySuggested() {
    dismissAdminKeyboard();
    if (!suggested) return;
    await navigator.clipboard.writeText(suggested);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(""), 1500);
  }

  function addEmoji(emoji: string) {
    dismissAdminKeyboard();
    onChange([...sequence, emoji].join("  "));
  }

  function removeEmoji(index: number) {
    dismissAdminKeyboard();
    onChange(sequence.filter((_, itemIndex) => itemIndex !== index).join("  "));
  }

  function reorderEmoji(event: DragEndEvent) {
    dismissAdminKeyboard();
    if (!event.over || event.active.id === event.over.id) return;
    const from = sequenceIds.indexOf(String(event.active.id));
    const to = sequenceIds.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(sequence, from, to).join("  "));
  }

  return (
    <section className="emoji-helper" aria-labelledby="emoji-helper-title">
      <div className="emoji-helper-heading"><div><p className="admin-eyebrow">Emoji helper</p><h2 id="emoji-helper-title">Find the clearest clues</h2></div></div>
      <div className="emoji-composer" aria-label="Current puzzle sequence">
        <div className="emoji-composer-heading"><span>Current puzzle</span><strong aria-live="polite">{sequence.length ? sequence.join("  ") : "No emoji yet"}</strong></div>
        {sequence.length > 0 && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderEmoji}>
          <SortableContext items={sequenceIds} strategy={rectSortingStrategy}>
            <div className="emoji-sort-list" aria-label="Drag emoji to reorder the puzzle">
              {sequence.map((emoji, index) => <SortableEmoji key={sequenceIds[index]} id={sequenceIds[index]} emoji={emoji} index={index} onRemove={removeEmoji} />)}
            </div>
          </SortableContext>
        </DndContext>}
        <small>Drag clues to reorder. Tap × to remove.</small>
      </div>
      <div className="suggestion-card">
        <span>Suggested for “{phrase || "your answer"}”</span>
        <strong>{suggested || "Add a phrase to see suggestions"}</strong>
        <div className="suggestion-actions">
          <button type="button" onClick={useSuggested} disabled={!suggested}>Use suggested</button>
          <button type="button" onClick={copySuggested} disabled={!suggested}>{copyState || "Copy"}</button>
          {previous !== null && <button type="button" onClick={() => { dismissAdminKeyboard(); onChange(previous); setPrevious(null); }}>Undo</button>}
        </div>
      </div>
      <label className="emoji-search-label"><span>Search emoji by keyword</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try rain, movie, heart…" /></label>
      <div className="emoji-grid" aria-label="Emoji search results">
        {results.map((entry) => <button type="button" key={`${entry.emoji}-${entry.label}`} title={entry.label} aria-label={`Add ${entry.label}`} onClick={() => addEmoji(entry.emoji)}>{entry.emoji}</button>)}
        {!results.length && <p>No emoji matched that keyword.</p>}
      </div>
    </section>
  );
}

function SortableEmoji({ id, emoji, index, onRemove }: { id: string; emoji: string; index: number; onRemove: (index: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} className={`emoji-sort-item ${isDragging ? "is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button className="emoji-sort-handle" type="button" aria-label={`Drag emoji ${index + 1}, ${emoji}, to reorder`} {...attributes} {...listeners}><span>{emoji}</span><small aria-hidden="true">⠿</small></button>
    <button className="emoji-remove" type="button" aria-label={`Remove emoji ${index + 1}, ${emoji}`} onClick={() => onRemove(index)}>×</button>
  </div>;
}
