import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { isAdmin, originAllowed } from "./auth.js";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): HttpResponseInit {
  return { status, jsonBody: body, headers: { "cache-control": "no-store", ...headers } };
}

export function requireOrigin(request: HttpRequest) {
  return originAllowed(request) ? null : json({ error: "Origin not allowed" }, 403);
}

export function requireAdmin(request: HttpRequest) {
  return isAdmin(request) ? null : json({ error: "Authentication required" }, 401);
}

export async function body<T>(request: HttpRequest) {
  return await request.json().catch(() => null) as T | null;
}
