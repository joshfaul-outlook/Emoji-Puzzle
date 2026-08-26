# Azure Operating Guide

## Production resources

`infra/main.bicep` deploys the `emoji-daily-prod-rg` resource group in `eastus2`, a Free Static Web App, a dedicated Standard LRS storage account, both tables, encrypted application settings, and a subscription budget alert. Storage names receive a deterministic unique suffix.

Before provisioning, confirm the active Azure tenant and subscription. The deployment requires a budget notification email, `ADMIN_PASSWORD`, and a random `ADMIN_SESSION_SECRET` of at least 32 characters. Do not commit any of these values.

GitHub production must define `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in its protected `production` environment. The Azure identity uses OIDC and is granted Contributor only on `emoji-daily-prod-rg`. Subscription-scope bootstrap and budget changes are run manually by an authorized subscription operator.

The production workflow validates both apps, provisions the existing production resource group idempotently, seeds the catalog once, deploys the exact static/API build, and smoke-tests the generated hostname. It runs only for `main` and manual dispatches; pull requests never access production storage.

## Puzzle operations

Visit `/admin/`, enter the configured password, and use the catalog filters. New records begin as drafts. Publishing requires an emoji sequence, category, canonical accepted answer, three hints, and an explanation. Archive removes a record from gameplay without deleting it; Restore returns it to Draft. ETags prevent an older tab from overwriting a newer edit.

The emoji helper searches a bundled dataset locally. `Use suggested` replaces the current sequence, `Copy` copies the suggestion, `Undo` restores the previous sequence, and the emoji field always remains manually editable.

## Data migration and recovery

`npm run seed` is idempotent and preserves the original Daily 20 and shuffled Practice 330 positions. Once `catalog-v1` is recorded, later deployments do not overwrite admin edits.

Export historical D1 feedback read-only to JSON without changing the dormant database, then run:

```bash
TABLE_STORAGE_CONNECTION_STRING="..." npm --prefix api run import:feedback -- /path/to/export.json
```

The import uses stable hashes, so rerunning it does not duplicate records. Reconcile the source count with the Azure table count before considering the migration complete.

## Custom domain and SSL

Deploy and verify the generated `azurestaticapps.net` hostname first. For a custom domain, configure Azure’s requested TXT validation and CNAME/ALIAS records, then redeploy with the `customDomain` Bicep parameter. Static Web Apps Free automatically provisions and renews SSL. Do not change unrelated DNS records.

## Mobile acceptance and incidents

Check 320, 360, 390, 430, 768, and desktop widths in portrait and landscape. Verify safe areas, browser zoom, software keyboards, rotation with unsaved edits, touch targets, focus visibility, game flows, CRUD, emoji selection, and feedback review.

Gameplay remains available if feedback submission fails. If the catalog is empty, reseed rather than exposing the compiled fixture to players. If concurrency returns `409`, reload the current record before retrying. Never loosen deterministic answer matching globally to fix one missed variant.
