"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { clearPlayerIdentity, invalidatePlayerIdentity, normalizePlayerName, readKnownPlayer, readPlayerIdentity, savePlayerIdentity, type KnownPlayer, type PlayerIdentity } from "../lib/player-identity";
import { BrandWordmark } from "./components/BrandWordmark";
import { KnowingMark } from "./components/KnowingMark";

type Mode = "welcome" | "create" | "recover" | "code";
type Purpose = "create" | "recover";

export function PlayerIdentityGate({ children }: { children: (identity: PlayerIdentity, invalidate: () => void) => ReactNode }) {
  const [identity, setIdentity] = useState<PlayerIdentity | null | undefined>(undefined);
  const [knownPlayer, setKnownPlayer] = useState<KnownPlayer | null>(null);
  const [mode, setMode] = useState<Mode>("welcome");
  const [purpose, setPurpose] = useState<Purpose>("create");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const task = window.setTimeout(() => {
      const stored = readPlayerIdentity(localStorage);
      if (!stored) clearPlayerIdentity(localStorage);
      const known = readKnownPlayer(localStorage);
      setKnownPlayer(known);
      setName(known?.displayName ?? "");
      setIdentity(stored);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (identity !== null || mode !== "create") return;
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
  }, [identity, mode, name]);

  function choose(next: Purpose) {
    setPurpose(next); setMode(next); setError(""); setCode(""); setChallengeId("");
    if (next === "create" && knownPlayer) setName("");
  }

  function changeName(value: string) {
    setName(value); setError("");
    setAvailability(!value ? "idle" : normalizePlayerName(value) ? "checking" : "invalid");
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault(); setError("");
    const normalized = purpose === "create" ? normalizePlayerName(name) : null;
    if (purpose === "create" && !normalized) { setAvailability("invalid"); return; }
    if (!email.trim()) { setError("Enter your email address."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/player-verifications", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, email, ...(normalized ? { displayName: normalized.displayName } : {}) }),
      });
      const data = await response.json() as { challengeId?: string; error?: string };
      if (!response.ok || !data.challengeId) throw new Error(data.error || "The verification code could not be sent.");
      setChallengeId(data.challengeId); setMode("code"); setCode("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The verification code could not be sent."); }
    finally { setSubmitting(false); }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/player-verifications/confirm", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json() as Partial<PlayerIdentity> & { error?: string };
      if (!response.ok || !data.playerId || !data.displayName || !data.sessionId || !data.token) throw new Error(data.error || "The code could not be verified.");
      const next = { playerId: data.playerId, displayName: data.displayName, sessionId: data.sessionId, token: data.token };
      savePlayerIdentity(localStorage, next); setKnownPlayer({ displayName: next.displayName }); setIdentity(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The code could not be verified."); }
    finally { setSubmitting(false); }
  }

  function invalidate() {
    if (!identity) return;
    invalidatePlayerIdentity(localStorage, identity);
    setKnownPlayer({ displayName: identity.displayName }); setIdentity(null); setPurpose("recover"); setMode("recover"); setEmail("");
    setError(`We couldn’t verify this device for ${identity.displayName}. Send a code to recover your player.`);
  }

  if (identity === undefined) return <main className="utility-page" aria-busy="true"><KnowingMark size={64} /><h1>Getting your puzzle ready…</h1></main>;
  if (identity) return children(identity, invalidate);

  return (
    <main className="identity-shell">
      <section className="identity-card" aria-labelledby="identity-title">
        <div className="identity-brand"><KnowingMark size={56} /><BrandWordmark /></div>
        {mode === "welcome" && <>
          <p className="admin-eyebrow">Welcome</p>
          <h1 id="identity-title">Ready to play?</h1>
          <p>Your player name follows you across devices—no password needed.</p>
          <div className="identity-choices">
            <button className="primary-button" type="button" onClick={() => choose("create")}>I’m new</button>
            <button className="secondary-button" type="button" onClick={() => choose("recover")}>I already play Emojizzle</button>
          </div>
        </>}

        {(mode === "create" || mode === "recover") && <>
          <p className="admin-eyebrow">{mode === "create" ? "New player" : "Welcome back"}</p>
          <h1 id="identity-title">{mode === "create" ? "Choose your player name" : knownPlayer ? `Recover ${knownPlayer.displayName}` : "Recover your player"}</h1>
          <p>{mode === "create" ? "No password. Your email lets you keep this name and play on other devices." : "We’ll email you a 6-digit code. Your address is used only to recover your player."}</p>
          <form onSubmit={sendCode}>
            {mode === "create" && <>
              <label htmlFor="player-name">Player name</label>
              <input id="player-name" value={name} onChange={(event) => changeName(event.target.value)} minLength={3} maxLength={20} autoComplete="nickname" autoFocus />
              <small>3–20 letters, numbers, spaces, _ or -</small>
              <p className={`name-status ${availability}`} aria-live="polite">
                {availability === "checking" && "Checking availability…"}
                {availability === "available" && "That name is available."}
                {availability === "taken" && "That name is already taken."}
                {availability === "invalid" && "Use 3–20 allowed characters."}
                {availability === "error" && "Availability check failed; you can still continue."}
              </p>
            </>}
            <label htmlFor="player-email">Email address</label>
            <input id="player-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus={mode === "recover"} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting || (mode === "create" && !normalizePlayerName(name))}>{submitting ? "Sending…" : "Send code"}</button>
            <button className="quiet-button" type="button" onClick={() => { setMode("welcome"); setError(""); }}>Back</button>
          </form>
        </>}

        {mode === "code" && <>
          <p className="admin-eyebrow">Check your email</p>
          <h1 id="identity-title">Enter your code</h1>
          <p>We sent a 6-digit code to {email}. It expires in 10 minutes.</p>
          <form onSubmit={confirmCode}>
            <label htmlFor="verification-code">Verification code</label>
            <input id="verification-code" className="verification-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" autoFocus />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting || code.length !== 6}>{submitting ? "Verifying…" : purpose === "create" ? "Create player" : "Continue playing"}</button>
            <button className="quiet-button" type="button" onClick={() => { setMode(purpose); setError(""); }}>Send another code</button>
          </form>
        </>}
      </section>
    </main>
  );
}
