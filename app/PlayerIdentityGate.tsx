"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { clearPlayerIdentity, normalizePlayerName, readPlayerIdentity, savePlayerIdentity, type PlayerIdentity } from "../lib/player-identity";
import { BrandWordmark } from "./components/BrandWordmark";
import { KnowingMark } from "./components/KnowingMark";

export function PlayerIdentityGate({ children }: { children: (identity: PlayerIdentity, invalidate: () => void) => ReactNode }) {
  const [identity, setIdentity] = useState<PlayerIdentity | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const task = window.setTimeout(() => {
      const stored = readPlayerIdentity(localStorage);
      if (!stored) clearPlayerIdentity(localStorage);
      setIdentity(stored);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (identity !== null) return;
    const normalized = normalizePlayerName(name);
    if (!name || !normalized) return;
    const controller = new AbortController();
    const task = window.setTimeout(() => {
      fetch(`/api/players/availability?name=${encodeURIComponent(normalized.displayName)}`, { signal: controller.signal, headers: { accept: "application/json" } })
        .then(async (response) => response.ok ? response.json() as Promise<{ available?: boolean }> : Promise.reject())
        .then((result) => setAvailability(result.available ? "available" : "taken"))
        .catch((reason) => { if (reason?.name !== "AbortError") setAvailability("error"); });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(task); };
  }, [identity, name]);

  function changeName(value: string) {
    setName(value); setError("");
    setAvailability(!value ? "idle" : normalizePlayerName(value) ? "checking" : "invalid");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const normalized = normalizePlayerName(name);
    if (!normalized) { setAvailability("invalid"); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/players", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: normalized.displayName }) });
      const data = await response.json() as Partial<PlayerIdentity> & { error?: string };
      if (!response.ok || !data.playerId || !data.displayName || !data.token) {
        if (response.status === 409) setAvailability("taken");
        throw new Error(data.error || "Your player could not be created.");
      }
      const next = { playerId: data.playerId, displayName: data.displayName, token: data.token };
      savePlayerIdentity(localStorage, next); setIdentity(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your player could not be created."); }
    finally { setSubmitting(false); }
  }

  function invalidate() { clearPlayerIdentity(localStorage); setIdentity(null); setName(""); setError("Your saved player could not be verified. Choose a new display name."); }

  if (identity === undefined) return <main className="utility-page" aria-busy="true"><KnowingMark size={64} /><h1>Getting your puzzle ready…</h1></main>;
  if (identity) return children(identity, invalidate);
  return (
    <main className="identity-shell">
      <section className="identity-card" aria-labelledby="identity-title">
        <div className="identity-brand"><KnowingMark size={56} /><BrandWordmark /></div>
        <p className="admin-eyebrow">One quick thing</p>
        <h1 id="identity-title">Choose your player name</h1>
        <p>This name stays with this browser and connects your puzzle results. There’s no account or login.</p>
        <form onSubmit={submit}>
          <label htmlFor="player-name">Display name</label>
          <input ref={inputRef} id="player-name" value={name} onChange={(event) => changeName(event.target.value)} minLength={3} maxLength={20} autoComplete="nickname" autoFocus aria-describedby="name-help name-status" />
          <small id="name-help">3–20 letters, numbers, spaces, _ or -</small>
          <p id="name-status" className={`name-status ${availability}`} aria-live="polite">
            {availability === "checking" && "Checking availability…"}
            {availability === "available" && "That name is available."}
            {availability === "taken" && "That name is already taken."}
            {availability === "invalid" && "Use 3–20 allowed characters."}
            {availability === "error" && "Availability check failed; you can still try to claim it."}
          </p>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting || !normalizePlayerName(name)}>{submitting ? "Creating player…" : "Start playing"}</button>
        </form>
      </section>
    </main>
  );
}
