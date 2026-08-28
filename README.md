# Emojizzle

One globally shared emoji puzzle per UTC day, plus a separate Practice sequence and a private mobile-first puzzle administration portal.

Looks obvious. Eventually. · https://emojizzle.com

## Architecture

- Next.js static export hosted on Azure Static Web Apps Free
- Node 22 managed Azure Functions under `/api`
- Azure Table Storage tables `PuzzleCatalog`, `PuzzleFeedback`, `PlayerDirectory`, and `PuzzlePlays`
- Browser-local named player identity with hashed server-side credentials
- Signed static-password admin sessions
- Bundled Emojibase keyword search and deterministic phrase suggestions

The original 350-puzzle TypeScript inventory is retained only as the seed and test fixture. Production gameplay and administration read from Table Storage. The previous Sites/D1 deployment is dormant and is not changed by this repository.

## Local development

Use Node 22.13 or newer. Install Azure Functions Core Tools v4, then:

```bash
npm install
npm install --prefix api
cp api/local.settings.example.json api/local.settings.json
npm run dev:storage
```

In separate terminals run `npm run dev` and `npm run dev:azure`. Seed Azurite with `npm run seed` while `TABLE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true` is set.

Open the URL printed by the Static Web Apps CLI. Game routes are `/`, `/practice/`, `/next/`, and `/startover/`; administration is at `/admin/`.

## Verification

```bash
npm run lint
npm test
npm run api:test
npm run api:build
npm run build
```

See [the operating guide](docs/OPERATING_GUIDE.md) for Azure provisioning, secrets, deployment, feedback import, custom domains, and incident guidance.
