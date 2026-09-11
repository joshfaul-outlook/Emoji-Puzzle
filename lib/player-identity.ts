export const PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v3";
export const LEGACY_PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v2";
export const OLDEST_PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v1";
export const KNOWN_PLAYER_KEY = "emojizzle-known-player:v1";
export const PENDING_PLAYER_IDENTITY_KEY = "emojizzle-pending-player-identity:v1";

export type PlayerIdentity = { kind: "player"; playerId: string; displayName: string; sessionId: string; token: string };
export type AnonymousIdentity = { kind: "anonymous"; playerId: string; sessionId: string; token: string };
export type BrowserIdentity = PlayerIdentity | AnonymousIdentity;
export type KnownPlayer = { displayName: string };
export type PendingPlayerIdentity = { identity: PlayerIdentity; activateOn: string };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const uuid = /^[0-9a-f-]{36}$/i;
const token = /^[A-Za-z0-9_-]{43}$/;

export function normalizePlayerName(value: string) {
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (displayName.length < 3 || displayName.length > 20 || !/^[A-Za-z0-9 _-]+$/.test(displayName)) return null;
  return { displayName, normalizedDisplayName: displayName.toLowerCase() };
}

function parseIdentity(raw: string | null): BrowserIdentity | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { kind?: unknown; playerId?: unknown; displayName?: unknown; sessionId?: unknown; token?: unknown };
    if (typeof value.playerId !== "string" || !uuid.test(value.playerId) || typeof value.sessionId !== "string" || !uuid.test(value.sessionId) || typeof value.token !== "string" || !token.test(value.token)) return null;
    if (value.kind === "anonymous") return { kind: "anonymous", playerId: value.playerId, sessionId: value.sessionId, token: value.token };
    // v2 identities predate the discriminator and are named players.
    if (value.kind !== undefined && value.kind !== "player") return null;
    if (typeof value.displayName !== "string" || !normalizePlayerName(value.displayName)) return null;
    return { kind: "player", playerId: value.playerId, displayName: value.displayName, sessionId: value.sessionId, token: value.token };
  } catch { return null; }
}

export function readPlayerIdentity(storage: Pick<Storage, "getItem">): BrowserIdentity | null {
  return parseIdentity(storage.getItem(PLAYER_IDENTITY_KEY)) ?? parseIdentity(storage.getItem(LEGACY_PLAYER_IDENTITY_KEY));
}

export function migratePlayerIdentity(storage: StorageLike) {
  const current = parseIdentity(storage.getItem(PLAYER_IDENTITY_KEY));
  if (current) return current;
  const legacy = parseIdentity(storage.getItem(LEGACY_PLAYER_IDENTITY_KEY));
  if (legacy) savePlayerIdentity(storage, legacy);
  return legacy;
}

export function savePlayerIdentity(storage: StorageLike, identity: BrowserIdentity) {
  storage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
  if (identity.kind === "player") storage.setItem(KNOWN_PLAYER_KEY, JSON.stringify({ displayName: identity.displayName }));
  storage.removeItem(LEGACY_PLAYER_IDENTITY_KEY);
  storage.removeItem(OLDEST_PLAYER_IDENTITY_KEY);
}

export function clearPlayerIdentity(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(PLAYER_IDENTITY_KEY);
  storage.removeItem(LEGACY_PLAYER_IDENTITY_KEY);
  storage.removeItem(OLDEST_PLAYER_IDENTITY_KEY);
}

export function readKnownPlayer(storage: Pick<Storage, "getItem">): KnownPlayer | null {
  try {
    const value = JSON.parse(storage.getItem(KNOWN_PLAYER_KEY) ?? "null") as Partial<KnownPlayer> | null;
    return value && typeof value.displayName === "string" && normalizePlayerName(value.displayName) ? { displayName: value.displayName } : null;
  } catch { return null; }
}

export function invalidatePlayerIdentity(storage: StorageLike, identity: BrowserIdentity) {
  if (identity.kind === "player") storage.setItem(KNOWN_PLAYER_KEY, JSON.stringify({ displayName: identity.displayName }));
  clearPlayerIdentity(storage);
}

export function readPendingPlayerIdentity(storage: Pick<Storage, "getItem">): PendingPlayerIdentity | null {
  try {
    const value = JSON.parse(storage.getItem(PENDING_PLAYER_IDENTITY_KEY) ?? "null") as Partial<PendingPlayerIdentity> | null;
    if (!value || typeof value.activateOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.activateOn) || !value.identity) return null;
    const identity = parseIdentity(JSON.stringify(value.identity));
    return identity?.kind === "player" ? { identity, activateOn: value.activateOn } : null;
  } catch { return null; }
}

export function savePendingPlayerIdentity(storage: Pick<Storage, "setItem">, pending: PendingPlayerIdentity) {
  storage.setItem(PENDING_PLAYER_IDENTITY_KEY, JSON.stringify(pending));
}

export function clearPendingPlayerIdentity(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(PENDING_PLAYER_IDENTITY_KEY);
}

export function playerHeaders(identity: BrowserIdentity) {
  return { "x-emojizzle-player-id": identity.playerId, "x-emojizzle-player-session-id": identity.sessionId, "x-emojizzle-player-token": identity.token };
}
