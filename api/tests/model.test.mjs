import assert from "node:assert/strict";
import test from "node:test";
import { isAcceptedGuess, normalizeGuess, validatePuzzle } from "../src/model.ts";
import { adminConfigured, createSessionCookie, isAdmin, originAllowed, passwordAccepted } from "../src/auth.ts";
import { moveInCatalog, positionsForOrder } from "../src/ordering.ts";
import { suggestPuzzle } from "../src/suggestions.ts";

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

test("moves records across a catalog larger than Azure's batch limit", () => {
  const order = { daily: Array.from({ length: 351 }, (_, index) => `p${index + 1}`), practice: [] };
  const moved = moveInCatalog(order, "p351", "daily", 10);
  assert.equal(moved.daily[9], "p351");
  assert.equal(positionsForOrder(moved).get("p351"), 10);
  assert.equal(moved.daily.length, 351);
});

test("parses and normalizes a structured AI suggestion", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const response = await suggestPuzzle("Moonlight", async () => new Response(JSON.stringify({ output_text: JSON.stringify({ emoji: "🌙 ✨", category: "Concept", acceptedAnswers: ["moon light"], hints: ["A concept", "Think about the night", "It shines from the moon"], explanation: "Moonlight is light reflected from the moon." }) }), { status: 200, headers: { "content-type": "application/json" } }));
  assert.deepEqual(response.acceptedAnswers, ["Moonlight", "moon light"]);
  assert.equal(response.hints.length, 3);
  delete process.env.OPENAI_API_KEY;
});
