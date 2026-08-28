# Engagement and Feedback Strategy

## Purpose

The feedback loop should improve puzzle craft and the daily ritual without turning the product into a generalized analytics project.

The initial questions are:

1. Was this puzzle satisfying?
2. Was it fair or ambiguous?
3. Did hints rescue the experience?
4. Which clue styles create the best reveals?
5. Where does the interaction itself create friction?

## What is captured now

After a Daily solve or reveal, a player can select thumbs up or down and optionally explain why. Practice and standalone challenges collect thumbs only, with comments rejected server-side. Every new record includes the browser player's opaque ID and display-name snapshot plus its puzzle pool, outcome, guess count, hints used, timestamp, and limited device context. Historical anonymous rows remain readable.

This combines explicit sentiment with enough play context to interpret it. It intentionally does not produce a universal score.

## Review cadence

During the ongoing public test, review feedback after every five new feedback submissions or every three days, whichever comes first. This cadence applies to staged review batches, not to a claim that all 350 authored puzzles are already validated.

For each puzzle, summarize:

- positive and negative ratings;
- solved versus revealed outcomes;
- typical hint depth;
- guess-count range;
- recurring comment themes;
- missed but fair answer variants;
- one recommended action: keep, revise, replace, or retest.

Keep small samples visible. A single clear comment can reveal a real ambiguity even when the aggregate rating looks positive.

All report metrics describe feedback submissions, not total plays, completion, or abandonment. Treat solved/revealed, hint, and guess figures as context for people who submitted feedback, not population-wide rates.

## Comment tags

Use a small manual vocabulary when collating notes:

- `delight` — satisfying clue or reveal;
- `ambiguous` — multiple answers felt equally valid;
- `too-easy` — answer was immediate without interpretation;
- `too-hard` — clue path was inaccessible even after hints;
- `unfamiliar` — reference was not recognized;
- `hint-helpful` — hints restored progress;
- `hint-spoiled` — hint jumped too close to the answer;
- `variant-missed` — fair phrasing was rejected;
- `interaction` — confusion about guessing, revealing, sharing, or feedback;
- `technical` — error, persistence, layout, or performance problem.

## Interpreting signals

- High positive ratings with low hint use may indicate a good easy puzzle, not automatically an overly easy one.
- High reveal rates plus positive comments may indicate a hard but satisfying puzzle.
- Repeated variant misses are an acceptance-list problem; competing intended answers are a puzzle-design problem.
- Sharing is a useful engagement signal, but lack of sharing does not make a puzzle bad.

## Experiment discipline

For any mechanics experiment, write down:

- the problem observed;
- the one change being tested;
- the expected player behavior;
- the feedback or outcome that would support the change;
- the date and puzzles affected.

Avoid changing hint policy, result copy, sharing, and answer acceptance simultaneously. Content changes can overwhelm mechanics signals, so record puzzle replacements alongside product experiments.

## Later, only if needed

Durable per-attempt play rows retain counts, outcome, eligibility, and timing even when feedback is not submitted. They do not retain guess text. Add broader event-level analytics only when a concrete question cannot be answered from these facts and result feedback; document its purpose, retention, and privacy impact first.

The internal read-only feedback report supports the existing manual review cadence without adding event tracking, write controls, or a public dashboard. An export or analysis notebook can follow once raw volume makes manual review inconvenient. A CRUD admin UI remains out of scope.
