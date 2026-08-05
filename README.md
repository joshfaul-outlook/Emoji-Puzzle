# Emoji Daily MVP

A deliberately small daily emoji puzzle for playtesting the core ritual:

`one shared puzzle → guess or use hints → solve/reveal → share → rate it`

No account is required. A device keeps its current puzzle state locally; puzzle feedback is stored as raw rows in D1 for later analysis.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by the development server. The local D1 binding is created automatically the first time feedback is submitted.

## Test and build

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

The tests cover server rendering, deterministic answer normalization, wrong guesses, and progressive authored hints.

## Edit puzzles and mechanics

All 10 playtest puzzles and the small rules object are in `lib/puzzles.ts`.

- Change `PUZZLES` to edit emoji sequences, accepted variants, hints, categories, and explanations.
- Change `GAME_CONFIG.launchDate` to move day one.
- `cycleAfterLastPuzzle` controls whether the set loops after day ten.
- Add accepted variants explicitly. Guesses are normalized for case, punctuation, apostrophes, ampersands, and whitespace, but are never fuzzily matched.
- Add `?puzzle=1` through `?puzzle=10` to the URL to directly test any seeded puzzle without changing the daily schedule.

The shared daily rotation uses UTC. Answers stay server-side and are only returned after a correct guess or an explicit reveal.

## Feedback records

`POST /api/feedback` stores one raw row with:

- puzzle id and number
- thumbs up/down rating and optional comment
- server timestamp
- anonymous session id and per-play id
- solved/revealed outcome
- elapsed seconds, guesses, and hints used
- compact anonymous context: played date, locale, timezone, viewport, pixel ratio, and reduced-motion preference

There is intentionally no account, analytics dashboard, numeric score, admin UI, or production data pipeline in this MVP.
