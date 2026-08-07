# Emoji Daily

> One puzzle. Every day. Everyone.

[Play the live game](https://emoji-daily-playtest.josh-faul.chatgpt.site)

Emoji Daily is a deliberately small consumer web game. Everyone receives the same emoji puzzle each UTC day and tries to decode what it means. The answer might be a phrase, person, story, movie, event, or concept—the category itself is part of the mystery.

The product is built around one question: can we repeatedly create puzzles that feel surprising before the answer and inevitable afterward?

## What the base MVP includes

- One globally shared daily puzzle
- A 20-puzzle shared Daily rotation plus an 80-puzzle Practice sequence
- No in-game account requirement
- Free-form guesses with deterministic accepted variants
- Progressive authored hints, one at a time
- Explicit reveal/give-up flow
- Explanation-led solve and reveal states
- Guesses and hints without a numeric score or timer
- Spoiler-free sharing through messages, email, copy-link, and the native share menu
- Temporary `/next` and `/startover` routes for rapid mechanics testing
- Session-explicit Practice mode with device-local resume, fresh replay cycles, and spoiler-free challenges
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

Open the local address printed by the development server. Use `?puzzle=1` through `?puzzle=20` to test a specific Daily puzzle; this author-test context is never ranking-eligible. Use `/next` only for unlinked rapid Daily-pool testing. Players enter `/practice` through the Daily / Practice switch, and `/startover` clears device-local progress and session mode before returning to Daily.

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

All puzzle content and configurable game rules live in `lib/puzzles.ts`. Daily uses puzzles 1–20; Practice uses the former puzzles 21–100 as positions 1–80 and accepts appended entries. Answers are checked server-side and are returned only after a correct guess or explicit reveal.

The feedback schema lives in `db/schema.ts`, with a generated migration in `drizzle/`. The MVP stores raw records for separate collation and analysis; it intentionally does not include an account system, analytics dashboard, admin UI, monetization, or production-scale infrastructure.

## Status

This repository is the branded starting point for mechanics and puzzle-quality iteration. The 100-puzzle pool is experimental authored inventory, not a claim that every puzzle has been blind-tested or approved for the daily rotation. Review, revise, approve, and schedule puzzles in small batches.
