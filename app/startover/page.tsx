"use client";

import { useEffect } from "react";

export default function StartOver() {
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();

    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    }

    window.location.replace("/");
  }, []);

  return (
    <main className="utility-page">
      <div className="brand-mark" aria-hidden="true">◒</div>
      <h1>Starting fresh…</h1>
      <p aria-live="polite">Clearing this device’s game progress and returning to today’s puzzle.</p>
    </main>
  );
}
