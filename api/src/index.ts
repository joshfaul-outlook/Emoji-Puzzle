import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { createHash, randomUUID } from "node:crypto";
import { adminConfigured, clearSessionCookie, createSessionCookie, isAdmin, passwordAccepted } from "./auth.js";
import { body, json, requireAdmin, requireOrigin } from "./http.js";
import { parseGameLaunchDate } from "./game-config.js";
import { isAcceptedGuess, validatePuzzle, type PuzzlePool, type PuzzleStatus, type StoredPuzzle } from "./model.js";
import { createPlayerToken, createVerificationCode, hashPlayerToken, hashVerificationCode, normalizePlayerName, normalizeRecoveryEmail, playerTokenMatches, recoveryEmailKey, verificationClientKey, verificationCodeMatches } from "./player-identity.js";
import { applyPlayAction, consumeVerificationChallenge, createPlayerSession, createPlayerWithSession, createVerificationChallenge, getPlay, getPlayer, getPlayerByEmailKey, getPlayerByNormalizedName, getPlayerSession, getVerificationChallenge, insertFeedback, listFeedback, listPlayerSessions, listPuzzles, markFeedbackSubmitted, NameUnavailableError, playerNameAvailable, PlayConflictError, recordVerificationFailure, revokePlayerSession, startPlay, touchPlayer, touchPlayerSession, VerificationConflictError, VerificationRateLimitError, createPuzzle, getPuzzle, updatePuzzle, type PlayContext, type PlayerRecord, type PlayerSession, type VerificationPurpose, setPublicStats } from "./storage.js";
import { suggestPuzzle } from "./suggestions.js";
import { verificationSender } from "./verification-sender.js";
import { currentDaily, getDailyAssignment, recordPublicExposure, voidDailyAssignment } from "./daily-schedule.js";
import { playerStats, rankingsPage, RankingsError } from "./rankings.js";

const launchDate = parseGameLaunchDate();
const playerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const operationIdPattern = /^[A-Za-z0-9_-]{1,100}$/;
const playIdPattern = /^[A-Za-z0-9_-]{8,100}$/;

async function authenticatedPlayer(request: HttpRequest, context: InvocationContext): Promise<{ player: PlayerRecord; session: PlayerSession } | { denied: HttpResponseInit }> {
  const playerId = request.headers.get("x-emojizzle-player-id") ?? "";
  const sessionId = request.headers.get("x-emojizzle-player-session-id") ?? "";
  const token = request.headers.get("x-emojizzle-player-token") ?? "";
  if (!playerIdPattern.test(playerId) || !sessionIdPattern.test(sessionId) || !token) {
    context.warn("Player authentication denied: malformed or missing credential");
    return { denied: json({ error: "Player session required", code: "PLAYER_SESSION_MALFORMED" }, 401) };
  }
  const player = await getPlayer(playerId);
  if (!player) {
    context.warn("Player authentication denied: unknown player");
    return { denied: json({ error: "Player not found", code: "PLAYER_NOT_FOUND" }, 401) };
  }
  const session = await getPlayerSession(sessionId);
  if (!session || session.playerId !== playerId) {
    context.warn("Player authentication denied: unknown session");
    return { denied: json({ error: "Player session is invalid", code: "PLAYER_SESSION_INVALID" }, 401) };
  }
  if (session.revokedAt) {
    context.warn("Player authentication denied: revoked session");
    return { denied: json({ error: "Player session was revoked", code: "PLAYER_SESSION_REVOKED" }, 401) };
  }
  if (!playerTokenMatches(token, session.tokenHash)) {
    context.warn("Player authentication denied: token mismatch");
    return { denied: json({ error: "Player session is invalid", code: "PLAYER_SESSION_INVALID" }, 401) };
  }
  return { player: await touchPlayer(player), session: await touchPlayerSession(session) };
}

function validPlayIdentifiers(playId: unknown, operationId?: unknown) {
  return typeof playId === "string" && playIdPattern.test(playId) && (operationId === undefined || (typeof operationId === "string" && operationIdPattern.test(operationId)));
}

function publicPuzzle(puzzle: StoredPuzzle, puzzles: StoredPuzzle[], context: "daily" | "practice" | "challenge" | "author-test", now = new Date()) {
  const dateCode = context === "daily" ? now.toISOString().slice(2, 10).replace(/-/g, "") : null;
  const originalDate = new Date(launchDate + (puzzle.position - 1) * 86_400_000).toISOString().slice(2, 10).replace(/-/g, "");
  return { id: puzzle.id, number: puzzle.number, emoji: puzzle.emoji, hintCount: puzzle.hints.length, pool: puzzle.pool, context, sequenceNumber: puzzles.findIndex((item) => item.id === puzzle.id) + 1, sequenceLength: puzzles.length, dateCode, rankingEligible: false, legacyStorageEligible: dateCode !== null && dateCode === originalDate };
}

export async function currentPuzzle(request: HttpRequest) {
  const mode = request.query.get("mode") ?? "daily";
  if (mode !== "practice" && (mode === "next" || request.query.has("puzzle")) && !isAdmin(request)) return json({ error: "Admin preview required" }, 403);
  if (mode !== "practice" && mode !== "next" && !request.query.has("puzzle")) {
    const { puzzle, assignment } = await currentDaily();
    if (!puzzle) return json({ error: "Today's Daily puzzle is unavailable. You can still play Practice.", code: "DAILY_UNAVAILABLE" }, 503);
    return json({ puzzle: { ...publicPuzzle(puzzle, [puzzle], "daily"), rankingEligible: !assignment.void, legacyStorageEligible: false } });
  }
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
  if (pool === "practice") await recordPublicExposure(selected.id);
  return json({ puzzle: publicPuzzle(selected, puzzles, context), ...(nextPuzzleNumber ? { nextPuzzleNumber } : {}) });
}

async function puzzleForPlay(request: HttpRequest, playerId: string, payload: { puzzleId?: unknown; playId?: unknown; pool?: unknown } | null) {
  if (!payload || typeof payload.puzzleId !== "string" || !validPlayIdentifiers(payload.playId)) return null;
  const play = await getPlay(playerId, payload.playId as string);
  if (!play || play.puzzleId !== payload.puzzleId || play.pool !== payload.pool) return null;
  if (play.context === "author-test" && !isAdmin(request)) throw new RankingsError("Admin preview required", 403);
  if (play.pool === "daily" && play.context !== "daily" && play.context !== "author-test") return null;
  if (play.context === "daily" && play.dailyDate) {
    const assignment = await getDailyAssignment(play.dailyDate);
    return assignment?.puzzleId === play.puzzleId && assignment.revision === play.puzzleRevision ? assignment.puzzle : null;
  }
  return getPuzzle(play.puzzleId);
}

export async function guess(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; guess?: string; playId?: string; operationId?: string }>(request);
  const puzzle = await puzzleForPlay(request, identity.player.playerId, payload);
  const candidate = payload?.guess?.trim() ?? "";
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !candidate || candidate.length > 120 || (typeof payload?.operationId !== "string" || !validPlayIdentifiers(payload?.playId, payload?.operationId))) return json({ error: "Invalid guess" }, 400);
  const correct = isAcceptedGuess(puzzle, candidate);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "guess", correct, fingerprint: createHash("sha256").update(candidate).digest("hex") }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  if (!correct) return json({ correct: false });
  return json({ correct: true, resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

export async function hint(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; hintIndex?: number; playId?: string; operationId?: string }>(request);
  const puzzle = await puzzleForPlay(request, identity.player.playerId, payload);
  const index = payload?.hintIndex;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || !Number.isInteger(index) || (index as number) < 0 || (typeof payload?.operationId !== "string" || !validPlayIdentifiers(payload?.playId, payload?.operationId))) return json({ error: "Invalid hint request" }, 400);
  const value = puzzle.hints[index as number];
  if (!value) return json({ error: "No more hints" }, 404);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "hint", hintIndex: index }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  return json({ hint: value });
}

export async function reveal(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<{ puzzleId?: string; pool?: PuzzlePool; playId?: string; operationId?: string }>(request);
  const puzzle = await puzzleForPlay(request, identity.player.playerId, payload);
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== payload?.pool || (typeof payload?.operationId !== "string" || !validPlayIdentifiers(payload?.playId, payload?.operationId))) return json({ error: "Invalid puzzle" }, 400);
  try { await applyPlayAction({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, pool: puzzle.pool, operationId: payload.operationId!, kind: "reveal" }); }
  catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
  return json({ resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } });
}

export async function feedback(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<Record<string, unknown>>(request);
  const pool = payload?.pool === "daily" || payload?.pool === "practice" ? payload.pool : null;
  const puzzle = await puzzleForPlay(request, identity.player.playerId, payload);
  const comment = typeof payload?.comment === "string" ? payload.comment.trim() || null : null;
  if (!puzzle || puzzle.status !== "published" || puzzle.pool !== pool || puzzle.number !== payload?.puzzleNumber || (payload?.rating !== "up" && payload?.rating !== "down") || !validPlayIdentifiers(payload?.playId) || typeof payload?.anonymousSessionId !== "string" || (comment?.length ?? 0) > 500 || (pool === "practice" && comment !== null)) return json({ error: "Invalid feedback" }, 400);
  const play = await getPlay(identity.player.playerId, payload.playId as string);
  if (!play || play.puzzleId !== puzzle.id || play.pool !== pool || play.outcome === "playing") return json({ error: "Completed play required" }, 409);
  if (play.feedbackSubmittedAt) return json({ saved: true });
  await insertFeedback({ puzzleId: puzzle.id, puzzleNumber: puzzle.number, puzzlePool: pool, rating: payload.rating, comment, playId: play.playId, anonymousSessionId: payload.anonymousSessionId.slice(0,80), playerId: identity.player.playerId, displayName: identity.player.displayName, outcome: play.outcome, guessCount: play.guessCount, hintCount: play.hintCount, metadataJson: JSON.stringify(payload.metadata ?? {}).slice(0,2000) });
  await markFeedbackSubmitted(identity.player.playerId, play.playId);
  return json({ saved: true }, 201);
}

async function playerAvailability(request: HttpRequest) {
  const normalized = normalizePlayerName(request.query.get("name"));
  if (!normalized) return json({ valid: false, available: false, error: "Use 3–20 letters, numbers, spaces, _ or -." });
  return json({ valid: true, available: await playerNameAvailable(normalized.normalizedDisplayName) });
}

function publicIdentity(player: PlayerRecord, sessionId: string, token: string) {
  return { playerId: player.playerId, displayName: player.displayName, sessionId, token };
}

async function playerVerifications(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ purpose?: VerificationPurpose; displayName?: string; email?: string }>(request);
  const purpose = payload?.purpose === "create" || payload?.purpose === "recover" ? payload.purpose : null;
  const email = normalizeRecoveryEmail(payload?.email);
  if (!purpose || !email) return json({ error: "Enter a valid email address." }, 400);
  const emailKey = recoveryEmailKey(email);
  const clientAddress = (request.headers.get("x-azure-clientip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  const clientKey = clientAddress ? verificationClientKey(clientAddress) : undefined;
  let proposedName: ReturnType<typeof normalizePlayerName> = null;
  let player: PlayerRecord | null = null;
  if (purpose === "create") {
    proposedName = normalizePlayerName(payload?.displayName);
    if (!proposedName) return json({ error: "Use 3–20 letters, numbers, spaces, _ or -." }, 400);
    if (!await playerNameAvailable(proposedName.normalizedDisplayName)) return json({ error: "That display name is already taken." }, 409);
  } else {
    player = await getPlayerByEmailKey(emailKey);
  }
  const challengeId = randomUUID();
  const code = createVerificationCode();
  let challengeCreated = false;
  try {
    await createVerificationChallenge({
      challengeId, purpose, emailKey, clientKey,
      ...(proposedName ? { proposedDisplayName: proposedName.displayName, normalizedDisplayName: proposedName.normalizedDisplayName } : {}),
      ...(player ? { playerId: player.playerId } : {}),
      codeHash: hashVerificationCode(challengeId, code),
    });
    challengeCreated = true;
    await verificationSender().sendPlayerVerificationCode(email, code);
    return json({ challengeId, message: "If that address can be used, a verification code is on its way." }, 202);
  } catch (error) {
    if (error instanceof VerificationRateLimitError) return json({ error: "Please wait before requesting another code." }, 429);
    if (challengeCreated) {
      const failed = await getVerificationChallenge(challengeId);
      if (failed && !failed.consumedAt) await consumeVerificationChallenge(failed).catch(() => undefined);
    }
    throw error;
  }
}

async function confirmPlayerVerification(request: HttpRequest) {
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ challengeId?: string; code?: string }>(request);
  if (!payload?.challengeId || !sessionIdPattern.test(payload.challengeId) || typeof payload.code !== "string") return json({ error: "Enter the 6-digit verification code." }, 400);
  const challenge = await getVerificationChallenge(payload.challengeId);
  if (!challenge || challenge.consumedAt || Date.parse(challenge.expiresAt) <= Date.now() || challenge.attemptCount >= 8) return json({ error: "That verification code is invalid or expired." }, 400);
  if (!verificationCodeMatches(challenge.challengeId, payload.code, challenge.codeHash)) {
    await recordVerificationFailure(challenge);
    return json({ error: "That verification code is invalid or expired." }, 400);
  }
  try { await consumeVerificationChallenge(challenge); }
  catch (error) { if (error instanceof VerificationConflictError) return json({ error: "That verification code was already used." }, 409); throw error; }
  const sessionId = randomUUID(); const token = createPlayerToken();
  if (challenge.purpose === "create") {
    if (!challenge.proposedDisplayName || !challenge.normalizedDisplayName) return json({ error: "That verification request is incomplete." }, 400);
    try {
      const result = await createPlayerWithSession({ playerId: randomUUID(), displayName: challenge.proposedDisplayName, normalizedDisplayName: challenge.normalizedDisplayName, recoveryEmailKey: challenge.emailKey, sessionId, tokenHash: hashPlayerToken(token) });
      return json(publicIdentity(result.player, sessionId, token), 201);
    } catch (error) {
      if (error instanceof NameUnavailableError) return json({ error: "That player name or email was claimed while you verified. Please start again." }, 409);
      throw error;
    }
  }
  if (!challenge.playerId) return json({ error: "No player could be recovered with that verified address." }, 404);
  const player = await getPlayer(challenge.playerId);
  if (!player) return json({ error: "No player could be recovered with that verified address." }, 404);
  await createPlayerSession({ sessionId, playerId: player.playerId, tokenHash: hashPlayerToken(token) });
  return json(publicIdentity(player, sessionId, token), 201);
}

async function currentPlayerSession(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  if (request.method === "DELETE") {
    await revokePlayerSession(identity.session.sessionId);
    return json({ revoked: true });
  }
  return json({ playerId: identity.player.playerId, displayName: identity.player.displayName, sessionId: identity.session.sessionId });
}

export async function playsStart(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<{ playId?: string; puzzleId?: string; pool?: PuzzlePool; context?: PlayContext }>(request);
  if (!payload || !validPlayIdentifiers(payload.playId) || typeof payload.puzzleId !== "string") return json({ error: "Invalid play" }, 400);
  if (payload.context === "author-test" && !isAdmin(request)) return json({ error: "Admin preview required" }, 403);
  if (!(payload.context === "daily" && payload.pool === "daily" || (payload.context === "practice" || payload.context === "challenge") && payload.pool === "practice" || payload.context === "author-test")) return json({ error: "Invalid play context" }, 400);
  const daily = payload.context === "daily" ? await currentDaily() : null;
  const puzzle = daily ? daily.puzzle : await getPuzzle(payload.puzzleId);
  if (!puzzle || puzzle.id !== payload.puzzleId || puzzle.status !== "published" || puzzle.pool !== payload.pool) return json({ error: "This puzzle is no longer available here. Open today's Daily puzzle.", code: "DAILY_CHANGED" }, 409);
  if (puzzle.pool === "practice" && payload.context !== "author-test") await recordPublicExposure(puzzle.id);
  try {
    const assignment = daily?.assignment;
    const result = await startPlay({ playerId: identity.player.playerId, playId: payload.playId!, puzzleId: puzzle.id, puzzleNumber: puzzle.number, pool: puzzle.pool, context: payload.context!, rankingEligible: Boolean(assignment && !assignment.void),
      ...(assignment ? { dailyDate: assignment.dailyDate, puzzleRevision: assignment.revision!, rankingOutcome: "pending" as const } : {}) });
    return json({
      play: result.play,
      hints: puzzle.hints.slice(0, result.play.hintCount),
      ...(result.play.outcome !== "playing" ? { resolution: { answer: puzzle.answer, category: puzzle.category, explanation: puzzle.explanation } } : {}),
    }, result.created ? 201 : 200);
  } catch (error) { if (error instanceof PlayConflictError) return json({ error: error.message }, 409); throw error; }
}

export async function myStats(request: HttpRequest, context: InvocationContext) {
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const window = request.query.get("window") ?? "all";
  if (window !== "all" && window !== "30d") return json({ error: "Invalid stats window" }, 400);
  return json(await playerStats(identity.player, window));
}
export async function playerPreferences(request: HttpRequest, context: InvocationContext) {
  const denied = requireOrigin(request); if (denied) return denied;
  const identity = await authenticatedPlayer(request, context); if ("denied" in identity) return identity.denied;
  const payload = await body<{ publicStats?: boolean }>(request);
  if (typeof payload?.publicStats !== "boolean") return json({ error: "Choose whether to show Daily stats publicly" }, 400);
  await setPublicStats(identity.player.playerId, payload.publicStats);
  return json({ publicStats: payload.publicStats });
}
export async function publicRankings(request: HttpRequest) {
  if ((request.query.get("window") ?? "30d") !== "30d") return json({ error: "Invalid ranking window" }, 400);
  return json(await rankingsPage(request.query.get("cursor") ?? undefined));
}
async function voidDaily(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  const denied = requireOrigin(request); if (denied) return denied;
  const payload = await body<{ dailyDate?: string }>(request);
  if (!payload?.dailyDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dailyDate)) return json({ error: "Daily date required" }, 400);
  return await voidDailyAssignment(payload.dailyDate) ? json({ void: true }) : json({ error: "Daily assignment not found" }, 404);
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

async function adminPlayerSupport(request: HttpRequest) {
  const unauthorized = requireAdmin(request); if (unauthorized) return unauthorized;
  const normalized = normalizePlayerName(request.query.get("name"));
  if (!normalized) return json({ error: "Enter an exact player name." }, 400);
  const player = await getPlayerByNormalizedName(normalized.normalizedDisplayName);
  if (!player) return json({ error: "Player not found" }, 404);
  const sessions = await listPlayerSessions(player.playerId);
  return json({
    player: {
      playerId: player.playerId,
      displayName: player.displayName,
      recoveryEnabled: Boolean(player.recoveryVerifiedAt),
      activeSessionCount: sessions.filter((item) => !item.revokedAt).length,
      createdAt: player.createdAt,
      lastSeenAt: player.lastSeenAt,
    },
  });
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
    catch (error) { if (error instanceof RankingsError) return json({ error: error.message }, error.status); if (error instanceof PlayConflictError) return json({ error: error.message }, 409); context.error(error); return json({ error: "The service could not complete the request" }, 500); }
  };
}

app.http("currentPuzzle", { methods: ["GET"], authLevel: "anonymous", route: "puzzles/current", handler: handle(currentPuzzle) });
app.http("playerAvailability", { methods: ["GET"], authLevel: "anonymous", route: "players/availability", handler: handle(playerAvailability) });
app.http("playerVerifications", { methods: ["POST"], authLevel: "anonymous", route: "player-verifications", handler: handle(playerVerifications) });
app.http("confirmPlayerVerification", { methods: ["POST"], authLevel: "anonymous", route: "player-verifications/confirm", handler: handle(confirmPlayerVerification) });
app.http("currentPlayerSession", { methods: ["GET", "DELETE"], authLevel: "anonymous", route: "player-sessions/current", handler: handle(currentPlayerSession) });
app.http("playsStart", { methods: ["POST"], authLevel: "anonymous", route: "plays/start", handler: handle(playsStart) });
app.http("guess", { methods: ["POST"], authLevel: "anonymous", route: "guess", handler: handle(guess) });
app.http("hint", { methods: ["POST"], authLevel: "anonymous", route: "hint", handler: handle(hint) });
app.http("reveal", { methods: ["POST"], authLevel: "anonymous", route: "reveal", handler: handle(reveal) });
app.http("feedback", { methods: ["POST"], authLevel: "anonymous", route: "feedback", handler: handle(feedback) });
app.http("adminSession", { methods: ["GET", "POST", "DELETE"], authLevel: "anonymous", route: "manage/session", handler: handle(session) });
app.http("adminPuzzles", { methods: ["GET", "POST"], authLevel: "anonymous", route: "manage/puzzles", handler: handle(adminPuzzles) });
app.http("adminPuzzle", { methods: ["GET", "PATCH", "DELETE"], authLevel: "anonymous", route: "manage/puzzles/{id}", handler: handle(adminPuzzle) });
app.http("adminFeedback", { methods: ["GET"], authLevel: "anonymous", route: "manage/feedback", handler: handle(adminFeedback) });
app.http("adminPlayerSupport", { methods: ["GET"], authLevel: "anonymous", route: "manage/players", handler: handle(adminPlayerSupport) });
app.http("adminPuzzleSuggestions", { methods: ["POST"], authLevel: "anonymous", route: "manage/puzzle-suggestions", handler: handle(adminPuzzleSuggestions) });

app.http("myStats", { methods: ["GET"], authLevel: "anonymous", route: "players/me/stats", handler: handle(myStats) });
app.http("playerPreferences", { methods: ["PATCH"], authLevel: "anonymous", route: "players/me/preferences", handler: handle(playerPreferences) });
app.http("publicRankings", { methods: ["GET"], authLevel: "anonymous", route: "rankings", handler: handle(publicRankings) });
app.http("voidDaily", { methods: ["POST"], authLevel: "anonymous", route: "manage/daily/void", handler: handle(voidDaily) });
