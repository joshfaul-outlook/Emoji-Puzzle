# Emoji Daily

> One puzzle. Every day. Everyone.

[Play the live game](https://emoji-daily-playtest.josh-faul.chatgpt.site)

Emoji Daily is a deliberately small consumer web game. Everyone receives the same emoji puzzle each UTC day and tries to decode what it means. The answer might be a phrase, person, story, movie, event, or concept—the category itself is part of the mystery.

The product is built around one question: can we repeatedly create puzzles that feel surprising before the answer and inevitable afterward?

## What the base MVP includes

- One globally shared daily puzzle
- Ten varied, editable playtest puzzles
- No in-game account requirement
- Free-form guesses with deterministic accepted variants
- Progressive authored hints, one at a time
- Explicit reveal/give-up flow
- Explanation-led solve and reveal states
- Elapsed time, guesses, and hints without a numeric score
- Spoiler-free native sharing or clipboard fallback
- Thumbs up/down feedback with an optional note
- Durable anonymous raw feedback for later analysis
- Device-local play continuity
- Mobile-first, accessible branded interface

## Start locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by the development server. Use `?puzzle=1` through `?puzzle=10` to test a specific seeded puzzle.

## Verify

```bash
npm run build
npm run lint
npm test
```

## Product and operating docs

- [Product goals](GOALS.md)
- [Refined MVP plan](PLAN.md)
- [Agent guidelines](AGENTS.md)
- [Operating guide](docs/OPERATING_GUIDE.md)
- [Engagement and feedback strategy](docs/FEEDBACK_STRATEGY.md)

## Where to edit

All puzzle content and configurable game rules live in `lib/puzzles.ts`. Answers are checked server-side and are returned only after a correct guess or explicit reveal.

The feedback schema lives in `db/schema.ts`, with a generated migration in `drizzle/`. The MVP stores raw records for separate collation and analysis; it intentionally does not include an account system, analytics dashboard, admin UI, monetization, or production-scale infrastructure.

## Status

This repository is the branded starting point for mechanics and puzzle-quality iteration. The first ten puzzles are experimental probes, not a permanent content library.
