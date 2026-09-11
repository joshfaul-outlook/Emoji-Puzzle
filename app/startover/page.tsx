"use client";

import { useEffect } from "react";
import { KnowingMark } from "../components/KnowingMark";
import { playerHeaders, readPendingPlayerIdentity, readPlayerIdentity } from "../../lib/player-identity";

export default function StartOver() {
  useEffect(() => {
    const reset = async () => {
      const identity = readPlayerIdentity(localStorage);
      const pending = readPendingPlayerIdentity(localStorage)?.identity;
      if (identity || pending) {
        const request = Promise.all([identity, pending].filter((value): value is NonNullable<typeof value> => Boolean(value)).map((value) => fetch("/api/player-sessions/current", { method: "DELETE", headers: playerHeaders(value), keepalive: true }).catch(() => undefined)));
        await Promise.race([request, new Promise((resolve) => window.setTimeout(resolve, 1_500))]);
      }
      localStorage.clear();
      sessionStorage.clear();

      for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0]?.trim();
        if (name) document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }

      window.location.replace("/");
    };
    void reset();
  }, []);

  return (
    <main className="utility-page">
      <KnowingMark size={64} />
      <h1>Starting fresh…</h1>
      <p aria-live="polite">Clearing this device’s player identity and game progress, then returning to today’s puzzle.</p>
    </main>
  );
}
