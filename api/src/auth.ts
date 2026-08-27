import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { HttpRequest } from "@azure/functions";

export const sessionCookieName = "emoji_admin_session";
const twelveHours = 12 * 60 * 60;

function safeEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function configuredSecrets() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  return password && secret && secret.length >= 32 ? { password, secret } : null;
}

export function adminConfigured() { return configuredSecrets() !== null; }

export function passwordAccepted(candidate: string) {
  const secrets = configuredSecrets();
  return Boolean(secrets && safeEqual(candidate, secrets.password));
}

export function createSessionCookie() {
  const secrets = configuredSecrets();
  if (!secrets) throw new Error("Admin is not configured");
  const expires = Math.floor(Date.now() / 1000) + twelveHours;
  const payload = Buffer.from(JSON.stringify({ expires })).toString("base64url");
  return `${sessionCookieName}=${payload}.${signature(payload, secrets.secret)}; Path=/; Max-Age=${twelveHours}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isAdmin(request: HttpRequest) {
  const secrets = configuredSecrets();
  if (!secrets) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1);
  if (!cookie) return false;
  const [payload, received] = cookie.split(".");
  if (!payload || !received || !safeEqual(received, signature(payload, secrets.secret))) return false;
  try { return Number((JSON.parse(Buffer.from(payload, "base64url").toString()) as { expires?: number }).expires) > Math.floor(Date.now() / 1000); }
  catch { return false; }
}

export function originAllowed(request: HttpRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestUrl = new URL(request.url);
    const expectedHost = forwardedHost || requestUrl.host;
    const configuredOrigin = process.env.SITE_ORIGIN;
    return origin === configuredOrigin || originUrl.host === expectedHost || (originUrl.hostname === "localhost" && requestUrl.hostname === "localhost");
  } catch { return false; }
}
