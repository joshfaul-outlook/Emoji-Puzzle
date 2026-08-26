import assert from "node:assert/strict";
import test from "node:test";
import { isAcceptedGuess, normalizeGuess, validatePuzzle } from "../src/model.ts";
import { adminConfigured, createSessionCookie, isAdmin, originAllowed, passwordAccepted } from "../src/auth.ts";

const puzzle = { answer: "Vincent van Gogh", acceptedAnswers: ["Vincent van Gogh", "Van Gogh"], pool: "daily", emoji: "🎨 🌻 👂", category: "Person", explanation: "A painter represented by sunflowers and his famous injured ear.", hints: ["Person", "Painter", "The ear"], status: "published" };

test("normalizes guesses without fuzzy matching", () => {
  assert.equal(normalizeGuess(" Víncent van-Gogh! "), "vincent van gogh");
  assert.equal(isAcceptedGuess(puzzle, "VincentvanGogh"), true);
  assert.equal(isAcceptedGuess(puzzle, "Vincnet van Gogh"), false);
});

test("allows answer-only drafts and validates all publish fields", () => {
  assert.equal(validatePuzzle({ answer: "Draft", pool: "practice" }, "draft"), null);
  assert.equal(validatePuzzle({ ...puzzle, emoji: "" }, "published"), "Published puzzles need an emoji sequence.");
  assert.equal(validatePuzzle(puzzle, "published"), null);
});

test("signs admin sessions and rejects wrong passwords and tampered cookies", () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
  process.env.ADMIN_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
  try {
    assert.equal(adminConfigured(), true);
    assert.equal(passwordAccepted("correct horse battery staple"), true);
    assert.equal(passwordAccepted("wrong"), false);
    const cookie = createSessionCookie().split(";")[0];
    const request = { headers: { get: (name) => name === "cookie" ? cookie : null } };
    assert.equal(isAdmin(request), true);
    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;
    assert.equal(isAdmin({ headers: { get: (name) => name === "cookie" ? tampered : null } }), false);
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test("requires same-origin mutation requests", () => {
  const request = { url: "https://emoji.example/api/admin/puzzles", headers: { get: (name) => name === "origin" ? "https://emoji.example" : null } };
  assert.equal(originAllowed(request), true);
  assert.equal(originAllowed({ ...request, headers: { get: (name) => name === "origin" ? "https://attacker.example" : null } }), false);
});
