# Player Identity and Durable Play Data — Feature Plan

> Superseded by `RECOVERABLE_PLAYER_IDENTITY_FEATURE_PLAN.md`. The original browser-only token model documented here is no longer the active invariant.

## Purpose

Implement lightweight player identity and durable play-result collection now so future rankings can be designed from real data.

This historical plan did not introduce accounts, login, email, passwords, cross-device recovery, public profiles, or rankings UI. Its browser-local identity model has since been replaced by the recoverable identity plan linked above.

The current application already has device-local play state, a per-attempt `playId`, an anonymous browser/session identifier used for feedback, and Azure Table Storage. Build on those existing mechanics rather than creating a generalized analytics system.

## Product behavior

### First-run player prompt

When the browser has no valid saved player identity, require the user to choose a display name before they can interact with a puzzle.

The prompt should be lightweight and mobile-first. The puzzle may load behind it, but guessing, hints, reveal, and feedback should not be usable until player creation succeeds.

Once created, save the player identity in `localStorage` and reuse it for Daily, Practice, challenges, and author-test play unless a context is intentionally excluded by existing product rules.

Clearing browser/site storage naturally creates a new-player state and should prompt again on the next load.

Do not add an account/login/recovery flow. A display name already claimed by a previous browser remains reserved even if that browser later loses its local data.

### Display-name uniqueness is case-insensitive

This is a hard requirement.

These are the **same name** for uniqueness purposes:

- `PuzzleDad`
- `puzzledad`
- `PUZZLEDAD`
- `PuZzLeDaD`

Preserve the user's chosen capitalization for display, but reserve and look up names using a normalized value.

Recommended normalization:

1. Unicode normalize (`NFKC`).
2. Trim leading/trailing whitespace.
3. Collapse repeated internal whitespace to one space.
4. Lowercase consistently for uniqueness.

Store both values:

```ts
displayName: "PuzzleDad"
normalizedDisplayName: "puzzledad"
```

Use the same normalization function on client and server where practical, but the server is authoritative.

Keep initial naming rules deliberately small and predictable. A reasonable MVP is 3–20 visible characters and a limited set such as letters, numbers, spaces, `_`, and `-`. If the existing UI conventions suggest a better small rule, keep it simple and cover it with tests.

### Availability check

Provide a fast display-name availability endpoint suitable for a debounced client check while the user types.

The availability response is advisory only. Player creation must perform the authoritative uniqueness reservation atomically so simultaneous requests cannot claim the same case-insensitive name.

Suggested flow:

```text
GET /api/players/availability?name=PuzzleDad
POST /api/players
```

The final endpoint names may follow existing API naming conventions.

## Identity model

Do **not** use the display name as the primary identity key.

Each player should have an immutable opaque ID plus the display name:

```ts
type Player = {
  playerId: string;
  displayName: string;
  normalizedDisplayName: string;
  createdAt: string;
  lastSeenAt: string;
};
```

Generate `playerId` server-side.

Also issue an unguessable browser credential/token at player creation. Store the raw token only in the browser and store only a hash server-side. Subsequent play/feedback mutations should require the `playerId` + token so another browser cannot attribute arbitrary activity to a known player ID.

This is an invisible browser credential, **not** a login system.

A reasonable local-storage shape is:

```ts
{
  playerId: "...",
  displayName: "PuzzleDad",
  token: "..."
}
```

Use a versioned storage key so future migrations are possible.

## Azure Table Storage

### Player directory

Add a small player directory table/storage abstraction.

The data design must enforce normalized-name uniqueness under concurrency. Prefer an Azure Table transaction that creates both the player row and the normalized-name reservation row in the same partition, for example:

```text
PartitionKey: Players
RowKey: player:{playerId}

PartitionKey: Players
RowKey: name:{normalizedDisplayName}
```

Creating both rows in one transaction gives the normalized name a unique row key and makes the actual create operation authoritative even if two clients raced after an availability check.

The exact row layout may differ if a cleaner implementation fits the current storage layer, but case-insensitive uniqueness must be guaranteed by server-side storage semantics rather than a read-then-write scan.

### Durable puzzle plays

Add durable per-player/per-attempt play storage. The goal is to capture the raw facts needed for future rankings, without designing ranking formulas now.

At minimum retain:

```ts
type PuzzlePlay = {
  playerId: string;
  playId: string;
  puzzleId: string;
  puzzleNumber: number;
  pool: "daily" | "practice";
  context: "daily" | "practice" | "challenge" | "author-test";
  rankingEligible: boolean;

  startedAt: string;
  lastActionAt: string;
  completedAt: string | null;

  guessCount: number;
  hintCount: number;
  outcome: "playing" | "solved" | "revealed";

  createdAt: string;
  updatedAt: string;
};
```

It is acceptable to retain additional useful fields such as individual hint timestamps if they fall out naturally from the implementation, but do not turn this into a generic event/analytics platform.

Do not persist arbitrary wrong-guess text. Counts are sufficient for this feature.

Keep the existing product distinction that only normal Daily play is ranking-eligible. Practice/challenge/author-test data may still be collected, but must be marked ineligible according to the existing `rankingEligible`/context behavior.

## Play lifecycle

Today most ranking-relevant actions already pass through server APIs (`guess`, `hint`, `reveal`), while the actual play state is otherwise device-local. Extend this flow so the server has durable play facts even when the player never submits feedback.

### Start/resume

Create or resume the durable `PuzzlePlay` when a player begins a puzzle attempt.

A small explicit start endpoint is preferred if it produces the cleanest lifecycle, e.g.:

```text
POST /api/plays/start
```

It should use the existing client `playId` as the attempt identifier and be idempotent for repeated hydration/reload of the same attempt.

Do not create a new play ID merely because the page reloads when existing local play state is being resumed.

### Guess

A valid guess request from an identified player should update the corresponding durable play attempt.

- increment/record the guess count;
- update `lastActionAt`;
- if correct, set `outcome = solved` and `completedAt`;
- preserve the existing deterministic answer matching and response behavior.

Avoid double counting when the same client operation is retried. Use an idempotent mechanism appropriate to the current architecture (for example a client action/event ID or monotonic client-side count validated by the server). Add tests for retry behavior.

### Hint

A valid hint request should update the play attempt:

- record the resulting hint count;
- update `lastActionAt`;
- do not double count the same hint index on retry.

### Reveal

A valid reveal should update the play attempt:

- set `outcome = revealed`;
- set `completedAt` once;
- update `lastActionAt`;
- remain idempotent on retry.

### Completion

A correct guess is the solve completion. Explicit reveal is the reveal completion. There is no separate ranking calculation in this feature.

## Feedback attribution

Extend `PuzzleFeedback` so every newly submitted feedback row can be attributed to the browser player.

Add at least:

```ts
playerId: string
displayName: string
playId: string
```

Prefer `playerId` as the durable join key. A display-name snapshot is useful for admin readability and historical exports even if renaming is introduced later.

Existing feedback rows without these fields must remain readable. Treat the new identity fields as nullable/optional when reading historical data.

The existing anonymous session ID may remain temporarily for backward compatibility, but player identity becomes the primary attribution for new feedback.

Update the existing admin feedback view to show the display name alongside a feedback item. Do not create a public profile or ranking screen.

## Client integration

Create a small client-side player-identity helper rather than scattering local-storage parsing and auth headers across `DailyPuzzle.tsx`.

Responsibilities should include:

- versioned local-storage key;
- read/validate stored identity;
- create/save identity;
- attach player credentials to play-mutating API calls;
- expose the saved display name for UI use.

Do not put the raw token into URLs, share text, analytics metadata, logs, or admin responses.

Existing puzzle play storage remains device-local and should continue to work. Player identity is a separate, browser-level concept shared across puzzle attempts.

## Reset semantics

Do not automatically erase player identity when normal puzzle progress is reset.

If the application already has or gains a true "start over as a new player" action, that action may remove the local player identity so the prompt appears again. Do not release the old display-name reservation.

If there is no explicit player-reset UI today, do not add a large settings/profile surface merely for this feature.

## API/security expectations

- All player-name validation and normalization must be repeated server-side.
- Display-name uniqueness must be enforced server-side and case-insensitively.
- Raw browser tokens must never be stored server-side; store a cryptographic hash.
- Mutating play/feedback APIs must verify the player credential before attributing data.
- Never expose one player's credential to another client or through admin/list endpoints.
- Preserve existing origin protections.
- Do not weaken existing admin auth.
- Do not expose accepted puzzle answers in initial/static payloads.

## Existing product rules intentionally changed

Current repository docs describe feedback/play as anonymous and explicitly exclude names/profiles. This feature is an intentional refinement of that rule.

Update the relevant documentation (`AGENTS.md`, `GOALS.md`, `PLAN.md`, and `docs/FEEDBACK_STRATEGY.md`) so the new invariant is clear:

> No conventional player account or login is required. A verified player identity can be recovered across devices and is used to attribute play results and feedback. Public profiles remain out of scope.

Do not describe the feature as a full account/profile system.

## Explicit non-goals

Do **not** implement any of the following in this branch unless required purely as internal plumbing for the above behavior:

- leaderboard/rankings UI;
- ranking formulas or scores;
- streak UI;
- public player profiles;
- login/password/email/social auth;
- cross-device sync;
- account recovery;
- display-name rename/merge tools;
- friends/social graph;
- public comments;
- generalized telemetry/event warehouse;
- storing guess text for analytics.

The objective is **collect accurate attributable data now; design rankings later**.

## Suggested implementation sequence

1. Read `AGENTS.md`, `GOALS.md`, `PLAN.md`, `docs/FEEDBACK_STRATEGY.md`, `docs/OPERATING_GUIDE.md`, and the existing API/storage/play-state code before editing.
2. Add shared/server display-name normalization + validation tests first.
3. Add player-directory storage and atomic normalized-name reservation.
4. Add player availability/create APIs and token verification helpers.
5. Add the first-run player prompt and browser identity helper.
6. Add durable `PuzzlePlay` persistence and idempotent start/resume behavior.
7. Wire guess, hint, and reveal through verified player identity and update the durable play row.
8. Add player identity to feedback writes/reads and the admin feedback view.
9. Update repository product documentation to reflect the intentional policy change.
10. Run all repository checks and manually test on a narrow mobile viewport as well as desktop.

## Acceptance criteria

The feature is complete when all of the following are true:

- A brand-new browser cannot play until it has successfully claimed a display name.
- A successfully claimed identity persists across reloads, Daily/Practice switching, and later puzzles on that browser.
- Display-name uniqueness is case-insensitive. Claiming `PuzzleDad` prevents later claims for `puzzledad`, `PUZZLEDAD`, etc.
- Concurrent attempts to claim the same normalized name cannot both succeed.
- Preferred capitalization is preserved for display.
- A browser credential proves subsequent attribution without introducing login UI.
- Losing/clearing browser storage causes the player prompt to return; the old name remains reserved.
- A puzzle attempt has a durable play row tied to `playerId` and existing `playId` even if feedback is never submitted.
- Guess count, hint count, solved/revealed outcome, and completion timing are durably recorded.
- Retry/reload behavior does not double-count hints/reveals/guesses or create duplicate attempts.
- Daily normal play is marked ranking-eligible; Practice/challenge/author-test remains ineligible according to existing rules.
- New feedback records include player attribution and existing historical anonymous feedback remains readable.
- Admin feedback review displays the player's display name for newly attributed records.
- No ranking UI/formula, account system, cross-device recovery, or public profile has been added.
- Existing puzzle answer secrecy, deterministic matching, Daily/Practice mechanics, sharing, admin auth, and origin checks continue to work.

## Required verification

Add focused automated coverage for at least:

- display-name normalization;
- case-insensitive collisions;
- atomic duplicate-name rejection / conflict handling;
- invalid names;
- player-token verification;
- play start/resume idempotency;
- guess counting and solve completion;
- hint idempotency;
- reveal idempotency;
- Daily vs Practice ranking eligibility;
- feedback player attribution;
- reading legacy feedback without player fields.

Then run the repository-required checks from `AGENTS.md`:

```bash
npm run build
npm run lint
npm test
```

Also run the API-specific tests/build if they are not already covered by the root scripts.

Manually smoke-test:

1. new browser → name prompt;
2. name availability and case-insensitive collision;
3. create identity;
4. reload and confirm prompt does not return;
5. wrong guess → hint → correct solve;
6. reload completed puzzle;
7. reveal path;
8. Daily feedback with comment;
9. Practice feedback without comment;
10. inspect admin feedback attribution;
11. clear local/site data and verify the prompt returns while the previous name remains unavailable.

## Codex completion instructions

Implement the feature on this branch as the smallest coherent change that satisfies the acceptance criteria. Follow existing repository patterns and avoid speculative abstractions.

Before finishing:

- inspect the full diff for accidental answer/token exposure;
- run all required checks;
- update the docs listed above;
- commit all implementation changes to this branch;
- report the final commit SHA, test results, any deployment/storage migration steps, and any deliberate deviations from this plan.
