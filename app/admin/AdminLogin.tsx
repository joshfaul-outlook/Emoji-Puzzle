"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.status === 503 ? "Administration is not configured yet." : "That password was not accepted.");
      return;
    }
    setPassword("");
    onSuccess();
  }

  return (
    <main className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">◒</span><span>Emoji Daily</span></Link>
        <p className="admin-eyebrow">Puzzle administration</p>
        <h1>Welcome back</h1>
        <p>Enter the private admin password to manage puzzles and feedback.</p>
        <label className="field-label" htmlFor="admin-password">Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required autoFocus />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button admin-primary" disabled={busy}>{busy ? "Checking…" : "Open admin"}</button>
      </form>
    </main>
  );
}
