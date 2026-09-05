# Emojizzle: Product Goals

## Vision

Create a tiny global ritual: everyone receives the same sequence of emojis, tries to understand what it means, shares a spoiler-free result, and comes back tomorrow.

Emojizzle is not “guess the movie from emojis.” It is a daily visual-semantic riddle whose answer may be a phrase, person, story, song, event, place, joke, or concept.

## Core hypothesis

The product works if we can repeatedly author puzzles that are:

- intriguing before the answer;
- fair enough to keep trying;
- flexible enough to support varied clue styles;
- satisfying and inevitable after the reveal.

The MVP exists to test that hypothesis, not to prove a complete business model.

## MVP goals

1. Make the complete daily loop understandable without instructions or an account.
2. Learn which clue styles create the strongest “aha” and which create ambiguity.
3. Learn how players use guesses, hints, and reveal when they get stuck.
4. Make sharing feel natural without leaking the puzzle.
5. Create a lightweight, repeatable feedback loop for puzzle quality.
6. Keep puzzle content and mechanics easy to change during daily iteration.
7. Establish a branded public prototype that is usable on a phone and safe to share.

## Player promise

- One new puzzle each day.
- The same puzzle for everyone.
- No password, conventional sign-up, feed, or busywork; a verified email lets a player keep one display name and continue on another device.
- Unlimited guesses and optional help.
- A satisfying explanation whether solved or revealed.
- An optional Practice mode for playing several separate, ranking-ineligible puzzles at a time.

## Gameplay modes

- **Daily** remains the default on every new browser-tab session. Everyone receives the same puzzle from an immutable, nonrepeating UTC schedule initialized by deployment. Only original, on-time Daily solves count toward public rankings.
- **Practice** is selected explicitly and resumes device-local progress through an append-only sequence: the former puzzles 21–100 plus 250 easier, pop-culture-focused additions. It wraps with fresh attempts, hides sequence numbers from players, and collects thumbs-only feedback.
- Shared Practice links open standalone, spoiler-free challenges without changing either player’s saved Practice position.

## Player statistics and Daily rankings

Players can view separate Daily stats, public rankings, and private Practice stats through their player-name Stats control. Daily stats include current and best solve streaks. Shared Practice challenges keep their result-card comparison and do not appear in Stats. Public rankings use the last 30 UTC dates: most eligible Daily solves, then most solves without hints, with shared ranks. Public Daily stats default to yes; a player can opt out across all their devices. Practice is always private. Repeated Daily puzzles never count, and the launch schedule never wraps.

## What success looks like in this phase

We are looking for directional evidence, not a composite score:

- Players understand what to do within seconds.
- Most puzzles produce a meaningful solve or reveal rather than abandonment.
- Players can explain why the answer fits after seeing it.
- Hint usage reveals useful difficulty differences between clue styles.
- Written feedback identifies actionable ambiguity, delight, or unfairness.
- Some players share or return without being prompted by accounts or rewards.
- The team can revise a puzzle or mechanic and publish it quickly.

## Playtest set

The 350-puzzle seed inventory intentionally covers literal translation, idioms, rebus logic, American places and history, famous people, books, movies, music, television, food, sports, holidays, and interpretive questions. The references are selected for broad recognition by a U.S. audience. This is authored inventory, not a claim that every puzzle is reviewed or scheduled: blind testing and feedback determine which records are approved for the Daily rotation and which need revision or replacement.

## Non-goals

This starting point does not attempt to build:

- passwords, conventional accounts, public profiles, or generalized cross-device Practice synchronization;
- monetization or subscriptions;
- social feeds, comments, or competitive features beyond the Daily rankings;
- player-facing accounts or social content management;
- AI or fuzzy answer adjudication;
- localization;
- a year of puzzle inventory;
- sophisticated analytics or production data pipelines;
- a universal numeric quality or player score.
