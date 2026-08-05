# Refined MVP Plan

## Current baseline

The repository begins with a usable mechanics prototype:

- a branded, mobile-first daily puzzle screen;
- ten editable playtest puzzles;
- a UTC-based shared daily rotation;
- server-side answer checking with explicit variants;
- unlimited guesses and three progressive hints;
- explicit give-up/reveal and an explanation-led result;
- guess count and hint count;
- spoiler-free sharing through messaging, email, copy-link, and native share options;
- durable thumbs up/down feedback with optional notes;
- device-local play continuity and anonymous metadata;
- temporary `/next` and `/startover` playtest routes for rapid iteration;
- a public deployment path.

This baseline is intentionally small. The next work is product learning, not feature accumulation.

## Phase 1: Validate the mechanics

Run the ten-puzzle set with a small group and watch for:

- whether the task is understood without explanation;
- how people phrase correct answers;
- when they request each hint;
- whether “Reveal answer” feels clear and non-punitive;
- whether the result creates a genuine “ohhh” moment;
- whether the share result feels worth sending;
- whether feedback is easy enough to leave.

Make one-at-a-time experiments in this order:

1. Answer acceptance gaps and confusing error copy.
2. Hint sequence, wording, and timing.
3. Reveal confirmation and result pacing.
4. Share language and result representation.
5. Daily return cue.

Do not add lives, guess limits, streak pressure, or a score until observed behavior identifies a real problem they would solve.

## Phase 2: Establish the puzzle engine

Use feedback from the first set to create a repeatable authoring workflow:

1. Draft the intended answer and clue mapping.
2. Generate plausible competing answers.
3. Revise until the intended answer is distinguishable.
4. Write accepted variants explicitly.
5. Author three hints from broad to specific.
6. Write the reveal explanation.
7. Blind-test with at least three people.
8. Record difficulty, ambiguity, delight, and missed variants.
9. Publish only after the reveal consistently feels fair.

Build the next batch in small groups of five rather than creating a year of content upfront.

## Phase 3: Improve the learning loop

After enough plays exist to compare puzzles:

- collate feedback by puzzle and structure;
- compare solved versus revealed outcomes;
- examine hint depth and guess count distributions;
- tag comments for ambiguity, delight, difficulty, reference familiarity, and technical problems;
- maintain a short puzzle postmortem with the specific revision or lesson.

Add event-level analytics only if raw result feedback cannot answer an important product question. Keep any new collection anonymous and documented.

## Phase 4: Public MVP readiness

Before promoting beyond a controlled playtest:

- replace or re-sequence weak puzzles;
- build at least a 14-day reviewed content buffer;
- confirm feedback retention and export access;
- add lightweight error monitoring;
- verify share previews and public access on common mobile browsers;
- write a minimal privacy note describing local play state and anonymous feedback;
- decide what happens after the last scheduled puzzle without surprising players.

## Decision gates

### Keep investing when

- several puzzle structures reliably create delight;
- players voluntarily return or share;
- feedback produces clear content improvements;
- the team can maintain the authoring quality bar.

### Rework the mechanic when

- accepted-answer maintenance dominates iteration;
- players need instructions before every puzzle;
- reveals routinely feel arbitrary;
- hint usage does not rescue ambiguous puzzles.

### Stop or reposition when

- even the strongest tested puzzles do not produce an “aha”;
- variety consistently feels like randomness rather than discovery;
- daily scarcity does not create anticipation or return behavior.

## Near-term backlog

1. Run an internal ten-puzzle playtest using the temporary `/next` route; use `/startover` to simulate a new player.
2. Review raw feedback after every five players or every three days, whichever comes first.
3. Fix accepted variants and wording without changing multiple mechanics at once.
4. Replace the two weakest puzzles before expanding the set.
5. Author puzzles 11–15 using the strongest two structures plus one deliberate experiment.
6. Decide whether a tiny first-visit instruction or example is actually needed.
7. Add a privacy note and error monitoring before broad promotion.

The `/next` route deliberately enables persistent sequence mode and bypasses daily scarcity for mechanics testing. Root and `?puzzle=N` results retain the daily wait. Remove `/next` before the daily ritual becomes the primary evaluation target.
