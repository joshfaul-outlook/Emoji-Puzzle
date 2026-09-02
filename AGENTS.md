# Emojizzle Agent Guide

## Mission

Build and learn from the smallest delightful version of Emoji Daily: one shared emoji puzzle, once per day, for everyone.

The core product question is whether we can repeatedly create puzzles that feel surprising before the answer and inevitable afterward. Favor changes that help us answer that question quickly.

## Product invariants

- One globally shared puzzle per UTC day.
- Every new browser-tab session opens in Daily mode; Practice is an explicit session choice.
- Daily uses the reviewed 20-puzzle rotation; Practice uses a separate append-only, player-unnumbered sequence of easier/pop-culture puzzles and never affects rankings.
- No password or conventional account is required. Email verification creates and recovers one persistent named player identity; each browser receives an independent opaque session.
- The category is hidden until a hint or the result.
- Guesses are free-form, deterministic, and unlimited.
- Hints are authored and revealed one at a time.
- Revealing the answer is explicit and ends the play.
- The result celebrates the explanation, not a numeric score.
- Sharing never exposes the answer or emoji sequence.
- Daily feedback is thumbs up/down with an optional note; Practice feedback is rating-only.
- Daily play is server-resumable across a player's devices. Practice progression remains device-local. Public profiles do not exist.

Do not add passwords, conventional account management, monetization, feeds, leaderboards, localization, fuzzy/AI answer judging, or infrastructure beyond the documented Azure production stack unless a validated need is documented first.

## Working principles

1. Preserve the daily ritual. The first viewport should remain the puzzle, not navigation or explanation.
2. Change one meaningful mechanic at a time when possible so playtest results remain interpretable.
3. Keep content separate from mechanics. Production puzzle edits belong in the admin portal; `lib/puzzles.ts` is the idempotent seed fixture. Rule changes belong in the API game configuration.
4. Prefer explicit data and small functions over abstractions built for hypothetical future needs.
5. Keep answers server-side. Never place accepted answers or explanations in the initial page payload.
6. Collect only useful context. Retain the chosen player display name and a keyed recovery-email hash; do not persist raw recovery email, browser fingerprints, or precise IP-derived location.
7. Design mobile-first and preserve keyboard, screen-reader, reduced-motion, and touch usability.
8. Treat feedback comments as user research, not public content.

## Puzzle authoring standard

Every puzzle must have:

- one intended answer that feels fair after reveal;
- explicit accepted variants after deterministic normalization;
- three progressive hints, moving from category to interpretation to near-answer;
- a short explanation that delivers the “aha”;
- varied clue styles across the set.

Before shipping a puzzle, ask:

- Can a reasonable player distinguish the intended answer from close alternatives?
- Does each emoji earn its place?
- Does the final hint rescue the puzzle without simply printing the answer?
- Is the reference broadly recognizable by the intended audience?
- Does the explanation make the clue mapping feel satisfying?

Never silently add fuzzy matching. Add a missed fair answer as an authored variant and record why.

## Repository map

- `app/` — statically exported game and admin screens
- `api/` — Azure Functions, Table Storage access for puzzles, players, plays, and feedback, seed/import tools, and API tests
- `lib/puzzles.ts` — Daily and Practice seed inventory
- `infra/` — subscription-level Bicep for the production Azure stack
- `tests/` — product-invariant and mechanics tests
- `GOALS.md` — product goals and non-goals
- `PLAN.md` — staged MVP plan and decision gates
- `docs/OPERATING_GUIDE.md` — run, test, release, and data operations
- `docs/FEEDBACK_STRATEGY.md` — learning loop and analysis method

## Change procedure

1. Read `GOALS.md` and the relevant section of `PLAN.md`.
2. State the behavior or learning question being changed.
3. Inspect existing data and mechanics before editing.
4. Make the smallest coherent change.
5. Add or update a focused test for any rule change.
6. Run:

   ```bash
   npm run build
   npm run lint
   npm test
   ```

7. For puzzle changes, manually check the intended answer, at least two fair variants, all hints, reveal, share text, and feedback submission.
8. Update product documentation when an experiment changes a rule or decision.

## Definition of done

A change is done when it is understandable on a phone, preserves spoiler and credential safety, passes the repository checks, and leaves the next editor with accurate puzzle data and documentation.
