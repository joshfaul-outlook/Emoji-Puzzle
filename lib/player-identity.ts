export const PLAYER_IDENTITY_KEY = "emojizzle-player-identity:v1";

export type PlayerIdentity = { playerId: string; displayName: string; token: string };
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
    if (typeof value.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value.token)) return null;
    return { playerId: value.playerId, displayName: value.displayName, token: value.token };
  } catch { return null; }
}

export function savePlayerIdentity(storage: StorageLike, identity: PlayerIdentity) {
  storage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
}

export function clearPlayerIdentity(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(PLAYER_IDENTITY_KEY);
}

export function playerHeaders(identity: PlayerIdentity) {
  return { "x-emojizzle-player-id": identity.playerId, "x-emojizzle-player-token": identity.token };
}
