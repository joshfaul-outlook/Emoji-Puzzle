import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { adminConfigured, clearSessionCookie, createSessionCookie, isAdmin, passwordAccepted } from "./auth.js";
import { body, json, requireAdmin, requireOrigin } from "./http.js";
import { isAcceptedGuess, validatePuzzle, type PuzzlePool, type PuzzleStatus, type StoredPuzzle } from "./model.js";
import { createPlayerToken, hashPlayerToken, isRankingEligiblePlay, normalizePlayerName, playerTokenMatches } from "./player-identity.js";
import { applyPlayAction, createPlayer, getPlay, getPlayer, insertFeedback, listFeedback, listPuzzles, NameUnavailableError, playerNameAvailable, PlayConflictError, startPlay, touchPlayer, createPuzzle, getPuzzle, updatePuzzle, type PlayContext, type PlayerRecord } from "./storage.js";
import { suggestPuzzle } from "./suggestions.js";

const launchDate = Date.parse("2026-08-05T00:00:00Z");
const playerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operationIdPattern = /^[A-Za-z0-9_-]{1,100}$/;
const playIdPattern = /^[A-Za-z0-9_-]{8,100}$/;

async function authenticatedPlayer(request: HttpRequest): Promise<{ player: PlayerRecord } | { denied: HttpResponseInit }> {
  const playerId = request.headers.get("x-emojizzle-player-id") ?? "";
  const token = request.headers.get("x-emojizzle-player-token") ?? "";
  if (!playerIdPattern.test(playerId) || !token) return { denied: json({ error: "Player identity required" }, 401) };
  const player = await getPlayer(playerId);
  if (!player || !playerTokenMatches(token, player.tokenHash)) return { denied: json({ error: "Player identity is invalid" }, 401) };
  return { player: await touchPlayer(player) };
}

function validPlayIdentifiers(playId: unknown, operationId?: unknown) {
  return typeof playId === "string" && playIdPattern.test(playId) && (operationId === undefined || (typeof operationId === "string" && operationIdPattern.test(operationId)));
}

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
  const identity = await authenticatedPlayer(request); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; guess?: string; playId?: string; operationId?: string }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  const candidate = payload?.guess?.trim() ?? "";
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !candidate || candidate.length > 120 || !validPlayIdentifiers(payload?.playId, payload?.operationId)) return json({ error: "Invalid guess" }, 400);
  const correct = isAcceptedGuess(puzzle, candidate);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "guess", correct }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  if (!correct) return json({ correct: false });
  return json({ correct: true, resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

async function hint(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; hintIndex?: number; playId?: string; operationId?: string }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  const index = payload?.hintIndex;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !Number.isInteger(index) || (index as number) < 0 || !validPlayIdentifiers(payload?.playId, payload?.operationId)) return json({ error: "Invalid hint request" }, 400);
  const value = puzzle.hints[index as number];
  if (!value) return json({ error: "No more hints" }, 404);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "hint", hintIndex: index }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  return json({ hint: value });
}

async function reveal(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; playId?: string; operationId?: string }>(request);
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !validPlayIdentifiers(payload?.playId, payload?.operationId)) return json({ error: "Invalid puzzle" }, 400);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "reveal" }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  return json({ resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

async function feedback(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request); if ("denied" in identity) return identity.denied;
  const payload = await body<Record<string, unknown>>(request);
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = typeof payload?.puzzleId === "string" ? await getPuzzle(payload.puzzleId) : null;
  const comment = typeof payload?.comment === "string" ? payload.comment.trim() || null : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== pool || puzzle.number !== payload?.puzzleNumber || (payload?.rating !== "up" && payload?.rating !== "down") || !validPlayIdentifiers(payload?.playId) || typeof payload?.anonymousSessionId !== "string" || (comment?.length ?? 0) > 500 || (pool === "practice" && comment !== null)) return json({ error: "Invalid feedback" }, 400);
  const play = await getPlay(identity.player.playerId, payload.playId as string);
  if (!play || play.puzzleId !== puzzle.id || play.pool !== pool || play.outcome === "playing") return json({ error: "Completed play required" }, 409);
  await insertFeedback({ puzzleId: puzzle.id, puzzleNumber: puzzle.number, puzzlePool: pool, rating: payload.rating, comment, playId: play.playId, anonymousSessionId: payload.anonymousSessionId.slice(0,80), playerId: identity.player.playerId, displayName: identity.player.displayName, outcome: play.outcome, guessCount: play.guessCount, hintCount: play.hintCount, metadataJson: JSON.stringify(payload.metadata ?? {}).slice(0,2000) });
  return json({ saved: true }, 201);
}

async function playerAvailability(request: HttpRequest) {
  const normalized = normalizePlayerName(request.query.get("name"));
  if (!normalized) return json({ valid: false, available: false, error: "Use 3–20 letters, numbers, spaces, _ or -." });
  return json({ valid: true, available: await playerNameAvailable(normalized.normalizedDisplayName) });
}

async function players(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ displayName?: string }>(request);
  const normalized = normalizePlayerName(payload?.displayName);
  if (!normalized) return json({ error: "Use 3–20 letters, numbers, spaces, _ or -." }, 400);
  const playerId = randomUUID(); const token = createPlayerToken();
  try {
    const player = await createPlayer({ playerId, ...normalized, tokenHash: hashPlayerToken(token) });
    return json({ playerId: player.playerId, displayName: player.displayName, token }, 201);
  } catch (error) {
    if (error instanceof NameUnavailableError) return json({ error: "That display name is already taken." }, 409);
    throw error;
  }
}

async function playsStart(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request); if ("denied" in identity) return identity.denied;
  const payload = await body<{ playId?: string; puzzleId?: string; pool?: PuzzlePool; context?: PlayContext }>(request);
  const contexts: PlayContext[] = ["daily", "practice", "challenge", "author-test"];
  const puzzle = payload?.puzzleId ? await getPuzzle(payload.puzzleId) : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !contexts.includes(payload?.context as PlayContext) || !validPlayIdentifiers(payload?.playId)) return json({ error: "Invalid play" }, 400);
  let isCurrentDaily = false;
  if (payload.context === "daily" && puzzle.pool === "daily") {
    const daily = (await listPuzzles({ status: "published", pool: "daily" })).sort((a, b) => a.position - b.position);
    const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    isCurrentDaily = daily.length > 0 && daily[Math.max(0, Math.floor((today - launchDate) / 86_400_000)) % daily.length]?.id === puzzle.id;
  }
  try {
    const result = await startPlay({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, puzzleNumber: puzzle.number, pool: puzzle.pool, context: payload.context!, rankingEligible: isRankingEligiblePlay(payload.context!, puzzle.pool, isCurrentDaily) });
    return json({
      play: result.play,
      hints: puzzle.hints.slice(0, result.play.hintCount),
      ...(result.play.outcome !== "playing" ? { resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } } : {}),
    }, result.created ? 201 : 200);
  } catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
}

async function session(request: HttpRequest) {
  if (request.method === "GET") return json({ authenticated: isAdmin(request), configured: adminConfigured() });
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
app.http("playerAvailability", { methods: ["GET"], authLevel: "anonymous", route: "players/availability", handler: handle(playerAvailability) });
app.http("players", { methods: ["POST"], authLevel: "anonymous", route: "players", handler: handle(players) });
app.http("playsStart", { methods: ["POST"], authLevel: "anonymous", route: "plays/start", handler: handle(playsStart) });
app.http("guess", { methods: ["POST"], authLevel: "anonymous", route: "guess", handler: handle(guess) });
app.http("hint", { methods: ["POST"], authLevel: "anonymous", route: "hint", handler: handle(hint) });
app.http("reveal", { methods: ["POST"], authLevel: "anonymous", route: "reveal", handler: handle(reveal) });
app.http("feedback", { methods: ["POST"], authLevel: "anonymous", route: "feedback", handler: handle(feedback) });
app.http("adminSession", { methods: ["GET", "POST", "DELETE"], authLevel: "anonymous", route: "manage/session", handler: handle(session) });
app.http("adminPuzzles", { methods: ["GET", "POST"], authLevel: "anonymous", route: "manage/puzzles", handler: handle(adminPuzzles) });
app.http("adminPuzzle", { methods: ["GET", "PATCH", "DELETE"], authLevel: "anonymous", route: "manage/puzzles/{id}", handler: handle(adminPuzzle) });
app.http("adminFeedback", { methods: ["GET"], authLevel: "anonymous", route: "manage/feedback", handler: handle(adminFeedback) });
app.http("adminPuzzleSuggestions", { methods: ["POST"], authLevel: "anonymous", route: "manage/puzzle-suggestions", handler: handle(adminPuzzleSuggestions) });
