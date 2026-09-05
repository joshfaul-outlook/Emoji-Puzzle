"use client";

import { useEffect, useRef, useState } from "react";
import { playerHeaders, type PlayerIdentity } from "../lib/player-identity";
import type { PlayerGlance, PlayerStats as Stats, PlaySummary, RankingsPage } from "../lib/player-stats";

function dateLabel(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}
async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Stats could not load. Please try again.");
  return data as T;
}

function Summary({ title, summary }: { title: string; summary: PlaySummary }) {
  const average = (n: number | null) => n === null ? "—" : n.toFixed(1);
  const metrics = [
    ["Started", summary.started], ["Solved", summary.solved], ["Revealed", summary.revealed], ["Unfinished", summary.unfinished],
    ["Solve rate", summary.solveRate === null ? "—" : `${Math.round(summary.solveRate * 100)}%`],
    ["Without hints", summary.unaidedSolves], ["Avg. guesses", average(summary.averageGuesses)],
    ["Avg. hints", average(summary.averageHints)], ["Distinct puzzles solved", summary.distinctSolved],
  ];
  return <section className="stats-section" aria-label={`${title} statistics`}>
    <h3>{title}</h3>
    <dl className="stats-grid">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {!summary.started && <p>No recorded attempts yet.</p>}
    {title === "Daily" && summary.unrankedCompleted > 0 && <p>{summary.unrankedCompleted} completed {summary.unrankedCompleted === 1 ? "attempt is" : "attempts are"} unranked, including historical or late results.</p>}
  </section>;
}

type StatsView = "daily" | "rankings" | "practice";

export function PlayerStatsPanel({ identity, onClose, initialView = "daily" }: { identity: PlayerIdentity; onClose: () => void; initialView?: StatsView }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<StatsView>(initialView);
  const [window, setWindow] = useState<"all" | "30d">("all");
  const [stats, setStats] = useState<Stats | null>(null);
  const [board, setBoard] = useState<RankingsPage | null>(null);
  const [statsError, setStatsError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const boardRequest = useRef(0);

  useEffect(() => {
    const element = dialog.current; const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/players/me/stats?window=${window}`, { headers: playerHeaders(identity), signal: controller.signal })
      .then(readResponse<Stats>).then((data) => { setStats(data); setStatsError(""); })
      .catch((error) => { if (!controller.signal.aborted) setStatsError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [identity, window, refresh]);

  async function loadBoard(cursor?: string) {
    const request = ++boardRequest.current;
    setBoardLoading(true); setBoardError("");
    try {
      const result = await fetch(`/api/rankings?window=30d${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`).then(readResponse<RankingsPage>);
      if (request === boardRequest.current) setBoard((current) => ({ ...result, rows: cursor && current ? [...current.rows, ...result.rows] : result.rows }));
    } catch (error) {
      if (request === boardRequest.current) { setBoardError(error instanceof Error ? error.message : "Rankings could not load."); setBoard(null); }
    } finally { if (request === boardRequest.current) setBoardLoading(false); }
  }

  async function savePreference(publicStats: boolean) {
    const previous = stats;
    setStats((value) => value ? { ...value, publicStats, ownRank: publicStats ? value.ownRank : null } : value);
    setSaving(true); setPreferenceError("");
    try {
      await fetch("/api/players/me/preferences", { method: "PATCH", headers: { ...playerHeaders(identity), "content-type": "application/json" }, body: JSON.stringify({ publicStats }) }).then(readResponse);
      setStats((value) => value ? { ...value, publicStats, ownRank: publicStats ? value.ownRank : null } : value);
      setLoading(true); setRefresh((value) => value + 1); setBoard(null); boardRequest.current += 1;
    } catch (error) { setStats(previous); setPreferenceError(error instanceof Error ? error.message : "Preference could not be saved."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className="stats-dialog" aria-labelledby="stats-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]")).filter((element) => element.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <div className="stats-heading"><div><p className="stats-eyebrow">{identity.displayName}</p><h2 id="stats-title">Stats & rankings</h2></div><button className="stats-close" type="button" onClick={onClose} aria-label="Close stats and return to puzzle">✕</button></div>
    <div className="stats-tabs" role="tablist" aria-label="Stats view">
      <button id="stats-tab-daily" type="button" role="tab" aria-controls="stats-panel-daily" aria-selected={tab === "daily"} onClick={() => setTab("daily")}>Daily</button>
      <button id="stats-tab-rankings" type="button" role="tab" aria-controls="stats-panel-rankings" aria-selected={tab === "rankings"} onClick={() => { setTab("rankings"); void loadBoard(); }}>Rankings</button>
      <button id="stats-tab-practice" type="button" role="tab" aria-controls="stats-panel-practice" aria-selected={tab === "practice"} onClick={() => setTab("practice")}>Practice</button>
    </div>
    {(tab === "daily" || tab === "practice") ? <div id={`stats-panel-${tab}`} role="tabpanel" aria-labelledby={`stats-tab-${tab}`} aria-busy={loading}>
      <label className="stats-filter">History <select value={window} disabled={saving} onChange={(event) => { setLoading(true); setWindow(event.target.value as "all" | "30d"); }}><option value="all">All recorded history</option><option value="30d">Last 30 days</option></select></label>
      {loading && <p role="status">Loading your stats…</p>}
      {statsError && <p role="alert">{statsError} <button type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>Try again</button></p>}
      {stats && !loading && !statsError && <>
        {tab === "daily" && <><div className="streak-cards has-rank" aria-label="Daily highlights"><div><strong>{stats.streaks.current}</strong><span>Current Daily streak</span></div><div><strong>{stats.streaks.best}</strong><span>Best Daily streak</span></div><div className="rank-card"><strong>{stats.publicStats && stats.ownRank ? `#${stats.ownRank.rank}` : "—"}</strong><span>{!stats.publicStats ? "Rankings private" : stats.ownRank ? "30-day rank" : stats.rankingsStatus === "ready" ? "Solve to join" : "Rank updating"}</span></div></div><p className="stats-note">Consecutive Daily solves, including hints. Streaks use your full ranked history and can exceed 30 days. Each Daily closes at midnight UTC.</p></>}
        {tab === "daily" ? <>
          <Summary title="Daily" summary={stats.daily} />
          <div className="stats-preference"><label><input type="checkbox" checked={stats.publicStats} disabled={saving || loading} onChange={(event) => void savePreference(event.target.checked)} /> Show my Daily stats publicly</label><p>Your player name, Daily totals, and current streak appear in rankings. Practice stays private.</p></div>
        </> : <>
          <Summary title="Practice" summary={stats.practice} />
          <p className="stats-note">Only you can see your Practice stats. Practice never affects your rank or Daily streak. Recorded stats follow your player across devices; Practice position stays on this device.</p>
        </>}
        <p className="stats-note">Solve rate covers solved and revealed attempts. Averages cover solves only. Opening a puzzle starts an attempt; replays count as separate Practice attempts.</p>
        {(tab === "daily" ? stats.daily.coverageStart : stats.practice.coverageStart) && <p className="stats-note">Recorded history begins {dateLabel((tab === "daily" ? stats.daily.coverageStart : stats.practice.coverageStart)!)}. Updated {timestamp(stats.asOf)}.</p>}
      </>}
      {preferenceError && <p role="alert">{preferenceError}</p>}
    </div> : <div id="stats-panel-rankings" role="tabpanel" aria-labelledby="stats-tab-rankings" aria-busy={boardLoading}>
      <p>Most Daily solves in the last 30 days, then most solves without hints. Equal totals share a rank. Replays and Practice never count.</p>
      {stats && <p className="own-rank">{!stats.publicStats ? "Your Daily stats are private. You can change this in Daily." : stats.ownRank ? `Your rank: #${stats.ownRank.rank} · ${stats.ownRank.solves} Daily solves` : stats.rankingsStatus === "ready" ? "Solve a Daily puzzle to join the rankings." : "Your rank is temporarily unavailable."}</p>}
      {boardError && <p role="alert">{boardError}</p>}
      {board && <>
        <p className="stats-note">{dateLabel(board.from)} – {dateLabel(board.through)} UTC · Updated {timestamp(board.asOf)}. Refreshes about every five minutes while viewed.</p>
        {board.rows.length ? <div className="rankings-table-wrap"><table className="rankings-table"><caption>Daily rankings · {board.total} players</caption><thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Solves</th><th scope="col">Unaided</th><th scope="col">Streak</th></tr></thead><tbody>{board.rows.map((row) => <tr key={row.displayName}><td>{row.rank}</td><th scope="row">{row.displayName}</th><td>{row.solves}</td><td>{row.unaidedSolves}</td><td>{row.currentStreak}<span className="sr-only"> consecutive Daily solves</span></td></tr>)}</tbody></table></div> : <p>No ranked solves yet. Be the first to solve a Daily puzzle.</p>}
        {board.nextCursor && <button className="secondary-button" type="button" disabled={boardLoading} onClick={() => void loadBoard(board.nextCursor!)}>Show more players</button>}
      </>}
      {boardLoading && <p role="status">Loading Daily rankings…</p>}
      <button className="secondary-button" type="button" disabled={boardLoading} onClick={() => { void loadBoard(); setRefresh((value) => value + 1); }}>Refresh rankings</button>
    </div>}
  </dialog>;
}

export function ProgressStrip({ identity, mode, outcome, onOpen, refreshKey }: { identity: PlayerIdentity; mode: "daily" | "practice"; outcome: "playing" | "solved" | "revealed"; onOpen: () => void; refreshKey?: string | number }) {
  const [stats, setStats] = useState<PlayerGlance | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/players/me/glance", { headers: playerHeaders(identity), signal: controller.signal })
      .then(readResponse<PlayerGlance>).then(setStats).catch(() => undefined);
    return () => controller.abort();
  }, [identity, refreshKey]);
  if (!stats) return null;
  if (mode === "practice") return <button className="progress-strip metric-sentence" type="button" onClick={onOpen} aria-label="Open Practice stats"><span className="progress-item"><span className="progress-icon" aria-hidden="true">🎯</span><span><strong>{stats.practice.solved} solved</strong><small>{stats.practice.solveRate === null ? "No solve rate yet" : `${Math.round(stats.practice.solveRate * 100)}% solve rate`}</small></span></span><span className="progress-arrow" aria-hidden="true">→</span></button>;
  const placement = !stats.publicStats ? "Rankings private" : stats.daily.currentPublicRank ? `#${stats.daily.currentPublicRank} this month` : stats.daily.rankingsStatus === "ready" ? "Solve to join" : "Rank updating";
  const streak = outcome === "revealed" ? "Start again tomorrow" : stats.daily.currentStreak ? `${stats.daily.currentStreak}-day streak` : "Start your streak";
  return <button className="progress-strip" type="button" onClick={onOpen} aria-label={`Open Daily stats: ${streak}, ${placement}`}><span className="progress-item"><span className="progress-icon" aria-hidden="true">🔥</span><span><strong>{streak}</strong><small>Daily</small></span></span><span className="progress-item"><span className="progress-icon" aria-hidden="true">🏅</span><span><strong>{placement}</strong><small>Daily rankings</small></span></span><span className="progress-arrow" aria-hidden="true">→</span></button>;
}

export function DailyStreak({ identity }: { identity: PlayerIdentity }) {
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/players/me/glance", { headers: playerHeaders(identity), signal: controller.signal }).then(readResponse<PlayerGlance>).then((data) => {
      if (!controller.signal.aborted) setStreak(data.daily.currentStreak);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [identity]);
  return streak === null ? null : <p className="daily-streak" role="status">{streak ? `${streak}-day Daily streak` : "Start again tomorrow"}</p>;
}
