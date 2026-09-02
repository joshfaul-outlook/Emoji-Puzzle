# Recoverable Player Identity and Cross-Device Daily Play — Feature Plan

## Approved implementation decisions

- Canonical Daily attempts are keyed by `playerId + puzzleId`; the production catalog will not repeat puzzles once built out.
- The current player, play, verification, and feedback tables contain disposable test data and will be reset at rollout. `PuzzleCatalog` is retained.
- Because of that reset, v1 credential migration and duplicate-player cleanup tooling are deliberately omitted.
- Production verification mail uses Azure Communication Services Email from `Emojizzle <players@auth.emojizzle.com>`.
- Sessions are long-lived and revocable, recovery lookup uses a dedicated HMAC secret, and Practice progression remains device-local.

## Purpose

Replace Emojizzle’s browser-only player identity with a lightweight, recoverable identity that still feels like **no account and no login** to the player.

Real-world playtesting has now demonstrated that browser-local identity is not reliable enough. An iPhone user repeatedly lost his saved identity, was prompted to choose another name, and eventually progressed from `Mark` through multiple variants such as `Mark5` because his original names remained globally reserved.

This feature should solve that failure mode while also enabling the same player to continue a Daily puzzle from another device.

The objective is:

> Keep Emojizzle friction extremely low while making a player name something the player can reliably keep.

This is **not** a conventional account system. There are no passwords, usernames separate from display names, profile pages, account dashboards, social authentication, or mandatory account-management UI.

---

# Product goals

1. A returning player must not permanently lose access to an existing player name simply because browser-local storage disappears.
2. A player should be able to establish their identity on another browser or device using a short verification code delivered by email.
3. Multiple devices should map to the same immutable `playerId`.
4. Each device should receive its own revocable credential rather than sharing one permanent player token across all devices.
5. A Daily puzzle already started on one device should resume from the same server-side attempt on another device.
6. New attributable play data and feedback must remain associated with the same player across recovered sessions.
7. The interaction should continue to feel substantially lighter than creating an account.
8. Identity failures must become diagnosable. Do not silently erase identity merely because an authenticated API call returns a generic `401`.

---

# Current architecture

The current system has:

- globally unique, case-insensitive display names;
- an immutable server-generated `playerId`;
- a browser token whose hash is stored on the Player record;
- browser identity stored under the versioned local-storage key `emojizzle-player-identity:v1`;
- Azure Table Storage `PlayerDirectory`;
- durable `PuzzlePlays`;
- player-attributed feedback;
- server-side guess/hint/reveal tracking;
- an explicit `/api/plays/start` lifecycle;
- device-local puzzle state containing the current `playId`.

The current identity effectively looks like:

```ts
type PlayerRecord = {
  playerId: string;
  displayName: string;
  normalizedDisplayName: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
};
```

and the browser stores:

```ts
{
  playerId,
  displayName,
  token
}
```

That model assumes one durable browser credential per player. Cross-device recovery requires separating the durable **player** from individual **device sessions**.

---

# Product terminology

Internally this may use authentication/session concepts.

Player-facing language should avoid unnecessary account terminology.

Prefer:

- Player name
- Remember this player
- Recover your player
- Send code
- Verification code
- Continue as Mark
- Use Emojizzle on another device

Avoid prominent language such as:

- Create account
- Password
- Authentication
- Credential
- Sign up

“Sign in” may be used only if UX testing shows it is clearer than “I already play Emojizzle,” but the preferred initial terminology is player recovery rather than conventional login.

---

# New-player experience

A brand-new browser should continue to start with the player-name flow.

Recommended flow:

```text
Choose your player name
        ↓
Mark
        ↓
Enter email
        ↓
Send code
        ↓
6-digit verification code
        ↓
Player created / recovered
        ↓
Play
```

The interface should explain succinctly:

> No password. Your email lets you keep your player name and use Emojizzle on other devices.

For this iteration, **verified recovery information should be required for newly created globally reserved player names**.

Do not create more permanently reserved, unrecoverable names.

If product implementation constraints make creation-before-verification materially simpler, the name reservation must be temporary until email verification succeeds.

A failed or abandoned verification must not permanently consume a display name.

---

# Returning browser behavior

If the browser still holds a valid device session:

```text
Open Emojizzle
    ↓
Player recognized
    ↓
Puzzle opens normally
```

No email prompt and no verification challenge should occur during normal returning play.

Verification is for:

- initial identity establishment;
- recovery after local identity is unavailable;
- establishing an additional device;
- deliberate identity switching if that capability is exposed later.

---

# Lost identity / new-device experience

When no valid local player session exists, offer two clear paths:

```text
Welcome to Emojizzle

[ I'm new ]

[ I already play Emojizzle ]
```

The recovery flow:

```text
I already play Emojizzle
        ↓
Enter email address
        ↓
Send 6-digit code
        ↓
Verify
        ↓
If one player is linked:
    Continue as Mark
        ↓
Issue this device its own session
```

If the architecture later permits multiple player names per recovery email, the response after successful verification may allow selection among those players.

For MVP, prefer **one recovery email → one active player identity** unless existing data or implementation requirements strongly justify supporting multiple.

Do not expose whether a specific email exists before verification.

---

# Email rather than SMS for MVP

Implement email verification first.

Do not implement SMS/phone recovery in this branch.

Reasons:

- materially lower operating cost;
- simpler international behavior;
- no phone-number normalization;
- lower abuse exposure;
- no carrier delivery complexity;
- works well for cross-device recovery;
- fits the existing Azure infrastructure.

Use a provider abstraction for sending verification messages so SMS or a different email provider could be added later without rewriting identity logic.

For the Azure production stack, prefer Azure Communication Services Email unless a simpler already-provisioned project service exists.

Do not couple core identity logic directly to one provider SDK.

Example interface:

```ts
interface VerificationSender {
  sendPlayerVerificationCode(
    destination: string,
    code: string
  ): Promise<void>;
}
```

---

# Verification-code behavior

Use a short numeric one-time code suitable for manual entry.

Recommended: **6 digits**.

Requirements:

- cryptographically secure generation;
- short expiration, recommended 10 minutes;
- single use;
- server stores only a hash of the code;
- successful verification invalidates the challenge;
- newer challenges for the same destination may invalidate older challenges;
- rate limit sends;
- rate limit verification attempts;
- do not log the raw code in production;
- generic responses should prevent email-address enumeration.

Development/test environments may use an explicitly configured local verification sender, but production must never emit verification codes into public/client logs.

---

# Identity data model

## Player

Evolve the current player record away from owning a single device token.

Conceptually:

```ts
type Player = {
  playerId: string;
  displayName: string;
  normalizedDisplayName: string;
  recoveryEmailKey: string;
  recoveryVerifiedAt: string;
  createdAt: string;
  lastSeenAt: string;
};
```

Do not use the raw email address as a primary key or public identifier.

Normalize email consistently before lookup.

At minimum:

```text
trim
lowercase
```

Do not invent provider-specific normalization such as stripping dots or plus-address suffixes.

---

# Email storage / privacy

Collect the minimum recovery data needed.

Preferred design:

- normalized email;
- keyed hash/HMAC for lookup;
- encrypted email only if persistent storage of the actual destination is required for later messaging.

If every recovery attempt requires the player to enter their email address again, the system does **not** need to retain a plaintext email merely to send recovery mail.

Possible structure:

```ts
recoveryEmailKey = HMAC_SHA256(serverSecret, normalizedEmail)
```

The user enters the destination during recovery:

1. normalize submitted email;
2. derive `recoveryEmailKey`;
3. locate player;
4. send verification code to the submitted email address;
5. after correct code verification, issue a device session.

This allows recovery lookup without retaining raw email in the Player row.

Document the final privacy choice clearly.

Do not expose recovery email information in admin/player APIs unless explicitly necessary.

---

# Player sessions

Move browser credentials into separate session records.

Conceptual model:

```ts
type PlayerSession = {
  sessionId: string;
  playerId: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  userAgentSummary?: string;
};
```

Do not collect device fingerprinting.

A coarse user-agent/device label is optional only if it helps future session management or debugging. Avoid storing unnecessary browser metadata.

Each successful player creation or recovery issues:

```ts
{
  playerId,
  displayName,
  sessionId,
  token
}
```

Only the raw token lives on the client.

Only its cryptographic hash lives server-side.

A recovered desktop session must **not** reuse or reveal the iPhone token.

---

# Client identity format

Introduce a new versioned identity format rather than silently reinterpreting v1.

For example:

```text
emojizzle-player-identity:v2
```

Shape:

```ts
type PlayerIdentity = {
  playerId: string;
  displayName: string;
  sessionId: string;
  token: string;
};
```

Never put the token into:

- URLs;
- share text;
- analytics;
- console logging;
- HTML;
- server error responses;
- admin APIs.

---

# Existing v1 identity migration

The approved rollout resets disposable player data while retaining `PuzzleCatalog`, so no v1 credential migration endpoint is required. The client discards the old v1 local identity and starts the verified create/recover flow.

---

# Existing players without recovery email

No legacy players are retained at rollout. Every player created after the reset verifies a recovery email before the durable player record and name reservation are created.

---

# Orphaned names such as Mark / Mark2 / Mark5

The one-time player-data reset removes these disposable test identities and their name reservations. No merge or duplicate-cleanup feature is required.

---

# Display-name reservation lifecycle

The existing system permanently reserves a display name immediately.

For new recoverable identities, display-name reservation must not create endless abandoned names during email verification.

Preferred lifecycle:

```text
Name checked
    ↓
Temporary claim / verification challenge
    ↓
Email verified
    ↓
Atomic permanent player + name reservation
```

Concurrency must remain safe.

Two users verifying the same normalized name must not both obtain it.

The final permanent reservation remains case-insensitive.

Existing normalization rules should remain unless intentionally changed separately.

---

# Daily cross-device continuation

This feature should make normal Daily play portable across devices.

The server already stores durable play state containing:

- `playerId`;
- `playId`;
- `puzzleId`;
- counts;
- hint count;
- outcome;
- timestamps.

The missing capability is discovery of the canonical attempt when a new device does not know the existing local `playId`.

Add an authenticated lookup such as:

```text
GET /api/plays/current?puzzleId=...&context=daily
```

or integrate equivalent behavior into `/api/plays/start`.

For normal Daily play, there should be **one canonical ranking-eligible attempt per player per Daily puzzle**.

Suggested server behavior:

```text
Player requests today's Daily puzzle
        ↓
Does player already have an attempt?
        ↓ yes
Return canonical existing playId/state
        ↓ no
Create canonical attempt
```

Do not permit a new device to create a fresh ranking-eligible Daily attempt merely because it lacks localStorage.

The server should become authoritative for identifying the player's Daily attempt.

---

# Cross-device state to restore

A second device should restore at least:

- canonical `playId`;
- `guessCount`;
- `hintCount`;
- `outcome`;
- revealed hint content appropriate to `hintCount`;
- resolution if solved/revealed;
- feedback-submitted status if available/appropriate.

Do **not** add storage of incorrect guess text merely to reproduce an exact local screen history.

Example:

A player has:

```text
3 guesses
1 hint
still playing
```

on iPhone.

Opening Emojizzle on desktop should produce:

```text
3 guesses
Hint 1 visible
still playing
```

The desktop need not display the three historical wrong-guess strings.

---

# Practice cross-device behavior

Do not expand this feature unnecessarily.

Daily cross-device continuation is required.

Practice player identity should work across devices because the identity/session layer is shared.

Full synchronization of:

- Practice sequence position;
- Practice cycle;
- all Practice attempts;

may remain device-local unless implementing it falls out naturally and safely from the same server-authoritative mechanism.

Do not allow Practice synchronization complexity to delay the core identity fix.

Document any retained device-local Practice behavior.

---

# Credential failure behavior

The current client may invalidate and erase local player identity when player-authenticated gameplay APIs return `401`.

This behavior must be refined.

A generic unauthorized response should not automatically destroy useful local state without distinguishing why verification failed.

Introduce explicit machine-readable auth failure reasons where appropriate, for example:

```json
{
  "error": "invalid_player_session",
  "code": "PLAYER_SESSION_INVALID"
}
```

Potential distinctions:

```text
PLAYER_SESSION_INVALID
PLAYER_SESSION_EXPIRED
PLAYER_SESSION_REVOKED
PLAYER_NOT_FOUND
```

Client behavior should be deliberate.

If a session truly cannot be used:

- retain enough information to offer recovery of the known display name;
- do not immediately send the user through new-player name creation;
- present a message such as:

> We couldn't verify this device for Mark. Send a code to recover your player.

This directly addresses the observed `Mark5` failure mode.

---

# Identity diagnostics

Add enough structured diagnostics to determine why a recognized browser becomes unrecognized.

Do not log secrets or raw email addresses.

At minimum, server logs should distinguish:

- no credential supplied;
- unknown player;
- unknown session;
- token mismatch;
- revoked session;
- expired session;
- malformed credential;
- storage/API failure.

Client-side identity invalidation should have an explicit reason rather than simply calling a generic `invalidateIdentity()`.

No browser fingerprinting is required.

---

# Proposed API surface

Final names should follow existing project conventions, but the implementation should provide equivalent capabilities.

## New player / verification

```text
POST /api/player-verifications
POST /api/player-verifications/confirm
```

Possible initial request:

```json
{
  "displayName": "Mark",
  "email": "mark@example.com",
  "purpose": "create"
}
```

Recovery request:

```json
{
  "email": "mark@example.com",
  "purpose": "recover"
}
```

Confirmation:

```json
{
  "challengeId": "...",
  "code": "123456"
}
```

Successful create/recovery returns a new device session identity.

## Daily attempt lookup/start

Either:

```text
GET /api/plays/current
POST /api/plays/start
```

or refactor `/api/plays/start` so it can locate/create the player's canonical Daily attempt without requiring a locally known `playId`.

Prefer the smallest coherent API design.

---

# Verification challenge storage

Add dedicated storage for temporary verification state.

Possible Azure Table:

```text
PlayerVerification
```

Conceptual row:

```ts
{
  challengeId;
  purpose;
  emailKey;
  proposedDisplayName?;
  normalizedDisplayName?;
  codeHash;
  createdAt;
  expiresAt;
  attemptCount;
  consumedAt?;
}
```

Do not persist raw verification codes.

Expired challenge cleanup does not need sophisticated infrastructure for MVP; reads must enforce expiration even if old rows remain until later maintenance.

---

# Rate limiting / abuse controls

Email verification creates a new externally billable/abusable operation.

At minimum protect against:

- repeated sends to one email;
- repeated sends from one client/IP window if available through infrastructure;
- brute-force code entry;
- unlimited simultaneous challenges.

Do not introduce invasive user tracking.

Reasonable MVP controls might include:

```text
1 send / 60 seconds per email key
5 sends / hour per email key
5–10 code attempts per challenge
10-minute code expiration
```

Exact thresholds may be adjusted during implementation.

Return neutral messages that do not disclose whether an email is registered.

---

# Security requirements

- Server remains authoritative for identity.
- Raw session tokens are stored only by clients.
- Store only cryptographic token hashes server-side.
- Raw OTP codes are never persisted.
- Use cryptographically secure random generation.
- Verification challenges expire.
- Verification challenges are single use.
- Email lookup must not permit account enumeration.
- Recovery must issue a new session rather than expose an existing token.
- Existing device sessions should continue functioning after another device recovers the player.
- Never expose session tokens through admin endpoints.
- Preserve existing origin protections.
- Preserve existing admin authentication.
- Preserve accepted-answer secrecy.
- Do not weaken current deterministic gameplay protections.

---

# Session expiration

Avoid forcing frequent reauthentication in a casual Daily game.

Sessions should be intentionally long-lived.

Reasonable MVP choices:

- no fixed expiration, revocable;
- or approximately one year with sliding `lastSeenAt`.

Choose the smallest secure model consistent with current infrastructure.

The normal player should not periodically enter email codes merely because time elapsed.

---

# Start Over semantics

Review `/startover`.

Today it clears browser storage.

After this feature:

**Start Over on this device must not delete the server player.**

It may:

- clear local puzzle state;
- clear this device's session;
- optionally revoke this session server-side.

It must not:

- delete the Player;
- release the display name automatically;
- remove recovery information;
- revoke every other device.

UX should make the distinction clear.

---

# Admin / support considerations

At minimum allow an administrator to answer:

- Which player owns this display name?
- Does the player have verified recovery enabled?
- How many active device sessions exist?
- When was the player last seen?

Do not expose session tokens, token hashes, OTP data, or full recovery secrets.

A complete public-facing account-management dashboard is explicitly out of scope.

---

# Infrastructure

Use the current Azure production architecture.

Add only resources necessary for verification email and identity storage.

Prefer:

- existing Azure Table Storage for Player/Session/Verification records;
- Azure Communication Services Email for production OTP delivery;
- environment/configuration secrets through existing deployment patterns;
- Bicep updates for required Azure resources/configuration.

Do not introduce a separate identity database or general authentication platform unless implementation investigation demonstrates a compelling reason.

This feature is small enough to remain within the project's current Azure Functions + Table Storage design.

---

# Documentation changes

This feature intentionally changes existing product invariants.

Update:

- `AGENTS.md`
- `GOALS.md`
- `PLAN.md`
- `docs/FEEDBACK_STRATEGY.md` if identity wording is affected
- `docs/OPERATING_GUIDE.md`
- the existing player identity feature documentation where useful

Replace statements that say:

> Cross-device recovery does not exist.

with the new invariant:

> Emojizzle requires no password or conventional account. A player has a persistent, recoverable named identity. Email verification allows the player to recover that identity or establish another device. Each browser/device receives its own opaque session credential.

Also document that normal Daily play is server-resumable across devices.

---

# Explicit non-goals

Do not implement in this branch:

- passwords;
- Google login;
- Apple login;
- Facebook/social login;
- SMS verification;
- phone-number storage;
- public player profiles;
- avatars;
- friends/follows;
- social graph;
- leaderboards;
- ranking formulas;
- player rename UI;
- player deletion UI;
- generalized account settings;
- marketing email;
- newsletters;
- email notifications unrelated to identity;
- arbitrary collection of PII;
- browser/device fingerprinting;
- syncing historical incorrect guess text;
- generalized telemetry infrastructure.

---

# Migration compatibility

The rollout deliberately resets `PlayerDirectory`, `PuzzlePlays`, `PuzzleFeedback`, and `PlayerVerifications`. `PuzzleCatalog` is retained. The reset is an explicit operator command and is never part of recurring deployment.

---

# Suggested implementation sequence

1. Re-read current repository guidance and identity/play implementation before editing.
2. Add an architecture note/tests for the distinction: `Player != PlayerSession`.
3. Add PlayerSession storage and credential verification.
4. Update authenticated gameplay endpoints to accept v2 sessions.
6. Add verification-challenge model/storage.
7. Add email sender abstraction and test/local implementation.
8. Add Azure Communication Services Email production integration and infrastructure/configuration.
9. Implement new-player email verification without permanently consuming abandoned names.
10. Implement “I already play Emojizzle” recovery flow.
11. Change credential-invalid handling so invalid session does not immediately become “choose another player name.”
12. Make Daily attempts canonical per `playerId + Daily puzzle`.
13. Implement Daily cross-device resume.
14. Add the explicit player-data reset command.
15. Update `/startover` semantics.
16. Update repository documentation.
17. Run all tests/build/lint and production-oriented smoke tests.

---

# Required automated tests

Add focused coverage for at least:

## Identity/session

- create PlayerSession;
- valid token verification;
- invalid token rejection;
- session belongs to correct player;
- multiple sessions may coexist for one player;
- invalidating one session does not invalidate another;
- existing player ID remains unchanged.

## Verification

- secure challenge creation;
- code hashes rather than raw codes are stored;
- valid code succeeds;
- wrong code fails;
- expired code fails;
- consumed code cannot be reused;
- rate-limit behavior;
- neutral recovery response does not enumerate registered emails.

## Name reservation

- abandoned verification does not permanently consume name;
- final claim is atomic;
- case-insensitive uniqueness remains enforced;
- two concurrent verified claims cannot both win.

## Recovery

- verified recovery produces same `playerId`;
- recovery produces a new session token;
- existing session remains valid;
- unknown/unregistered email does not leak existence information.

## Daily play

- first device creates canonical Daily attempt;
- second device receives same `playId`;
- existing guess count restores;
- existing hint count restores;
- appropriate hints restore;
- solved/revealed outcome restores;
- second device cannot obtain a fresh ranking-eligible Daily attempt for the same player/puzzle;
- retry/idempotency behavior remains correct.

## Compatibility

- Practice remains ranking-ineligible;
- existing answer secrecy tests still pass.

---

# Manual smoke-test matrix

## New user

1. Fresh browser.
2. Choose `TestPlayer`.
3. Enter email.
4. Receive code.
5. Enter wrong code once.
6. Enter valid code.
7. Confirm player creation.
8. Play Daily.
9. Reload.
10. Confirm no verification prompt.

## Cross-device

1. Start Daily on mobile.
2. Make two wrong guesses.
3. Reveal one hint.
4. Open desktop with no local identity.
5. Choose “I already play Emojizzle.”
6. Enter same email.
7. Verify code.
8. Confirm same display name.
9. Confirm two guesses and one hint are represented.
10. Continue and solve.
11. Return to mobile.
12. Confirm solved state is reflected after reload/resume.

## Identity loss

1. Clear browser site data.
2. Reopen Emojizzle.
3. Recover via email.
4. Confirm original player name returns.
5. Confirm user is not told that the name is unavailable and forced to create `Name2`.

## Session failure

1. Corrupt/revoke local session credential.
2. Reopen/play.
3. Confirm UX offers recovery for known player rather than immediately erasing identity and forcing another name.

## Start Over

1. Use a player with two device sessions.
2. Start over on device A.
3. Confirm device B remains authenticated.
4. Confirm Player record still exists.
5. Confirm original display name remains reserved to that player.

---

# Acceptance criteria

The feature is complete when:

- A new globally reserved player identity is recoverable.
- New players verify an email without creating a password.
- Losing localStorage no longer means permanently losing the player name.
- A recovered player receives the same immutable `playerId`.
- Multiple devices may simultaneously represent the same player.
- Every device uses an independent token/session.
- Daily play begun on one device resumes on another.
- A second device cannot create a second ranking-eligible Daily attempt for the same player/puzzle.
- New puzzle play and feedback data remain correctly attributed across sessions.
- Invalid device credentials lead toward recovery rather than duplicate-name creation.
- The cause of credential failures is diagnosable without logging secrets.
- Verification email is rate limited and resistant to address enumeration.
- Start Over affects the current device, not the durable player.
- No password system, social login, profile system, leaderboard, or SMS dependency has been introduced.
- Existing gameplay, answer secrecy, admin auth, feedback, Practice mode, and sharing continue to work.

---

# Required repository verification

Run the repository-required checks:

```bash
npm run build
npm run lint
npm test
```

Also run API-specific tests/build if not included by the root commands.

Inspect the final static export and API responses for accidental exposure of:

- session tokens;
- session token hashes;
- raw email addresses where unnecessary;
- OTP codes;
- OTP hashes;
- accepted puzzle answers;
- Azure credentials.

---

# Codex completion instructions

Implement this feature as the smallest coherent evolution of the existing identity design.

Do not replace the current architecture with a generalized authentication framework unless an unavoidable technical constraint is discovered and clearly documented.

Preserve existing player IDs and existing attributable data.

Before finishing:

1. inspect the complete diff;
2. run all required tests/build/lint;
3. manually exercise new-player, recovery, cross-device, legacy migration, and Start Over flows;
4. update all affected documentation;
5. commit all implementation changes to this feature branch;
6. report:
   - final commit SHA;
   - tests executed and results;
   - Azure resources/configuration added;
   - required deployment steps;
   - migration/compatibility behavior;
   - any deliberate deviations from this plan;
   - any unresolved security or operational concerns.

The central product requirement is:

> A player should be able to choose `Mark` once, keep `Mark`, and continue playing as `Mark` on any device without ever needing a password.
