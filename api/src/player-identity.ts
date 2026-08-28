import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type NormalizedPlayerName = {
  displayName: string;
  normalizedDisplayName: string;
};

export function normalizePlayerName(value: unknown): NormalizedPlayerName | null {
  if (typeof value !== "string") return null;
  const displayName = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (displayName.length < 3 || displayName.length > 20) return null;
  if (!/^[A-Za-z0-9 _-]+$/.test(displayName)) return null;
  return { displayName, normalizedDisplayName: displayName.toLowerCase() };
}

export function createPlayerToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPlayerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function playerTokenMatches(token: string, expectedHash: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashPlayerToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isRankingEligiblePlay(context: string, pool: string, isCurrentDaily: boolean) {
  return context === "daily" && pool === "daily" && isCurrentDaily;
}
