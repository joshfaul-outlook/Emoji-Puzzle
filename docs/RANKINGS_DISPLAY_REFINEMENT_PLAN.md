# Rankings Display and Fresh-Start Plan

The accepted interactive UI reference is [Rankings UI preview](mockups/rankings-ui-preview.html).

## Status and product decision

This plan refines how progress and Daily rankings appear without changing the ranking formula. Public rank remains based on eligible Daily solves during the current 30-UTC-day window, then unaided solves, with shared ranks. Practice remains private and never affects Daily rank or streaks.

The release includes a one-time clean start. It clears every recorded attempt and completion, removes test feedback and generated ranking data, resets the Daily schedule to the first published Daily puzzle, and invalidates browser-side game progress. The plan assumes verified player identities, active sessions, display-name reservations, recovery links, and public-stats preferences remain intact so existing testers do not need to register again.

## Experience principles

- Keep the puzzle as the visual focus. Progress should fit in one compact row and never turn the first viewport into a dashboard.
- Show only facts that give the player a useful next reason to play: protect a streak, enter or improve a rank, or continue Practice.
- Keep Daily, public rankings, and Practice in distinct views. No Practice number appears beside a Daily number, and no Practice activity appears on the public board.
- Use light celebratory language and restrained symbols. Every symbol has visible or screen-reader text, and progress remains understandable without color.
- Ranking privacy applies everywhere. An opted-out player can see their private Daily streak and totals, but no rank or inferred public placement.

## At-a-glance progress on play views

Add a slim progress strip directly below the Daily/Practice mode switch. The strip is a button that opens the matching detailed Stats view. It uses at most two short metrics and collapses cleanly at 320px.

### Daily

Show:

- current Daily streak, such as `🔥 4-day streak`;
- current public placement, such as `🏅 #12 this month`.

State-specific copy:

| State | Streak item | Placement item |
| --- | --- | --- |
| Eligible Daily still open | `4-day streak` | `#12 this month` |
| Daily solved | refreshed streak | refreshed rank when available |
| Daily revealed | `Start again tomorrow` | current rank, unchanged by the reveal |
| No ranked solve yet | `Start your streak` | `Solve to join` |
| Public stats disabled | current private streak | `Rankings private` |
| Rankings temporarily unavailable | current private streak | `Rank updating` |

The strip refreshes after an accepted solve or reveal and when Stats closes. It does not animate continuously or show a live leaderboard. Ranking snapshots may remain up to five minutes old; the detailed view owns the update timestamp.

### Practice

Show private Practice progress only, such as `🎯 18 solved` and `72% solve rate`. Do not show Daily rank, Daily streak, the Daily 30-day window, or a numbered Practice position. After a Practice result, refresh these values before the next puzzle opens.

Shared Practice challenges retain their existing friend comparison on the result card. Challenge activity does not appear in the progress strip or detailed Stats because it does not represent the player's Practice progression.

### Author tests and shared challenges

Do not show the progress strip for author-test or shared-challenge contexts. Those contexts are deliberately outside both the Daily ranking loop and the player's ordinary Practice sequence.

## Detailed Stats and rankings

Replace the current two-tab modal with three peer views:

1. **Daily** — the player's Daily history only.
2. **Rankings** — the public 30-day Daily leaderboard only.
3. **Practice** — the player's private Practice history only.

Open the Daily or Practice view to match the mode from which the player opened Stats. Remember the selected view only while the modal is open. Keep focus trapping, Escape/close behavior, and return focus to the same play control.

### Daily view

- Prominent current and best streak cards.
- Current public rank card when participating, or a concise private/unranked state.
- History selector for all recorded history or the last 30 days.
- Daily-only totals: started, solved, revealed, unfinished, solve rate, unaided solves, average guesses, average hints, and distinct puzzles solved.
- Any late or otherwise unranked Daily completions remain explicitly labeled.
- Public-ranking visibility preference lives here because it controls the player's Daily data.

### Rankings view

- A pinned personal placement card above the board. If the player is outside the loaded rows, show their rank without implying that nearby players are loaded.
- The overall Daily table with rank, player, 30-day solves, unaided solves, and current streak.
- The existing shared-rank and pagination behavior.
- Concise rule and date-range copy, with the last refresh timestamp.
- Empty, loading, refresh, stale, private, and unavailable states that do not invent a zero rank.

The first release should keep a single table instead of adding podiums, leagues, rank history, movement arrows, or “players to beat.” Those features require either more visual weight or historical snapshots that are not currently stored.

### Practice view

- History selector for all recorded history or the last 30 days.
- Ordinary Practice totals using the same private metrics as today.
- Clear copy that Practice activity is private, affects neither Daily rank nor Daily streak, and that the browser's Practice position remains device-local.

No challenge activity, Daily metrics, rank, ranking preference, or leaderboard rows appear in this view.

## Data and API work

### Browser persistence and reload behavior

Treat the API as the source of truth for both puzzle content and play state. The app already requests the current puzzle from `/api/puzzles/current` whenever a play view opens. Keep that behavior, then call the authenticated play-start endpoint to create or resume the attempt and hydrate guesses, revealed hints, outcome, and resolution from the server.

Do not persist puzzle content, answers, explanations, revealed hints, guess counts, outcomes, feedback state, or completed result screens in browser storage. Hold those values in memory for the current page and reconstruct them from the server after a reload.

Retain only:

- the cached player identity, session credential, and known-player display name;
- the device-local Practice cursor and cycle;
- an opaque active-attempt ID for Practice and shared challenges so a refresh resumes the same attempt rather than recording a new one;
- the session-only active-mode preference if the current navigation behavior still needs it;
- a client game-data epoch used to invalidate obsolete resume keys.

Daily does not need a locally persisted attempt ID because the API already derives one canonical attempt from the player and assigned puzzle. The Daily start request should allow the server to select that canonical ID and return the complete resumable state.

Fetch once when entering or refreshing a play view and again when moving to another puzzle. Gameplay actions continue returning their new authoritative state; do not re-fetch the whole puzzle after every guess or render. If the network is unavailable, show the existing retry state instead of falling back to stale puzzle or completion data.

Add a small authenticated play-view summary response rather than loading the full Stats payload merely to render the strip. It should return only:

- Daily: current streak, current public rank when visible, ranking status, and snapshot timestamp;
- Practice: solved count and solve rate for ordinary Practice attempts;
- the current public-stats preference needed to choose the private state.

The server remains the source of truth. Reuse the existing eligibility, summary, streak, visibility, and snapshot functions so the compact and detailed displays cannot disagree. Do not expose player IDs, Practice facts, recovery data, or hidden puzzle content through the public rankings endpoint.

Refresh the compact response on first render, after the current result is saved, and after a preference change. Avoid polling. A failure hides the unavailable metric or shows the neutral `Rank updating` state without blocking play.

## One-time fresh start

Create a purpose-built `reset:game-history` operator command. Do not reuse the current `reset:player-data` command because that command also deletes `PlayerDirectory` and would invalidate every player's identity and reserved display name.

The new command must default to a dry run, print table/partition row counts, require an explicit production confirmation token to apply, and operate only on these records:

- all play and action rows in `PuzzlePlays`;
- all test-era rows in `PuzzleFeedback`;
- `DailySchedule` initialization, date assignments, and puzzle reservations in `PuzzleCatalog`;
- `Rankings` metadata/lease rows and every `RankingSnapshot:*` partition in `PuzzleCatalog`;

Preserve:

- all `Puzzle` catalog records, published/archive state, pool order, and catalog metadata;
- `PlayerDirectory`, including identities, sessions, email/name indexes, public-stats preferences, and display-name reservations;
- `PlayerVerifications`; verification lifecycle is unrelated to game history;
- infrastructure and secrets.

Add a browser game-data epoch and bump it for this release. On the first post-release visit, remove or ignore old Daily, Practice, challenge, and author-test play-state caches plus the device-local Practice position and opaque attempt IDs, while retaining the player identity and known-player record. Start Practice from its first unnumbered puzzle. This client reset must be idempotent and must not use `localStorage.clear()`.

Deleting the `DailySchedule` partition makes the first request after the reset persist the cutover UTC date as the new rankings epoch and assign the first currently published Daily puzzle. Reset-generated ranking snapshots must be removed so the old board cannot reappear while the new snapshot builds.

### Cutover runbook

1. Choose and record the UTC cutover date. Avoid starting shortly before UTC midnight.
2. Export or snapshot the affected test tables for rollback and research retention, then record pre-reset row counts.
3. Deploy the display changes, scoped reset command, and new client game-data epoch.
4. Run the reset command in dry-run mode and compare its targets with the recorded counts.
5. Apply the reset once with the production confirmation token.
6. Request the Daily endpoint once to initialize the new epoch and first assignment.
7. Verify that the first Daily puzzle is the first published item in Daily order, Practice opens at its first item, all personal totals and streaks are zero, and the public board is empty.
8. Complete one controlled Daily solve and one Practice solve. Verify that only the Daily solve affects rank/streak and that the two detailed views remain separate.
9. Record post-reset counts and retain the rollback export until the reset is accepted.

The deploy workflow currently requests the Daily endpoint during its production smoke test. The reset therefore runs after deployment and smoke testing, followed immediately by the explicit initialization request in step 6.

## Validation and acceptance

- At 320px through desktop, the compact strip remains one unobtrusive row and the puzzle stays the primary content.
- Daily, Rankings, and Practice views contain only their specified data in normal, empty, private, loading, and error states.
- Completing Practice cannot change any compact Daily value, leaderboard row, Daily total, or streak.
- Completing or revealing Daily cannot change ordinary Practice totals.
- Opting out removes placement from the compact strip and public board while retaining private Daily stats and streaks.
- A Daily solve refreshes the compact streak; the public rank uses the latest valid snapshot and never fabricates movement.
- Keyboard and screen-reader users can identify each metric, switch views, close Stats, and return to the originating control.
- Unit tests cover contextual response shaping, privacy, context isolation, reset target selection, client epoch migration, and empty-state copy.
- Reload tests prove that Daily resumes from server state without a browser play cache and that Practice resumes through only its local cursor and opaque attempt ID.
- Storage integration tests prove that the reset preserves the puzzle catalog and player identities while removing plays, feedback, schedules, and snapshots.
- The full build, lint, frontend test, API build, and API test suites pass before cutover.

## Out of scope

This refinement does not change ranking order, introduce Practice rankings, add public profiles, score guesses, make streaks a tiebreaker, retain rank-history deltas, or add new infrastructure.
