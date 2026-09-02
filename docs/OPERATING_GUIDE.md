# Azure Operating Guide

## Production resources

`infra/main.bicep` deploys the `emoji-daily-prod-rg` resource group in `eastus2`, a Free Static Web App, a dedicated Standard LRS storage account, the `PuzzleCatalog`, `PuzzleFeedback`, `PlayerDirectory`, `PlayerVerifications`, and `PuzzlePlays` tables, Azure Communication Services Email, encrypted application settings, and a $5 subscription budget alert. Storage names receive a deterministic unique suffix.

Before provisioning, confirm the active Azure tenant and subscription. The deployment requires a budget notification email, `ADMIN_PASSWORD`, a random `ADMIN_SESSION_SECRET`, and a separate random `PLAYER_RECOVERY_HMAC_SECRET`; both secrets must contain at least 32 characters. Do not commit any of these values.

GitHub production must define `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `PLAYER_RECOVERY_HMAC_SECRET` in its protected `production` environment. Set the environment variable `ACS_EMAIL_DOMAIN_READY` to `true` only after Azure reports the custom email domain fully verified. The Azure identity uses OIDC and is granted Contributor only on `emoji-daily-prod-rg`. Subscription-scope bootstrap and budget changes are run manually by an authorized subscription operator.

The production deployment workflow runs only after pushes to the repository’s `deploy` branch or by manual dispatch; pushes to `main` do not deploy. It validates the web app and API with pinned Node 22.13.0 before requesting access to the protected `production` environment. It then uses Azure OIDC to provision the existing production resource group idempotently, package the Static Web Apps configuration with the validated frontend artifact, seed the catalog, publish the static site and `/api`, and smoke-test `https://emojizzle.com`. Configure the `production` environment approval rules before enabling automatic deploys. Pull requests never access production storage.

## Puzzle operations

Visit `/admin/`, enter the configured password, and use the catalog filters. Choose one pool with all statuses visible to drag puzzles by the handle; drops save immediately. Numeric pool positions are also available in the editor. New records begin as drafts. Publishing requires an emoji sequence, category, canonical accepted answer, three hints, and an explanation. Archive removes a record from gameplay without deleting it; Restore returns it to Draft. ETags prevent an older tab from overwriting a newer edit.

The editor’s AI help uses `OPENAI_API_KEY` server-side and returns reviewable emoji, category, accepted-answer, hint, and explanation suggestions. It never saves or publishes automatically. `OPENAI_MODEL` defaults to `gpt-5.6-luna`.

The emoji helper searches a bundled dataset locally. `Use suggested` replaces the current sequence, `Copy` copies the suggestion, `Undo` restores the previous sequence, and the emoji field always remains manually editable.

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

1. Manually deploy only `infra/resources.bicep` with `emailDomainReady=false` to create the Email Communication Service and custom-domain resource. Do not run the application release workflow yet, because verification delivery is unavailable until the domain is linked.
2. In Azure, copy the generated ownership, SPF, and DKIM values into the DNS zone for `auth.emojizzle.com`. Add a DMARC policy for the subdomain and wait for Azure to report the domain fully verified.
3. Set the protected GitHub environment variable `ACS_EMAIL_DOMAIN_READY=true` and deploy again. This creates the `players` sender username and links the verified domain to the Communication Services resource.
4. Send a real verification code to an address outside the project domain and inspect delivery plus SPF, DKIM, and DMARC results before announcing the flow.

The API retains only an HMAC lookup key for recovery email addresses. Raw addresses exist only in the request and outbound email call. Keep `PLAYER_RECOVERY_HMAC_SECRET` stable: replacing it makes existing email lookup keys unrecoverable. Production must use `VERIFICATION_SENDER=acs`; `VERIFICATION_SENDER=console` is local-development-only and prints codes in the server terminal.

## Mobile acceptance and incidents

Check 320, 360, 390, 430, 768, and desktop widths in portrait and landscape. Verify safe areas, browser zoom, software keyboards, rotation with unsaved edits, touch targets, focus visibility, game flows, CRUD, emoji selection, and feedback review.

Gameplay remains available if feedback submission fails. If the catalog is empty, reseed rather than exposing the compiled fixture to players. If concurrency returns `409`, reload the current record before retrying. Player-auth failures include structured codes and server diagnostics that distinguish missing credentials, unknown players/sessions, revocation, and token mismatch without logging secrets. Never loosen deterministic answer matching globally to fix one missed variant.
