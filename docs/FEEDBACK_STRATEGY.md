# Engagement and Feedback Strategy

## Purpose

The feedback loop should improve puzzle craft and the daily ritual without turning the MVP into an analytics project.

The initial questions are:

1. Was this puzzle satisfying?
2. Was it fair or ambiguous?
3. Did hints rescue the experience?
4. Which structures create the best reveals?
5. Where does the interaction itself create friction?

## What is captured now

After solve or reveal, a player can select thumbs up or down and optionally explain why. The record includes the puzzle, outcome, elapsed time, guess count, hints used, timestamp, and limited anonymous device context.

This combines explicit sentiment with enough play context to interpret it. It intentionally does not produce a universal score.

## Review cadence

During the first ten-puzzle playtest, review feedback after every five completed players or every three days, whichever comes first.

For each puzzle, summarize:

- positive and negative ratings;
- solved versus revealed outcomes;
- typical hint depth;
- guess-count and elapsed-time range;
- recurring comment themes;
- missed but fair answer variants;
- one recommended action: keep, revise, replace, or retest.

Keep small samples visible. A single clear comment can reveal a real ambiguity even when the aggregate rating looks positive.

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
- Long elapsed time is only meaningful with outcome, hint use, and comments.
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

Add event-level analytics when a concrete question cannot be answered from result feedback—for example, where players abandon before reaching a result. If added, document the event, purpose, retention, and privacy impact before collection begins.

An internal feedback export or analysis notebook can follow once raw volume makes manual review inconvenient. A public dashboard and admin UI remain out of scope.
