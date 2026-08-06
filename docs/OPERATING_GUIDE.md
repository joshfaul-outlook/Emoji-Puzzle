# Operating Guide

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the address printed by the development server. The local database binding is created automatically when feedback is first submitted.

## Verification

Run the complete repository check before publishing:

```bash
npm run build
npm run lint
npm test
```

The automated tests cover the ten-puzzle content contract, structure variety, deterministic normalization, accepted and rejected guesses, shared UTC rotation, server-side answer isolation, and the presence of the complete interaction loop.

## Testing individual puzzles

Append `?puzzle=N` to the URL, where `N` is 1 through 10. This is a playtest aid and does not change the shared daily rotation.

For each puzzle, check:

1. An intended answer and at least two reasonable variants.
2. A clearly wrong answer.
3. All three hints in order.
4. Reveal confirmation and result explanation.
5. Solve statistics and spoiler-free sharing through messages, email, copy-link, and the native share menu.
6. Positive and negative feedback with and without a comment.
7. Refresh behavior after solve/reveal.

Play state is stored per puzzle in the browser. Normal daily results show the time remaining until the next 00:00 UTC launch. Visit `/next` to enter persistent sequence mode, where each completed puzzle can immediately advance through the authored set. Visit `/startover` to clear device-local state and return to today’s puzzle.

## Editing content and rules

`lib/puzzles.ts` is the single editing surface.

- `PUZZLES` contains emoji, intended answer, accepted variants, category, hints, explanation, and structure.
- `GAME_CONFIG.launchDate` controls the UTC date of puzzle one.
- `GAME_CONFIG.cycleAfterLastPuzzle` controls whether the set loops.
- Guess and comment length limits are configurable there.

The normalization function deterministically handles case, Unicode compatibility and diacritics, apostrophes, punctuation, ampersands, whitespace, and separator differences. Missing spaces and hyphens are treated as formatting differences, so `van gogh`, `van-gogh`, and `vangogh` compare equally.

Cultural spellings and other fair phrasings must remain explicit entries in `acceptedAnswers`. Misspellings, typos, and semantic alternatives are not automatically accepted; add a repeatedly missed fair answer as an authored variant rather than loosening the matcher globally.

## Feedback storage

The D1 `puzzle_feedback` table stores raw feedback. Its migration is in `drizzle/` and its write path is `app/api/feedback/route.ts`.

Each row contains:

- puzzle id and number;
- up/down rating and optional comment;
- server timestamp;
- per-play and anonymous device-session identifiers;
- solved/revealed outcome;
- guesses and hints;
- compact context: UTC play date, locale, timezone, viewport, pixel ratio, and reduced-motion preference.

Do not add direct identifiers or reuse the anonymous session id outside this product.

## Reviewing feedback

The deployed `/internal/feedback-report` page is a read-only operational view for the owner. It requires ChatGPT sign-in and an exact server-side match to the owner email in `lib/feedback-review-auth.ts`; other ChatGPT accounts receive a not-found response. The page shows aggregate and per-puzzle signals plus the latest negative or written feedback; it never displays play ids, anonymous session ids, or device metadata.

For local development data, stop the development server and run:

```bash
npm run feedback:report
npm run feedback:report -- --days 7
npm run feedback:report -- --days 30 --puzzle 2
```

Both views use the same read-only queries and label results as being among feedback submissions. They cannot measure total plays or abandonment.

Review after every five new submissions or every three days. Read every negative rating and written comment, apply one research tag from `FEEDBACK_STRATEGY.md`, choose keep/revise/replace/retest for each reviewed puzzle, and save a dated note using `docs/feedback-reviews/TEMPLATE.md`.

## Release process

1. Confirm the working tree contains only intended changes.
2. Run the complete verification commands.
3. Commit the exact validated source.
4. Push the intended branch to GitHub.
5. Publish that exact source through the configured Sites project.
6. Confirm deployment success and public access.
7. Open the live game once and check the current puzzle, share preview, and feedback submission.

The hosting project identifier and logical D1 binding live in `.openai/hosting.json`. Credentials and runtime values must never be committed.

## Incident rules

- If answer checking fails, preserve the raw guess only during local debugging; do not begin storing guesses in production without a privacy decision.
- If feedback storage fails, keep gameplay available and show a retryable feedback error.
- If the daily date is wrong, verify UTC rotation before changing the launch date.
- If a puzzle is unfair, prefer replacing or revising its authored content over loosening every answer match.
- If public access or deployment fails, do not create a second hosting project; repair or redeploy the configured one.
