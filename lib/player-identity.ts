export const PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v2";
export const LEGACY_PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v1";
export const KNOWN_PLAYER_KEY = "emojizzle-known-player:v1";

export type PlayerIdentity = { playerId: string; displayName: string; sessionId: string; token: string };
export type KnownPlayer = { displayName: string };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function normalizePlayerName(value: string) {
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (displayName.length < 3 || displayName.length > 20 || !/^[A-Za-z0-9 _-]+$/.test(displayName)) return null;
  return { displayName, normalizedDisplayName: displayName.toLowerCase() };
}

export function readPlayerIdentity(storage: Pick<Storage, "getItem">): PlayerIdentity | null {
  const raw = storage.getItem(PLAYER_IDENTITY_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PlayerIdentity>;
    if (typeof value.playerId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.playerId)) return null;
    if (typeof value.displayName !== "string" || !normalizePlayerName(value.displayName)) return null;
    if (typeof value.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.sessionId)) return null;
    if (typeof value.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.token)) return null;
    return { playerId: value.playerId, displayName: value.displayName, sessionId: value.sessionId, token: value.token };
  } catch { return null; }
}

export function savePlayerIdentity(storage: StorageLike, identity: PlayerIdentity) {
  storage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
  storage.setItem(KNOWN_PLAYER_KEY, JSON.stringify({ displayName: identity.displayName }));
  storage.removeItem(LEGACY_PLAYER_IDENTITY_KEY);
}

export function clearPlayerIdentity(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(PLAYER_IDENTITY_KEY);
  storage.removeItem(LEGACY_PLAYER_IDENTITY_KEY);
}

export function readKnownPlayer(storage: Pick<Storage, "getItem">): KnownPlayer | null {
  try {
    const value = JSON.parse(storage.getItem(KNOWN_PLAYER_KEY) ?? "null") as Partial<KnownPlayer> | null;
    return value && typeof value.displayName === "string" && normalizePlayerName(value.displayName) ? { displayName: value.displayName } : null;
  } catch { return null; }
}

export function invalidatePlayerIdentity(storage: StorageLike, identity: PlayerIdentity) {
  storage.setItem(KNOWN_PLAYER_KEY, JSON.stringify({ displayName: identity.displayName }));
  clearPlayerIdentity(storage);
}

export function playerHeaders(identity: PlayerIdentity) {
  return { "x-emojizzle-player-id": identity.playerId, "x-emojizzle-player-session-id": identity.sessionId, "x-emojizzle-player-token": identity.token };
}
