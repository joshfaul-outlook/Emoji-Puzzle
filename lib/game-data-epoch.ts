import { PRACTICE_PROGRESS_KEY } from "./play-state.ts";

export const GAME_DATA_EPOCH = "refine-stats-v1";
export const GAME_DATA_EPOCH_KEY = "emojizzle-game-data-epoch";

type LocalStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
type SessionStorageLike = Pick<Storage, "removeItem">;

export function applyGameDataEpoch(local: LocalStorageLike, session: SessionStorageLike) {
  if (local.getItem(GAME_DATA_EPOCH_KEY) === GAME_DATA_EPOCH) return false;

  const obsolete: string[] = [];
  for (let index = 0; index < local.length; index += 1) {
    const key = local.key(index);
    if (key && (key.startsWith("emoji-daily-play:") || key === PRACTICE_PROGRESS_KEY)) obsolete.push(key);
  }
  for (const key of obsolete) local.removeItem(key);
  session.removeItem("emoji-daily-active-mode");
  local.setItem(GAME_DATA_EPOCH_KEY, GAME_DATA_EPOCH);
  return true;
}
