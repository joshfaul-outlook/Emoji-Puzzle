# Azure Operating Guide

## Production resources

`infra/main.bicep` deploys the `emoji-daily-prod-rg` resource group in `eastus2`, a Free Static Web App, a dedicated Standard LRS storage account, the `PuzzleCatalog`, `PuzzleFeedback`, `PlayerDirectory`, `PlayerVerifications`, and `PuzzlePlays` tables, encrypted application settings, and a $5 subscription budget alert. `infra/email-bootstrap.bicep` creates the Azure Communication Services Email resources once; recurring deployments link but never rewrite the verified custom-domain resource. Storage names receive a deterministic unique suffix.

Before provisioning, confirm the active Azure tenant and subscription. The deployment requires a budget notification email, `ADMIN_PASSWORD`, a random `ADMIN_SESSION_SECRET`, and a separate random `PLAYER_RECOVERY_HMAC_SECRET`; both secrets must contain at least 32 characters. Do not commit any of these values.

GitHub production must define `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `PLAYER_RECOVERY_HMAC_SECRET` in its protected `production` environment. Set the protected environment variable `GAME_LAUNCH_DATE` to the UTC date that should serve the first Daily puzzle, using `YYYY-MM-DD`; deployments default to `2026-08-05` when it is absent. Set `ACS_EMAIL_DOMAIN_READY` to `true` only after Azure reports the custom email domain fully verified. The Azure identity uses OIDC and is granted Contributor only on `emoji-daily-prod-rg`. Subscription-scope bootstrap and budget changes are run manually by an authorized subscription operator.

The production deployment workflow runs only after pushes to the repository’s `deploy` branch or by manual dispatch; pushes to `main` do not deploy. It validates the web app and API with pinned Node 22.13.0 before requesting access to the protected `production` environment. It then uses Azure OIDC to provision the existing production resource group idempotently, package the Static Web Apps configuration with the validated frontend artifact, seed the catalog, publish the static site and `/api`, and smoke-test `https://emojizzle.com`. Configure the `production` environment approval rules before enabling automatic deploys. Pull requests never access production storage.

## Puzzle operations

Visit `/admin/`, enter the configured password, and use the catalog filters. Choose one pool with all statuses visible to drag puzzles by the handle; drops save immediately. Numeric pool positions are also available in the editor. New records begin as drafts. Publishing requires an emoji sequence, category, canonical accepted answer, three hints, and an explanation. Archive removes a record from gameplay without deleting it; Restore returns it to Draft. ETags prevent an older tab from overwriting a newer edit.

The editor’s AI help uses `OPENAI_API_KEY` server-side and returns reviewable emoji, category, accepted-answer, hint, and explanation suggestions. It never saves or publishes automatically. `OPENAI_MODEL` defaults to `gpt-5.6-luna`.

The emoji helper searches a bundled dataset locally. `Use suggested` replaces the current sequence, `Copy` copies the suggestion, `Undo` restores the previous sequence, and the emoji field always remains manually editable.

## Daily rankings rollout and operation

Private stats are available from the player's **Stats** control. Public Daily stats default on, with a durable opt-out. Practice and shared challenge stats always remain private. Daily ranking order is solves over today plus the prior 29 UTC dates, then unaided solves; equal totals share ranks. Current and best Daily solve streaks use all eligible history from rankings launch.

Rankings activate with deployment. The workflow's production smoke test requests the current Daily puzzle, which atomically stores that UTC date as the rankings epoch and freezes the first nonrepeating assignment. Later deployments reuse the persisted epoch; there is no rankings launch-date setting to manage. Supply new authored Daily records beyond the exposed test fixture as development continues. Do not relabel exposed Practice puzzles as fresh Daily content or reset player data to create eligibility.

On the first request at or after launch, the server reserves historical content from known plays, published Practice, and served original test-fixture Daily puzzles. Each issued Daily date stores a frozen puzzle snapshot and an atomic puzzle reservation in `PuzzleCatalog` / `DailySchedule`. Each player retains the same canonical player + puzzle attempt. Catalog edits, reordering, and archival cannot alter an already-issued puzzle. Requests to author previews require the existing admin session; preview attempts never qualify for rank.

Fresh Daily inventory never wraps. If exhausted, the API returns `503` with `DAILY_UNAVAILABLE`, records a void date, and logs a Daily inventory warning. Practice remains accessible. Replenish inventory for the next UTC date; the void date stays fixed. Configure an operational alert for that warning in the existing hosting diagnostics before public launch. Do not reseed or erase schedule reservations to refill ranked inventory. Missed past dates without an assignment break streaks; explicitly void dates neither extend nor break them.

For a material error in an issued puzzle, an authenticated admin can send a same-origin `POST /api/manage/daily/void` with JSON `{ "dailyDate": "YYYY-MM-DD" }`. This permanently voids that assignment for ranking and streak calculations; it does not erase plays, free its puzzle reservation, or replace the puzzle mid-day. Public reads refuse an invalidated snapshot until a fresh one is available. Review the date before invoking this operation.

Rankings use HTTP-triggered refreshes because managed Static Web Apps does not support timer triggers. The first board/stats request after five minutes refreshes a persisted snapshot under a storage lease; concurrent readers get the last complete compatible board or a temporary updating response. Every response displays its actual `asOf` time. Preference filtering is live and `no-store`, including pagination; opt-out takes effect without waiting for a rebuild. A changed snapshot or public roster invalidates old cursors (`409`); refresh the board from the beginning. Snapshot failure does not prevent saving a play or loading private totals.

Snapshots use `PuzzleCatalog` partitions `Rankings` (lease/pointer) and `RankingSnapshot:<id>` (chunks). Rebuilds derive from canonical `PuzzlePlays` records, never feedback or incremental score counters. V1 caps rebuilds at 100,000 plays and 10,000 ranked players. Measure production scan duration and add a date index before reaching those bounds. A failed rebuild leaves the last complete snapshot and a server diagnostic. The lease expires after five minutes. Interrupted unpublished builds can leave orphan chunks; remove only partitions confirmed unreferenced by the current pointer and inactive builds. Never delete `DailySchedule` or original play facts as cache maintenance.

## Data migration and recovery

`npm run seed` is idempotent and preserves the original Daily 20 and shuffled Practice 330 positions. Once `catalog-v1` is recorded, later deployments do not overwrite admin edits.

Export historical D1 feedback read-only to JSON without changing the dormant database, then run:

```bash
TABLE_STORAGE_CONNECTION_STRING="..." npm --prefix api run import:feedback -- /path/to/export.json
```

The import uses stable hashes, so rerunning it does not duplicate records. Imported historical feedback intentionally has no player attribution. Reconcile the source count with the Azure table count before considering the migration complete.

For the recoverable-identity rollout only, reset the disposable test identity data after taking any desired backup:

```bash
TABLE_STORAGE_CONNECTION_STRING="..." npm --prefix api run reset:player-data -- --confirm-reset-player-data
```

This deletes every row from exactly `PuzzleFeedback`, `PlayerDirectory`, `PuzzlePlays`, and `PlayerVerifications`; it never touches `PuzzleCatalog` or drops any table. Do not put this command into the recurring deployment workflow. After rollout, player and play tables are durable. Clearing site data leads to email recovery of the existing player rather than releasing its name.

## Custom domain and SSL

Deploy and verify the generated `azurestaticapps.net` hostname first. The Bicep default custom domain is `emojizzle.com`; configure Azure’s requested TXT validation and CNAME/ALIAS records before deploying it. This also sets the API `SITE_ORIGIN` application setting to `https://emojizzle.com`; pass `customDomain=''` only when the generated Azure hostname is required. Static Web Apps Free automatically provisions and renews SSL. Do not change unrelated DNS records.

Verification mail uses the dedicated `auth.emojizzle.com` sending subdomain and `Emojizzle <players@auth.emojizzle.com>`. Roll it out in two stages:

1. Manually deploy `infra/email-bootstrap.bicep` into the production resource group to create the Email Communication Service, custom-domain resource, and unlinked Communication Service. Do not run the application release workflow yet, because verification delivery is unavailable until the domain is linked. The bootstrap template must not be rerun after verification; recurring deployment treats the verified domain as an existing resource so its verification state is preserved.
2. In Azure, copy the generated ownership, SPF, and DKIM values into the DNS zone for `auth.emojizzle.com`. Add a DMARC policy for the subdomain and wait for Azure to report the domain fully verified.
3. Set the protected GitHub environment variable `ACS_EMAIL_DOMAIN_READY=true` and deploy again. This creates the `players` sender username and links the verified domain to the Communication Services resource.
4. Send a real verification code to an address outside the project domain and inspect delivery plus SPF, DKIM, and DMARC results before announcing the flow.

The API retains only an HMAC lookup key for recovery email addresses. Raw addresses exist only in the request and outbound email call. Keep `PLAYER_RECOVERY_HMAC_SECRET` stable: replacing it makes existing email lookup keys unrecoverable. Production must use `VERIFICATION_SENDER=acs`; `VERIFICATION_SENDER=console` is local-development-only and prints codes in the server terminal.

## Mobile acceptance and incidents

Check 320, 360, 390, 430, 768, and desktop widths in portrait and landscape. Verify safe areas, browser zoom, software keyboards, rotation with unsaved edits, touch targets, focus visibility, game flows, CRUD, emoji selection, and feedback review.

Gameplay remains available if feedback submission fails. If the catalog is empty, reseed rather than exposing the compiled fixture to players. If concurrency returns `409`, reload the current record before retrying. Player-auth failures include structured codes and server diagnostics that distinguish missing credentials, unknown players/sessions, revocation, and token mismatch without logging secrets. Never loosen deterministic answer matching globally to fix one missed variant.
