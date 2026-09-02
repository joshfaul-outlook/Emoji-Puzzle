import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

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

export function normalizeRecoveryEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function recoverySecret() {
  const secret = process.env.PLAYER_RECOVERY_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new Error("PLAYER_RECOVERY_HMAC_SECRET must contain at least 32 characters");
  return secret;
}

export function recoveryEmailKey(normalizedEmail: string) {
  return createHmac("sha256", recoverySecret()).update(`email:${normalizedEmail}`).digest("hex");
}

export function verificationClientKey(address: string) {
  return createHmac("sha256", recoverySecret()).update(`client:${address}`).digest("hex");
}

export function createVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashVerificationCode(challengeId: string, code: string) {
  return createHmac("sha256", recoverySecret()).update(`code:${challengeId}:${code}`).digest("hex");
}

export function verificationCodeMatches(challengeId: string, code: string, expectedHash: string) {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(hashVerificationCode(challengeId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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
