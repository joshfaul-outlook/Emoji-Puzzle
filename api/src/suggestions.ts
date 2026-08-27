export type PuzzleSuggestion = { emoji: string; category: string; acceptedAnswers: string[]; hints: [string, string, string]; explanation: string };

const schema = { type: "object", additionalProperties: false, required: ["emoji", "category", "acceptedAnswers", "hints", "explanation"], properties: {
  emoji: { type: "string" }, category: { type: "string" }, acceptedAnswers: { type: "array", items: { type: "string" } }, hints: { type: "array", items: { type: "string" } }, explanation: { type: "string" },
} };

export async function suggestPuzzle(answer: string, fetcher: typeof fetch = fetch): Promise<PuzzleSuggestion> {
  const key = process.env.OPENAI_API_KEY; if (!key) throw Object.assign(new Error("AI help is not configured"), { statusCode: 503 });
  const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-luna", store: false, reasoning: { effort: "low" }, max_output_tokens: 700, input: [{ role: "system", content: "You are an expert emoji puzzle editor. Create fair, concise clues for a broad US audience. Hints must progress from category, to interpretation, to near-answer without stating the answer. Accepted answers should be genuine spelling, punctuation, or common-name variants only." }, { role: "user", content: `Create a puzzle draft for this answer phrase: ${answer}` }], text: { format: { type: "json_schema", name: "puzzle_suggestion", strict: true, schema } } }) });
  if (!response.ok) throw Object.assign(new Error("OpenAI request failed"), { statusCode: 502 });
  const body = await response.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };
  if (!body.output_text) { const refusal = body.output?.flatMap((item) => item.content ?? []).find((part) => part.type === "refusal"); if (refusal) throw Object.assign(new Error("AI declined to make this suggestion"), { statusCode: 502 }); throw Object.assign(new Error("AI returned no suggestion"), { statusCode: 502 }); }
  let parsed: Partial<PuzzleSuggestion>; try { parsed = JSON.parse(body.output_text) as Partial<PuzzleSuggestion>; } catch { throw Object.assign(new Error("AI returned an invalid suggestion"), { statusCode: 502 }); }
  const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const hints = Array.isArray(parsed.hints) ? parsed.hints.map(clean).slice(0, 3) : [];
  if (!clean(parsed.emoji) || !clean(parsed.category) || hints.length !== 3 || hints.some((hint) => !hint) || !clean(parsed.explanation)) throw Object.assign(new Error("AI returned an incomplete suggestion"), { statusCode: 502 });
  const accepted = Array.from(new Set([answer, ...(Array.isArray(parsed.acceptedAnswers) ? parsed.acceptedAnswers.map(clean) : [])].filter(Boolean))).slice(0, 12);
  return { emoji: clean(parsed.emoji), category: clean(parsed.category), acceptedAnswers: accepted, hints: hints as [string, string, string], explanation: clean(parsed.explanation) };
}
