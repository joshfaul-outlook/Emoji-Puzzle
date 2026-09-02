export const defaultGameLaunchDate = "2026-08-05";

export function parseGameLaunchDate(value = process.env.GAME_LAUNCH_DATE) {
  const configured = value?.trim() || defaultGameLaunchDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(configured)) {
    throw new Error("GAME_LAUNCH_DATE must use YYYY-MM-DD format");
  }
  const parsed = Date.parse(`${configured}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== configured) {
    throw new Error("GAME_LAUNCH_DATE must be a valid UTC calendar date");
  }
  return parsed;
}
