# Player Rankings and Private Stats — Implementation Plan

Status: approved and implemented locally, September 5, 2026. Rankings and the nonrepeating Daily schedule activate automatically on deployment. No separate launch-date configuration is used.

The later [Rankings Display and Fresh-Start Plan](RANKINGS_DISPLAY_REFINEMENT_PLAN.md) supersedes this document's original two-tab layout and removes challenge activity from detailed Stats.

## Confirmed scope

- Public player rankings use Daily puzzles only.
- Daily puzzles will not repeat after launch. Repeated Daily puzzles and replay attempts never earn ranking credit, including tie-breaker credit.
- Practice puzzle stats are visible privately to the player.
- Public Daily stats and rankings participation default to yes. Players can turn this preference off; Practice stats remain private regardless of the setting.
- Include streaks in the player rankings and stats feature. Daily solve streaks follow the rules below.
- Public profiles, social feeds, and Practice rankings are outside this feature.

The user approved this plan, including the 30-day formula, UTC streak rules, and default-on public visibility. The implementation preserves canonical player + puzzle attempts and introduces server-owned assignment dates.

## Player experience

Add a small **Stats & rankings** entry alongside the existing player controls. Keep the puzzle as the first viewport and the explanation as the focus of the result. Returning from stats preserves the current puzzle and mode.

The view has **My stats** and **Daily rankings** tabs. My stats separates Daily and Practice with explicit labels. Practice says: “Only you can see these stats. Practice never affects your rank.”

Daily rankings shows a rolling 30-day board, the UTC date range, when it was updated, and a short explanation of the ordering. Show rank, display name, Daily solves, unaided solves, and current Daily streak. Label the solve totals as last 30 days and the streak as consecutive Daily solves; a streak can exceed 30 days. Paginate the board and show the signed-in player's own position even when outside the first page. Do not make names links to profiles or expose individual play histories.

Provide an explicit “Show my Daily stats publicly” preference, enabled by default for new players and existing players without a saved preference. Explain that it shows their player name, eligible Daily totals, and current Daily streak in rankings. Preserve any explicitly saved opt-out. Players can keep private stats whether or not they participate publicly. Turning it off removes the player from subsequent board responses; enabling it includes eligible results within the current window. Rank only participating players. Practice stats remain private in both states. Avoid a separate onboarding interruption.

## Ranking rules

1. The window is today and the previous 29 UTC dates, bounded by the rankings launch date. Today's results are live, with a displayed update time.
2. Order by eligible Daily solves, descending; break ties by eligible solves with zero hints, descending. A solve with hints still counts as a solve.
3. Equal totals share a rank, using competition ranking: 1, 2, 2, 4. A stable internal key may order tied rows for pagination but must not change their displayed ranks.
4. Include players with at least one eligible solve in the window. Others see “Solve a Daily puzzle to join the rankings.” No minimum participation period.
5. Reveals and unfinished attempts earn no solve. Missed days earn no solve. Guesses remain unlimited and do not affect rank. Do not use elapsed time: recorded timestamps include interruptions and cross-device pauses.
6. Practice, shared Practice challenges, author tests, previews, and late Daily completions contribute nothing to public rank or its tie-breaker.
7. Only a puzzle's original eligible Daily assignment can count. Each player can receive credit at most once per puzzle, across all dates, devices, and ranking windows. Replaying a solved or revealed puzzle cannot improve its result or earn fresh credit. If a puzzle is accidentally scheduled again, the repeated assignment is ineligible for everyone, including players who missed the original. Changing a date or editing the same puzzle does not make it new.

Example: 18 solves / 10 unaided ranks above 18 / 8, which ranks above 17 / 17. Two players with 18 / 10 share their rank.

This favors returning to the daily ritual without adding a points formula. Alternative formulas are deferred.

## Private statistics

Default to all recorded history, with an optional last-30-days filter. Return a coverage start date; do not imply that history predates durable server records.

| Metric | Daily | Practice |
| --- | --- | --- |
| Attempts started, solved, revealed, unfinished | Yes | Yes |
| Solve rate: solved / (solved + revealed) | Yes | Yes |
| Solves without hints | Yes | Yes |
| Average guesses and hints on solved attempts | Yes | Yes |
| Current and best on-time Daily solve streak | Yes | No |
| Distinct puzzles solved and total attempts | Yes | Yes, so replays are clear |
| Current public rank | If participating | Never |

Use an em dash for rates and averages with no denominator. Explain that solve rate covers completed attempts; unfinished attempts remain separately visible. Opening a puzzle currently starts an attempt, so “started” must not imply that the player submitted a guess.

Private Daily totals may include late finishes and any separately recorded repeat attempts, labeled as unranked. Resuming an existing canonical attempt is not another attempt or solve. Streaks use the rules below.

Practice totals use `pool=practice` and `context=practice`. Shared challenges and author tests are excluded from player statistics. Each distinct Practice play ID counts as an attempt, including repeats across cycles or devices; also show distinct puzzle counts.

Stats aggregate server-recorded plays across the player's devices. Practice position and its active browser attempt remain device-local. Recovery restores recorded statistics without promising to resume the same Practice position on another device.

## Daily streaks

- **Current streak:** consecutive eligible Daily puzzles solved on their assigned UTC dates. Solves with hints count; revealing the answer does not. Count at most one solve per date across every device.
- **Best streak:** the longest such run in the player's reliable recorded Daily history. Ending the current streak never erases the best streak.
- Show both prominently in My stats and a small current-streak update after a Daily result, following the explanation. Show the current streak on public ranking rows for participating players. Use text such as “7-day Daily streak” so the meaning does not depend on an icon.
- Yesterday's streak remains current while today's puzzle is pending. Solving today extends it; revealing today ends it immediately. If today is missed or left unfinished, the streak ends when the next UTC date begins. A late solve cannot repair a broken streak. A player with no qualifying solve has current and best streaks of zero.
- A void Daily date neither extends nor breaks a streak; skip it when evaluating consecutive valid Daily dates. For example, three solves followed by a void date and another solve yield a streak of four.
- Replays never extend or repair a Daily streak. If an accidental repeat is issued as the shared Daily puzzle, treat that repeated assignment as a void date for everyone; retain the original assignment's result and streak contribution.
- Streaks use all reliable eligible history from rankings launch, independent of the board's rolling 30-day window or the selected stats filter. Retain sufficient historical facts or a rebuildable streak projection; a 30-day query alone cannot calculate a longer streak. Historical rows without reliable Daily dates do not establish streaks.
- Public participation controls visibility only. Opting out, changing devices, and recovering the same player do not reset a streak. Practice, challenges, author tests, and previews never extend or repair a Daily streak.
- V1 ordering remains solves followed by unaided solves; the streak is a visible achievement, with no extra points or tie-breaker in v1.

Acceptance examples: six consecutive solves through yesterday display a current streak of six while today is pending; a solve with hints today makes seven; a reveal today makes current zero while retaining best six. Replaying an old solve does not increment either streak. Verify runs longer than 30 days, month/year boundaries, void and repeated dates, midnight expiry without a new play action, late finishes, opt-out, and concurrent device retries.

## Repository findings and launch prerequisites

- `api/src/storage.ts` already stores player, puzzle, pool, context, ranking eligibility, guess/hint counts, outcome, and timestamps in `PuzzlePlays`. Action records share the table; aggregates must select only `play:` rows. Result feedback is optional and must never be the stats source.
- `canonicalDailyPlayId` hashes only `puzzleId`, within the player's storage partition. The implementation keeps that player + puzzle identity to prevent fresh ranked attempts on replay. Daily selection now uses persisted, nonrepeating assignments instead of the legacy modulo rotation, and each ranked play retains its original assigned Daily date for windows, deadlines, and streaks.
- `playsStart` checks current-Daily eligibility when creating an attempt, but `applyPlayAction` does not enforce a UTC ranking deadline. Existing `rankingEligible=true` alone is insufficient evidence for an on-time result.
- `currentPuzzle` supports public `mode=next` and numbered Daily requests as author tests. Players can start non-ranked attempts and request hints/reveals. Merely excluding those attempts from the board does not prevent learning the answer before ranked play.
- Published pool ordering and puzzle content can change through admin operations. Rankings need a stable shared assignment and content for a given date.

Implementation requirements:

1. Persist a server-owned Daily assignment containing `dailyDate` (`YYYY-MM-DD` UTC), puzzle ID, and a fixed puzzle revision or snapshot. Resolve every request for that date through the same assignment. Freeze an issued assignment; if a material error requires invalidation, use the admin void endpoint to exclude that date for everyone and do not penalize streaks for the void date.
2. Preserve canonical Daily attempts keyed by player + puzzle, as specified in the recoverable identity plan. Bind new attempts to the original server-assigned Daily date and puzzle revision. Every device resumes the same attempt. Reject non-current Daily starts before they can reserve a canonical attempt, and never reset an existing result or rewrite its date/eligibility on replay. Enforce at most one assigned ranked puzzle per UTC date.
3. Use a nonrepeating Daily schedule after activation. Treat predeployment Daily attempts as private, unranked development history, then schedule the existing Daily catalog once from the deployment epoch. Atomically reserve each puzzle for only one post-activation Daily assignment, including concurrent scheduler runs, and retain scheduling history beyond the 30-day board window. If inventory runs out, report Daily unavailable and alert the operator instead of wrapping to assigned content; treat the unavailable date as void for streaks. Defensively exclude repeated assignments in aggregation even if invalid schedule data slips through.
4. Authorize Daily preview and author-test puzzle/start/action endpoints with the existing admin check. Prevent alternate client-supplied contexts from creating an unranked Daily reveal path. Keep Practice challenges available. Authorized preview attempts remain ineligible, and exposed puzzle revisions are excluded from that player's ranked results. This is basic casual-game integrity, not a guarantee against outside help or multiple identities.
5. Define the ranked interval as `[dailyDate 00:00 UTC, next date 00:00 UTC)`, using the server timestamp at the accepted completion mutation. Late completion may remain playable and appear privately, but receives no ranked solve. Store the ranked outcome separately from the eligibility-at-start flag, with an exclusion reason when relevant.
6. The first Daily request after deployment persists the rankings epoch. Retain existing plays for private historical totals; do not reset player data or guess missing date/revision eligibility for public backfill. Preserve legacy canonical attempts without upgrading their eligibility or assigning them a fresh ranked date.

If these prerequisites are not ready, release private stats first and keep the public board disabled.

## Implementation approach

Stay within the existing static Next.js frontend, Azure Functions API, and Azure Table Storage stack.

- Add pure aggregation and ranking functions with explicit UTC clock/window inputs. Define inclusion predicates once and reuse them in the API and tests.
- Add an authenticated `GET /api/players/me/stats`. Derive the player ID from the validated session, never from a caller-selected target. Query that player's partition and return separate Daily, Practice, and challenge summaries, current/best Daily streaks, coverage information, and their current rank if participating. Responses are private and must not enter shared caches.
- Add a public `GET /api/rankings?window=30d&cursor=...` returning only display names and approved aggregate fields, plus window and refresh metadata. Keep private player IDs, session/recovery data, guesses, answers, hints, feedback, and Practice facts out of the public response. Use opaque pagination cursors bound to the snapshot.
- Add an authenticated preference update endpoint for public participation. Store the preference on the durable player record so it survives recovery and is shared across devices. Default a missing preference to true and preserve explicit false values during migration and recovery. Apply current visibility before returning public rows, ranks, or pagination; invalidate cached results when preferences change so opt-out does not leave a stale public entry.
- Start private stats with a partition query over durable play rows. For the public board, build a bounded, persisted snapshot on demand, at most every five minutes under a persisted storage lease. Managed Azure Static Web Apps supports HTTP triggers only, so the approved timer-based draft was adapted without adding hosting infrastructure ([Azure documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)). Rebuild from canonical eligible facts and select the latest complete snapshot; never scan all players for every page request. Measure scan cost before launch and add a date index if needed.
- Aggregates are rebuildable projections. Never depend on a non-atomic “increment score” side effect after saving a solve. Retries, refreshes, recovery, and concurrent completions must not double-count. A snapshot failure keeps the last complete board with its timestamp; it must not prevent gameplay or display invented zeroes.
- Keep the ranking rule version and persisted rankings epoch explicit. Publish a rule change rather than silently changing historical meaning. Add rankings navigation without altering spoiler-free share content or the result explanation.

## Delivery order and acceptance

1. **Private stats:** implement the authenticated summary and My stats UI using existing durable plays. Verify isolation between players, metric denominators, context separation, repeated Practice attempts, empty history, and recovery across devices.
2. **Daily integrity and streaks:** add stable assignments/revisions, original Daily dates on canonical player + puzzle attempts, deadline handling, preview authorization, and a nonrepeating ranked inventory. Implement current/best streaks once reliable Daily dates are available. Verify the streak acceptance examples above, concurrent starts/actions and scheduling reservations, retry idempotency, midnight boundaries, late finishes, pool/context spoofing, catalog edits, void dates, legacy records, inventory exhaustion without wraparound, and replay behavior.
3. **Public rankings:** add participation preference, snapshot aggregation, board UI, and own-rank display. Verify enabled defaults for new and existing players without a preference, preservation of explicit opt-outs through migration/recovery, ordering, shared ranks across pages, window expiry, zero-solve exclusion, opt-in/out and cache behavior, rebuild equivalence, and all public payload exclusions. Practice stats must remain private with either preference value. Adding any amount of Practice/challenge/author-test activity or Daily replay activity must leave every public ranking metric unchanged. Test accidental repeated assignments both inside and outside the 30-day window, players who missed the original assignment, and replays after a reveal; none may earn fresh solve or tie-breaker credit or extend a streak.
4. **Release review:** check mobile layouts, keyboard/screen-reader interaction, loading/error/empty states, and navigation back to the same play. Run `npm run build`, `npm run lint`, `npm test`, `npm run api:build`, and `npm run api:test`. Update `AGENTS.md`, `GOALS.md`, `PLAN.md`, and the operating guide to describe the implemented rules and snapshot operation; keep the recoverable identity plan's player + puzzle canonical key consistent.

## Implementation notes

- `api/src/daily-schedule.ts` stores frozen assignments and puzzle reservations in `PuzzleCatalog` under `DailySchedule`. Practice exposure reserves the same puzzle key atomically, preventing a concurrent move into ranked Daily. Bootstrap excludes known played puzzles, published Practice, and already-served members of the original 20-puzzle test fixture. Historical catalog edits cannot be reconstructed; the operator must supply genuinely fresh content.
- `api/src/ranking-math.ts` contains deterministic summary, eligibility, ranking, and streak functions. `api/src/rankings.ts` publishes complete snapshot chunks under `RankingSnapshot:<id>` and applies current public preferences before ranking/pagination. No shared HTTP caching is used.
- The v1 rebuild is bounded to 100,000 play rows and 10,000 ranked players. Integration tests exercise the storage path on a small disposable fixture, not production-scale throughput. Add a date index before approaching these limits. Old complete snapshot chunks are removed after publication; an interrupted unpublished build may leave orphan chunks for operator cleanup.
- `app/PlayerStats.tsx` uses a native modal dialog, preserving the underlying puzzle, keyboard focus, and mode. Daily result cards show a current-streak update after the explanation.
- A missing Daily assignment on a past date breaks a streak. Explicitly void/unavailable dates are skipped. An exhausted date remains void even if inventory is replenished later that day; fresh content is selected on the next date.
- Action operation IDs are bound to their action signature so a retry cannot request additional hints or reuse a guess operation to gain an uncounted solve.
- No commit, deployment, production data reset, or player communication is included in this implementation change.

## Local validation

- Production static export and TypeScript compilation passed.
- ESLint and whitespace checks passed.
- All 17 frontend mechanics/invariant tests and 34 API tests passed, including disposable Azurite integration for frozen answers, replay/action protection, private access, preference defaults, tied pagination, opt-out cursor invalidation, and failed-refresh fallback.
- Bicep compiled locally without deploying resources.
- Chromium checks with mocked API fixtures covered 320–1280px layouts, public/private stats, the default-on preference and opt-out, keyboard focus trapping/restoration, and closing Stats back to the active puzzle. API behavior was verified separately against disposable Azurite storage.
- The attempted local-worker delegation produced no changed files after an unsupported tool call. The parent completed and verified the implementation.
