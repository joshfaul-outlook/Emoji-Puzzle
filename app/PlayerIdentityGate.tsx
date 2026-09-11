"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { clearPendingPlayerIdentity, clearPlayerIdentity, invalidatePlayerIdentity, migratePlayerIdentity, normalizePlayerName, playerHeaders, readKnownPlayer, readPendingPlayerIdentity, savePendingPlayerIdentity, savePlayerIdentity, type BrowserIdentity, type KnownPlayer, type PlayerIdentity } from "../lib/player-identity";
import { applyGameDataEpoch } from "../lib/game-data-epoch";
import { BrandWordmark } from "./components/BrandWordmark";
import { ClueTag, ClueTagProvider } from "./components/ClueTags";
import { KnowingMark } from "./components/KnowingMark";

type Mode = "welcome" | "create" | "recover" | "code";
type Purpose = "create" | "recover";
type Upgrade = "anonymous-upgrade" | null;

const utcDate = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export function PlayerIdentityGate({ children }: { children: (identity: BrowserIdentity, invalidate: () => void, beginUpgrade: () => void, upgradeReady: boolean) => ReactNode }) {
  const [identity, setIdentity] = useState<BrowserIdentity | null | undefined>(undefined);
  const [knownPlayer, setKnownPlayer] = useState<KnownPlayer | null>(null);
  const [mode, setMode] = useState<Mode>("welcome");
  const [purpose, setPurpose] = useState<Purpose>("create");
  const [upgrade, setUpgrade] = useState<Upgrade>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [upgradeReady, setUpgradeReady] = useState(false);

  useEffect(() => {
    const task = window.setTimeout(() => {
      applyGameDataEpoch(localStorage, sessionStorage);
      const stored = migratePlayerIdentity(localStorage);
      const pending = readPendingPlayerIdentity(localStorage);
      setUpgradeReady(Boolean(pending));
      if (pending && pending.activateOn <= utcDate()) {
        if (stored?.kind === "anonymous") void fetch("/api/player-sessions/current", { method: "DELETE", headers: playerHeaders(stored), keepalive: true }).catch(() => undefined);
        savePlayerIdentity(localStorage, pending.identity);
        clearPendingPlayerIdentity(localStorage);
        setUpgradeReady(false);
        setIdentity(pending.identity);
      } else {
        if (!stored) clearPlayerIdentity(localStorage);
        setIdentity(stored);
      }
      const known = readKnownPlayer(localStorage);
      setKnownPlayer(known); setName(known?.displayName ?? "");
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

  function choose(next: Purpose, nextUpgrade: Upgrade = null) {
    setPurpose(next); setUpgrade(nextUpgrade); setMode(next); setError(""); setCode(""); setChallengeId("");
    if (next === "create" && knownPlayer && !nextUpgrade) setName("");
  }

  function changeName(value: string) {
    setName(value); setError(""); setAvailability(!value ? "idle" : normalizePlayerName(value) ? "checking" : "invalid");
  }

  async function playAnonymous() {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/anonymous-sessions", { method: "POST", headers: { "content-type": "application/json" } });
      const data = await response.json() as Partial<BrowserIdentity> & { error?: string };
      if (!response.ok || data.kind !== "anonymous" || !data.playerId || !data.sessionId || !data.token) throw new Error(data.error || "Anonymous play could not start.");
      const next: BrowserIdentity = { kind: "anonymous", playerId: data.playerId, sessionId: data.sessionId, token: data.token };
      savePlayerIdentity(localStorage, next); setIdentity(next);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Anonymous play could not start."); }
    finally { setSubmitting(false); }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault(); setError("");
    const normalized = purpose === "create" ? normalizePlayerName(name) : null;
    if (purpose === "create" && !normalized) { setAvailability("invalid"); return; }
    if (!email.trim()) { setError("Enter your email address."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/player-verifications", {
        method: "POST", headers: { "content-type": "application/json", ...(upgrade && identity ? { "x-emojizzle-player-id": identity.playerId, "x-emojizzle-player-session-id": identity.sessionId, "x-emojizzle-player-token": identity.token } : {}) },
        body: JSON.stringify({ purpose, email, ...(normalized ? { displayName: normalized.displayName } : {}), ...(upgrade ? { source: upgrade } : {}) }),
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
      const response = await fetch("/api/player-verifications/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, code }) });
      const data = await response.json() as Partial<PlayerIdentity> & { error?: string; activatesAt?: string };
      if (!response.ok || data.kind !== "player" || !data.playerId || !data.displayName || !data.sessionId || !data.token) throw new Error(data.error || "The code could not be verified.");
      const next: PlayerIdentity = { kind: "player", playerId: data.playerId, displayName: data.displayName, sessionId: data.sessionId, token: data.token };
      setKnownPlayer({ displayName: next.displayName });
      if (upgrade && identity?.kind === "anonymous") {
        savePendingPlayerIdentity(localStorage, { identity: next, activateOn: /^\d{4}-\d{2}-\d{2}T/.test(data.activatesAt ?? "") ? data.activatesAt!.slice(0, 10) : tomorrow() });
        setUpgradeReady(true); setUpgrade(null); setMode("welcome"); setError("");
      } else {
        savePlayerIdentity(localStorage, next); setIdentity(next);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The code could not be verified."); }
    finally { setSubmitting(false); }
  }

  function invalidate() {
    if (!identity) return;
    invalidatePlayerIdentity(localStorage, identity);
    if (identity.kind === "player") {
      setKnownPlayer({ displayName: identity.displayName }); setIdentity(null); setPurpose("recover"); setUpgrade(null); setMode("recover"); setEmail("");
      setError(`We couldn’t verify this device for ${identity.displayName}. Send a code to recover your player.`);
    } else {
      setIdentity(null); setMode("welcome");
      setError("This anonymous browser pass is no longer available. Its previous play can’t be recovered.");
    }
  }

  function beginUpgrade() {
    if (identity?.kind !== "anonymous") return;
    setPurpose("create"); setUpgrade("anonymous-upgrade"); setMode("create"); setError(""); setName("");
  }

  if (identity === undefined) return <main className="utility-page" aria-busy="true"><KnowingMark size={64} /><h1>Getting your puzzle ready…</h1></main>;
  if (identity && !(identity.kind === "anonymous" && upgrade === "anonymous-upgrade" && (mode === "create" || mode === "code"))) return children(identity, invalidate, beginUpgrade, upgradeReady);

  return <ClueTagProvider><main className="identity-shell"><section className="identity-card" aria-labelledby="identity-title">
    <div className="identity-brand"><KnowingMark size={56} /><BrandWordmark /></div>
    {mode === "welcome" && <>
      <p className="admin-eyebrow">Welcome</p><h1 id="identity-title">Ready to play?</h1><p>Choose the kind of puzzle companion you want to be.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="identity-choices identity-paths">
        <ClueTag id="player-path" priority={10} title="Why make a player?" copy="Your Daily play and recorded stats follow your player across devices. Practice position stays on this device, and email is only for recovery."><section className="identity-path primary-path"><strong>Create a player</strong><p>Choose a name, join Daily rankings, and recover your Daily play on another device.</p><button className="primary-button" type="button" onClick={() => choose("create")}>Create my player</button></section></ClueTag>
        <ClueTag id="anonymous-path" priority={20} title="What does anonymous mean?" copy="We still save anonymous puzzle activity and feedback without a name so we can improve Emojizzle. Clear browser data and that play cannot be restored."><section className="identity-path"><strong>Play anonymously</strong><p>No name or email. This browser only, never ranked, and progress can’t be recovered if browser data is cleared.</p><button className="secondary-button" type="button" onClick={() => void playAnonymous()} disabled={submitting}>{submitting ? "Starting…" : "Play anonymously"}</button></section></ClueTag>
        <button className="quiet-button" type="button" onClick={() => choose("recover")}>I already play Emojizzle</button>
      </div>
    </>}

    {(mode === "create" || mode === "recover") && <>
      <p className="admin-eyebrow">{mode === "create" ? upgrade ? "Become a player" : "New player" : "Welcome back"}</p>
      <h1 id="identity-title">{mode === "create" ? "Choose your player name" : knownPlayer ? `Recover ${knownPlayer.displayName}` : "Recover your player"}</h1>
      <p>{mode === "create" ? upgrade ? "No password. Your new player will begin with tomorrow’s Daily." : "No password. Your email lets you keep this name and play on other devices." : "We’ll email you a 6-digit code. Your address is used only to recover your player."}</p>
      <form onSubmit={sendCode}>
        {mode === "create" && <><label htmlFor="player-name">Player name</label><input id="player-name" value={name} onChange={(event) => changeName(event.target.value)} minLength={3} maxLength={20} autoComplete="nickname" autoFocus /><small>3–20 letters, numbers, spaces, _ or -</small><p className={`name-status ${availability}`} aria-live="polite">{availability === "checking" && "Checking availability…"}{availability === "available" && "That name is available."}{availability === "taken" && "That name is already taken."}{availability === "invalid" && "Use 3–20 allowed characters."}{availability === "error" && "Availability check failed; you can still continue."}</p></>}
        <label htmlFor="player-email">Email address</label><input id="player-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required autoFocus={mode === "recover"} />
        {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={submitting || (mode === "create" && !normalizePlayerName(name))}>{submitting ? "Sending…" : "Send code"}</button><button className="quiet-button" type="button" onClick={() => { setMode("welcome"); setUpgrade(null); setError(""); }}>Back</button>
      </form>
    </>}

    {mode === "code" && <><p className="admin-eyebrow">Check your email</p><h1 id="identity-title">Enter your code</h1><p>We sent a 6-digit code to {email}. It expires in 10 minutes.</p><form onSubmit={confirmCode}><label htmlFor="verification-code">Verification code</label><input id="verification-code" className="verification-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" autoFocus />{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={submitting || code.length !== 6}>{submitting ? "Verifying…" : purpose === "create" ? "Create player" : "Continue playing"}</button><button className="quiet-button" type="button" onClick={() => { setMode(purpose); setError(""); }}>Send another code</button></form></>}
  </section></main></ClueTagProvider>;
}
