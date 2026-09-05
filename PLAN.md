# Emojizzle Product and Operations Plan

## Current baseline

Emoji Daily ships as a mobile-first static web app with a same-origin Azure API. It has one shared UTC Daily puzzle, a separate 330-puzzle Practice sequence, deterministic answer matching, three authored hints, explicit reveal, spoiler-free sharing, server-resumable Daily play, and a passwordless recoverable named identity with independent device sessions.

Azure Table Storage is the production source of truth for puzzles, player-name reservations, durable play facts, and feedback. The private `/admin/` portal supports searching, drafting, editing, publishing, archiving, restoring, drag-and-drop pool ordering, emoji keyword search, AI phrase suggestions, and attributed feedback review. The original 350 records remain an idempotent migration fixture.

## Product learning

1. Use player feedback to identify answer variants, ambiguous emoji choices, and weak explanations.
2. Revise one meaningful mechanic at a time so results remain interpretable.
3. Keep a reviewed Daily buffer while using Practice for broader inventory.
4. Add analytics only when attributed result feedback and durable play facts cannot answer a documented product question.

## Release gates

- All frontend/API tests, lint, TypeScript builds, and static export pass.
- Static output contains no accepted answers, unrevealed hints, credentials, or storage configuration.
- Production tables are seeded and Daily/Practice positions reconcile with the fixture.
- Gameplay, feedback, login, CRUD, archive/restore, ETag conflict, and emoji-helper flows work on touch and keyboard.
- Layouts work without horizontal overflow from 320px through desktop, in portrait and landscape.
- The generated Azure hostname passes HTTPS smoke tests before any custom-domain change.

## Player stats and rankings

Implemented [Player Rankings and Private Stats](docs/PLAYER_RANKINGS_FEATURE_PLAN.md): private Daily/Practice summaries, current/best Daily streaks, public Daily rankings, and a default-on public preference with opt-out. Deployment initializes an immutable, nonrepeating Daily schedule and rankings epoch; legacy/test results are excluded. The public board uses a persisted snapshot refreshed on demand at most every five minutes, matching the managed Azure HTTP-only API.

The first Daily request after deployment stores the rankings launch date and freezes that day's assignment. Later deployments reuse the persisted epoch. No separate launch-date setting or production data reset is required.

## Deferred work


Passwords, conventional account management, public profiles, alternate ranking formulas, roles, audit logs, bulk operations, hard deletion, fuzzy judging, monetization, additional competitive features, localization, and full cross-device Practice synchronization remain out of scope until usage establishes a need.
