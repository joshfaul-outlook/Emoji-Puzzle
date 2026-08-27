import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { adminConfigured, clearSessionCookie, createSessionCookie, passwordAccepted } from "./auth.js";
import { body, json, requireAdmin, requireOrigin } from "./http.js";
import { isAcceptedGuess, validatePuzzle, type PuzzlePool, type PuzzleStatus, type StoredPuzzle } from "./model.js";
import { createPuzzle, getPuzzle, insertFeedback, listFeedback, listPuzzles, updatePuzzle } from "./storage.js";
import { suggestPuzzle } from "./suggestions.js";

const launchDate = Date.parse("2026-08-05T00:00:00Z");

function publicPuzzle(puzzle: StoredPuzzle, puzzles: StoredPuzzle[], context: "daily" | "practice" | "challenge" | "author-test", now = new Date()) {
  const dateCode = context === "daily" ? now.toISOString().slice(2, 10).replace(/-/g, "") : null;
  const originalDate = new Date(launchDate + (puzzle.position - 1) * 86_400_000).toISOString().slice(2, 10).replace(/-/g, "");
  return { id: puzzle.id, number: puzzle.number, emoji: puzzle.emoji, hintCount: puzzle.hints.length, pool: puzzle.pool, context, sequenceNumber: puzzles.findIndex((item) => item.id === puzzle.id) + 1, sequenceLength: puzzles.length, dateCode, rankingEligible: context === "daily", legacyStorageEligible: dateCode !== null && dateCode === originalDate };
}

async function currentPuzzle(request: HttpRequest) {
  const mode = request.query.get("mode") ?? "daily";
  const pool: PuzzlePool = mode === "practice" ? "practice" : "daily";
  const puzzles = (await listPuzzles({ status: "published", pool })).sort((a, b) => a.position - b.position);
  if (!puzzles.length) return json({ error: "Puzzle catalog is empty" }, 503);
  let selected: StoredPuzzle;
  let context: "daily" | "practice" | "challenge" | "author-test";
  let nextPuzzleNumber: number | undefined;
  if (mode === "practice") {
    const challenge = Number.parseInt(request.query.get("challenge") ?? "", 10);
    const requested = Number.parseInt(request.query.get("puzzle") ?? "", 10);
    const isChallenge = Number.isInteger(challenge) && challenge >= 1 && challenge <= puzzles.length;
    const position = isChallenge ? challenge : Number.isInteger(requested) && requested >= 1 ? requested : 1;
    selected = puzzles[position - 1] ?? puzzles[0];
    context = isChallenge ? "challenge" : "practice";
  } else {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dailyIndex = Math.max(0, Math.floor((today - launchDate) / 86_400_000)) % puzzles.length;
    const requested = Number.parseInt(request.query.get("puzzle") ?? "", 10);
    if (mode === "next") {
      selected = Number.isInteger(requested) ? puzzles.find((item) => item.number === requested) ?? puzzles[(dailyIndex + 1) % puzzles.length] : puzzles[(dailyIndex + 1) % puzzles.length];
      context = "author-test";
      nextPuzzleNumber = puzzles[(puzzles.findIndex((item) => item.id === selected.id) + 1) % puzzles.length].number;
    } else if (Number.isInteger(requested)) {
      selected = puzzles.find((item) => item.number === requested) ?? puzzles[dailyIndex];
      context = "author-test";
    } else { selected = puzzles[dailyIndex]; context = "daily"; }
  }
  return json({ puzzle: publicPuzzle(selected, puzzles, context), ...(nextPuzzleNumber ? { nextPuzzleNumber } : {}) });
}

async function guess(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; guess?: string }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  const candidate = payload?.guess?.trim() ?? "";
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !candidate || candidate.length > 120) return json({ error: "Invalid guess" }, 400);
  if (!isAcceptedGuess(puzzle, candidate)) return json({ correct: false });
  return json({ correct: true, resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

async function hint(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; hintIndex?: number }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  const index = payload?.hintIndex;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !Number.isInteger(index) || (index as number) < 0) return json({ error: "Invalid hint request" }, 400);
  const value = puzzle.hints[index as number];
  return value ? json({ hint: value }) : json({ error: "No more hints" }, 404);
}

async function reveal(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool) return json({ error: "Invalid puzzle" }, 400);
  return json({ resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

async function feedback(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<Record<string, unknown>>(request);
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = typeof payload?.puzzleId === "string" ? await getPuzzle(payload.puzzleId) : null;
  const comment = typeof payload?.comment === "string" ? payload.comment.trim() || null : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== pool || puzzle.number !== payload?.puzzleNumber || (payload?.rating !== "up" && payload?.rating !== "down") || (payload?.outcome !== "solved" && payload?.outcome !== "revealed") || typeof payload?.playId !== "string" || typeof payload?.anonymousSessionId !== "string" || (comment?.length ?? 0) > 500 || (pool === "practice" && comment !== null)) return json({ error: "Invalid feedback" }, 400);
  const count = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;
  await insertFeedback({ puzzleId: puzzle.id, puzzleNumber: puzzle.number, puzzlePool: pool, rating: payload.rating, comment, playId: payload.playId.slice(0,80), anonymousSessionId: payload.anonymousSessionId.slice(0,80), outcome: payload.outcome, guessCount: count(payload.guessCount,1000), hintCount: count(payload.hintCount,20), metadataJson: JSON.stringify(payload.metadata ?? {}).slice(0,2000) });
  return json({ saved: true }, 201);
}

async function session(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  if (request.method === "DELETE") return json({ signedOut: true }, 200, { "set-cookie": clearSessionCookie() });
  if (!adminConfigured()) return json({ error: "Administration is not configured" }, 503);
  const payload = await body<{ password?: string }>(request);
  if (!payload?.password || !passwordAccepted(payload.password)) return json({ error: "Invalid password" }, 401);
  return json({ signedIn: true }, 200, { "set-cookie": createSessionCookie() });
}

async function adminPuzzles(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  if (request.method === "GET") return json({ puzzles: await listPuzzles() });
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<Partial<StoredPuzzle>>(request);
  if (!payload) return json({ error: "Invalid puzzle" }, 400);
  const status: PuzzleStatus = payload.status === "published" ? "published" : "draft";
  const acceptedAnswers = Array.from(new Set([payload.answer ?? "", ...(payload.acceptedAnswers ?? [])].map((value) => value.trim()).filter(Boolean)));
  const next = { ...payload, status, acceptedAnswers };
  const validation = validatePuzzle(next, status); if (validation) return json({ error: validation }, 400);
  return json(await createPuzzle(next), 201);
}

async function adminPuzzle(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  const id = request.params.id;
  const existing = id ? await getPuzzle(id) : null;
  if (!existing) return json({ error: "Puzzle not found" }, 404);
  if (request.method === "GET") return json(existing);
  const denied = requireOrigin(request); if (denied) return denied;
  const etag = request.headers.get("if-match");
  if (!etag) return json({ error: "If-Match is required" }, 428);
  try {
    if (request.method === "DELETE") return json(await updatePuzzle(existing, { status: "archived" }, etag));
    const payload = await body<Partial<StoredPuzzle>>(request); if (!payload) return json({ error: "Invalid puzzle" }, 400);
    const status: PuzzleStatus = payload.status === "published" || payload.status === "archived" ? payload.status : "draft";
    const acceptedAnswers = Array.from(new Set([payload.answer ?? existing.answer, ...(payload.acceptedAnswers ?? existing.acceptedAnswers)].map((value) => value.trim()).filter(Boolean)));
    const next = { ...payload, status, acceptedAnswers };
    const validation = validatePuzzle({ ...existing, ...next }, status); if (validation) return json({ error: validation }, 400);
    return json(await updatePuzzle(existing, next, etag));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 412) return json({ error: "Puzzle changed elsewhere" }, 409);
    throw error;
  }
}

async function adminFeedback(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  const limit = Math.min(500, Math.max(1, Number.parseInt(request.query.get("limit") ?? "250", 10) || 250));
  return json({ feedback: await listFeedback(limit) });
}

async function adminPuzzleSuggestions(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ answer?: string }>(request); const answer = payload?.answer?.trim() ?? "";
  if (!answer || answer.length > 120) return json({ error: "Enter an answer up to 120 characters." }, 400);
  try { return json(await suggestPuzzle(answer)); } catch (error) { const status = (error as { statusCode?: number }).statusCode ?? 502; return json({ error: (error as Error).message || "AI help is unavailable." }, status); }
}

function handle(handler: (request: HttpRequest, context: InvocationContext) => Promise<HttpResponseInit>) {
  return async (request: HttpRequest, context: InvocationContext) => {
    try { return await handler(request, context); }
    catch (error) { context.error(error); return json({ error: "The service could not complete the request" }, 500); }
  };
}

app.http("currentPuzzle", { methods: ["GET"], authLevel: "anonymous", route: "puzzles/current", handler: handle(currentPuzzle) });
app.http("guess", { methods: ["POST"], authLevel: "anonymous", route: "guess", handler: handle(guess) });
app.http("hint", { methods: ["POST"], authLevel: "anonymous", route: "hint", handler: handle(hint) });
app.http("reveal", { methods: ["POST"], authLevel: "anonymous", route: "reveal", handler: handle(reveal) });
app.http("feedback", { methods: ["POST"], authLevel: "anonymous", route: "feedback", handler: handle(feedback) });
app.http("adminSession", { methods: ["POST", "DELETE"], authLevel: "anonymous", route: "manage/session", handler: handle(session) });
app.http("adminPuzzles", { methods: ["GET", "POST"], authLevel: "anonymous", route: "manage/puzzles", handler: handle(adminPuzzles) });
app.http("adminPuzzle", { methods: ["GET", "PATCH", "DELETE"], authLevel: "anonymous", route: "manage/puzzles/{id}", handler: handle(adminPuzzle) });
app.http("adminFeedback", { methods: ["GET"], authLevel: "anonymous", route: "manage/feedback", handler: handle(adminFeedback) });
app.http("adminPuzzleSuggestions", { methods: ["POST"], authLevel: "anonymous", route: "manage/puzzle-suggestions", handler: handle(adminPuzzleSuggestions) });
