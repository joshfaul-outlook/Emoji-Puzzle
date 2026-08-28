# Azure Operating Guide

## Production resources

`infra/main.bicep` deploys the `emoji-daily-prod-rg` resource group in `eastus2`, a Free Static Web App, a dedicated Standard LRS storage account, the `PuzzleCatalog`, `PuzzleFeedback`, `PlayerDirectory`, and `PuzzlePlays` tables, encrypted application settings, and a subscription budget alert. Storage names receive a deterministic unique suffix.

Before provisioning, confirm the active Azure tenant and subscription. The deployment requires a budget notification email, `ADMIN_PASSWORD`, and a random `ADMIN_SESSION_SECRET` of at least 32 characters. Do not commit any of these values.

GitHub production must define `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in its protected `production` environment. The Azure identity uses OIDC and is granted Contributor only on `emoji-daily-prod-rg`. Subscription-scope bootstrap and budget changes are run manually by an authorized subscription operator.

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

Player-directory and play tables are additive and are created idempotently by infrastructure and local seeding. Existing feedback rows require no backfill. Clearing site data removes the browser credential and prompts for a new name; it does not release the old normalized-name reservation.

## Custom domain and SSL

Deploy and verify the generated `azurestaticapps.net` hostname first. The Bicep default custom domain is `emojizzle.com`; configure Azure’s requested TXT validation and CNAME/ALIAS records before deploying it. This also sets the API `SITE_ORIGIN` application setting to `https://emojizzle.com`; pass `customDomain=''` only when the generated Azure hostname is required. Static Web Apps Free automatically provisions and renews SSL. Do not change unrelated DNS records.

## Mobile acceptance and incidents

Check 320, 360, 390, 430, 768, and desktop widths in portrait and landscape. Verify safe areas, browser zoom, software keyboards, rotation with unsaved edits, touch targets, focus visibility, game flows, CRUD, emoji selection, and feedback review.

Gameplay remains available if feedback submission fails. If the catalog is empty, reseed rather than exposing the compiled fixture to players. If concurrency returns `409`, reload the current record before retrying. Never loosen deterministic answer matching globally to fix one missed variant.
