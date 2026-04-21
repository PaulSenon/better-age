# Plan: Better Secrets V0 Phase 5

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`
> - current implemented state in `packages/cli/src`

## Goal

Deliver explicit recipient mutation:
- `grant <path> [identity-ref]`
- `revoke <path> [identity-ref]`

Phase 5 should make payload sharing usable for v0 without yet solving:
- explicit `update`
- rotate-driven self refresh prompts
- bulk recipient ops

Scope:
- identity-ref resolution for payload mutations
- grant upsert by `ownerId`
- revoke by `ownerId`
- self-revoke guard
- interactive selection for missing identity arg
- inline pasted Identity String during interactive `grant`
- payload rewrite with updated recipients

Do **not** implement yet:
- `update`
- prompt-into-update flow
- multi-recipient grant/revoke
- alias management command
- non-self auto-upgrade from home state

## Why this scope

Current state already has:
- payload create
- inspect
- read
- edit
- shared `OpenPayload`
- real payload crypto + write path

What is still missing for a usable v0:
- sharing access with another identity
- removing access safely

This phase should deepen the payload access-control core, not just add CLI glue.
`grant` and `revoke` are the first commands that mutate recipient lists directly. If implemented shallowly, phase 6 `update` will later fight with them.

## Durable decisions for phase 5

- recipient mutation is always one identity per command
- `grant` is upsert by `ownerId`
- `revoke` is remove by `ownerId`
- self revoke is forbidden
- payload recipient snapshots remain payload authority
- local alias remains home-local overlay only
- local home state may learn from payload recipients before mutation
- local home state must **never** auto-upgrade non-self payload recipients
- if payload `needsUpdate`, `grant` and `revoke` must fail with typed update-required error for now

Warning:
- letting `grant`/`revoke` rewrite a stale-self payload in phase 5 would partially implement `update` implicitly
- do **not** refresh self recipient in this phase

## Required design correction before implementation

Confidence 98%:
- current code has `OpenPayload` for read-only/open orchestration and `EditPayload` for env rewrite
- phase 5 needs one shared recipient-write seam, else `grant`, `revoke`, and later `update` will each duplicate:
  - open payload
  - validate preflight
  - rebuild recipient list
  - encrypt envelope
  - write file

Recommended internal module:
- `src/app/shared/RewritePayloadEnvelope.ts`

Responsibilities:
- accept already-opened payload context
- accept next envelope
- encrypt with recipient public keys from `nextEnvelope.recipients`
- serialize payload file
- write payload file

Do **not** put into this helper:
- identity resolution
- alias prompts
- stdout/stderr rendering
- interactive picker logic
- update prompting

Why:
- `grant`, `revoke`, and phase-6 `update` will all need this exact write path
- keeps use cases focused on mutation rules, not file mechanics

## DDD module split

### Domain

Add pure recipient/access-control modules under `src/domain/payload/` and `src/domain/identity/`:
- `ResolveIdentityRef.ts`
- `PayloadRecipients.ts`
- maybe `PayloadRecipientMutation.ts`

Responsibilities:
- compare candidate identities by:
  - local alias
  - handle
  - unique display name
  - full Identity String
- express ambiguity explicitly
- compute grant/revoke mutation outcomes without IO

Recommended domain types:
- `IdentityRefResolution`
  - `resolved`
  - `ambiguous`
  - `not-found`
- `GrantRecipientDecision`
  - `add`
  - `replace-older`
  - `no-change-identical`
  - `no-change-outdated-input`
- `RevokeRecipientDecision`
  - `remove`
  - `no-change-absent`
  - `forbidden-self`

Recommended pure helpers:
- `resolveKnownIdentityRef(...)`
- `resolvePayloadRecipientRef(...)`
- `decideGrantRecipient(...)`
- `decideRevokeRecipient(...)`

Rules to encode in domain, not CLI:
- display-name ambiguity never auto-resolves
- `grant` compares freshness by `identityUpdatedAt`
- `revoke` matches by `ownerId`, not fingerprint
- self-revoke forbidden

Do **not** bake prompt UX into these helpers.

### App

Add:
- `src/app/shared/RewritePayloadEnvelope.ts`
- `src/app/grant-payload-recipient/GrantPayloadRecipient.ts`
- `src/app/grant-payload-recipient/GrantPayloadRecipientError.ts`
- `src/app/revoke-payload-recipient/RevokePayloadRecipient.ts`
- `src/app/revoke-payload-recipient/RevokePayloadRecipientError.ts`

`RewritePayloadEnvelope` responsibilities:
- encrypt final envelope
- serialize payload file
- write file

`GrantPayloadRecipient` responsibilities:
- open payload via `OpenPayload`
- fail with typed update-required if payload needs update
- import/refresh known identities from payload as normal via `OpenPayload`
- resolve target identity:
  - explicit arg path
  - app-level interactive selection input already resolved by CLI
- compute grant decision by `ownerId`
- if add/replace:
  - rebuild recipient list
  - rewrite payload
- if no-op:
  - return explicit no-op result variant

`RevokePayloadRecipient` responsibilities:
- open payload via `OpenPayload`
- fail with typed update-required if payload needs update
- resolve target against payload recipients
- compute revoke decision by `ownerId`
- forbid self revoke
- if remove:
  - rebuild recipient list
  - rewrite payload
- if absent:
  - return explicit no-op result

Recommended result variants:
- `GrantPayloadRecipientAddedSuccess`
- `GrantPayloadRecipientUpdatedSuccess`
- `GrantPayloadRecipientUnchangedSuccess`
- `RevokePayloadRecipientRemovedSuccess`
- `RevokePayloadRecipientUnchangedSuccess`

Recommended typed errors:
- `...UpdateRequiredError`
- `...AmbiguousIdentityError`
- `...IdentityNotFoundError`
- `...PersistenceError`
- `...CryptoError`

Important:
- keep app layer free of prompt/editor concerns
- app takes already-resolved target identity data or payload-recipient target identity data

### Ports

No major new infra port should be needed.

Reuse:
- `Prompt`
- `PayloadCrypto`
- `PayloadRepository`
- `HomeRepository`

Optional small new app-local helper only if needed:
- no new global port unless a real reuse seam appears

### CLI

Add:
- `src/cli/command/grantPayloadCommand.ts`
- `src/cli/command/grantPayloadCommand.test.ts`
- `src/cli/command/revokePayloadCommand.ts`
- `src/cli/command/revokePayloadCommand.test.ts`
- maybe `src/cli/shared/identitySelection.ts`

CLI responsibilities:
- parse `path`
- optional identity arg
- prompt for passphrase
- interactive selection when identity arg missing
- render ambiguity and selection choices
- optionally import pasted Identity String in grant flow
- optionally suggest alias after ambiguity/import collision
- print concise outcome

Recommended interactive `grant` flow:
1. open payload passphrase path only once
2. if identity arg exists:
   - pass through resolver path
3. if identity arg missing in TTY:
   - show known identities
   - extra choice: `Paste shared identity string`
   - if pasted:
     - call existing `ImportIdentityString`
     - if display-name collision, suggest optional alias
     - continue using imported identity
4. call grant app

Recommended interactive `revoke` flow:
1. open payload passphrase path only once
2. if identity arg exists:
   - resolve against payload recipients first
   - allow local alias as convenience only if resulting `ownerId` exists in payload
3. if identity arg missing in TTY:
   - show payload recipients only
4. call revoke app

Important CLI behavior:
- non-interactive mode must not prompt
- non-interactive ambiguous refs fail with explicit candidate handles
- missing identity arg in non-interactive mode fails
- update-required error prints remediation:
  - `Run: bage update <path>`

## Tracer-bullet TDD order

### Slice A: recipient mutation domain

Goal:
- prove grant/revoke decisions independent of IO

First red tests:
- grant adds when owner absent
- grant replaces when same owner older snapshot exists
- grant no-ops identical snapshot
- grant no-ops outdated input against newer payload recipient
- revoke removes by `ownerId`
- revoke self target forbidden
- revoke absent owner => no change

Acceptance:
- pure domain tests green

### Slice B: identity-ref resolution domain

Goal:
- prove exact resolution and ambiguity rules

First red tests:
- resolve exact local alias
- resolve exact handle
- resolve unique display name
- ambiguous display name returns candidate handles
- full Identity String resolves directly
- revoke payload-recipient resolver only succeeds when owner actually present in payload

Implementation details:
- split known-identity resolver from payload-recipient resolver
- keep full Identity String support first-class

Acceptance:
- pure resolution tests green

### Slice C: shared payload rewrite helper

Goal:
- deepen shared mutation seam before grant/revoke apps

First red tests:
- rewrites payload using recipient public keys from next envelope
- preserves outer payload file format
- maps payload write/encrypt errors to typed errors

Acceptance:
- rewrite helper tests green

### Slice D: `GrantPayloadRecipient` app

Goal:
- mutate recipients through final app boundary

First red tests:
- add new recipient
- update older recipient snapshot
- identical snapshot => unchanged
- outdated provided snapshot => unchanged warning result
- payload `needsUpdate` => typed update-required error

Implementation details:
- use `OpenPayload`
- use pure resolution + pure decision helpers
- use `RewritePayloadEnvelope`
- preserve:
  - `payloadId`
  - `createdAt`
  - env text
- update only:
  - recipients
  - `lastRewrittenAt`

Acceptance:
- app tests green

### Slice E: `RevokePayloadRecipient` app

Goal:
- remove recipients safely

First red tests:
- remove matching owner
- absent owner => unchanged
- self revoke => forbidden
- payload `needsUpdate` => typed update-required error

Implementation details:
- use payload-recipient-authoritative resolver
- preserve everything except recipient list + `lastRewrittenAt`

Acceptance:
- app tests green

### Slice F: `grant` CLI

Goal:
- prove real user flow for adding/updating recipients

First red tests:
- `grant <path> <handle>` succeeds
- missing identity arg in TTY lets user select known identity
- missing identity arg in TTY allows paste Identity String
- ambiguous display name prints candidates / selection path
- update-required prints remediation
- unchanged outdated-input path prints clear warning

Implementation details:
- prompt for passphrase once
- do not reopen payload multiple times in same command unless required by current app shape
- if using imported pasted Identity String, reuse existing `ImportIdentityString` app instead of reimplementing parser logic

Acceptance:
- CLI tests green

### Slice G: `revoke` CLI

Goal:
- prove real user flow for revocation

First red tests:
- `revoke <path> <handle>` succeeds
- missing identity arg in TTY lets user pick payload recipient
- self revoke prints clear failure
- absent recipient prints concise no-op
- ambiguous display name fails with candidate handles in non-interactive mode

Acceptance:
- CLI tests green

### Slice H: live wiring + regression gate

Goal:
- register commands and ensure no regressions

Acceptance:
- root CLI includes `grant` and `revoke`
- package `check` green
- create/read/edit/inspect regressions green

## Implementation details by layer

### 1. Reuse `OpenPayload`, do not fork it

`grant` and `revoke` should reuse existing payload-open behavior:
- load/decrypt
- learn recipient identities into home state
- compute `needsUpdate`

Do not build custom open logic in either app.

### 2. Add one deep resolver, not ad-hoc string matching in CLI

Bad:
- CLI manually loops aliases
- app manually loops handles
- revoke special-cases display names separately

Good:
- one resolver module returns structured resolution outcomes
- CLI only renders/picks
- app only consumes resolved target or structured not-found/ambiguous result

### 3. Grant must preserve payload authority

Grant rules:
- compare against payload recipient snapshot currently in file
- never auto-refresh external recipients from newer home known identity unless user explicitly grants that identity
- when user pastes new Identity String, that explicit identity is allowed to refresh payload recipient snapshot

### 4. Revoke must be payload-recipient-authoritative

Revoke should not silently use home known identities as truth.
Allowed:
- local alias resolves to owner id
- revoke proceeds only if payload currently grants that owner id

### 5. Alias suggestion stays optional

Phase 5 should only support:
- optional alias suggestion after ambiguity/import collision

Do not add:
- rename alias
- remove alias
- `alias` command

### 6. Update seam must stay explicit

`grant`/`revoke` should return typed update-required when:
- self recipient is stale
- later schema-driven update condition appears

Phase 6 can then layer prompt-into-update cleanly without deleting mutation logic.

## Suggested commit sequence

1. `domain: add recipient mutation and identity-ref resolution helpers`
2. `app: add shared payload rewrite helper`
3. `app: add grant payload recipient use case`
4. `app: add revoke payload recipient use case`
5. `cli: add grant command with interactive selection and paste flow`
6. `cli: add revoke command with payload-recipient selection`
7. `wire: register commands and run regression gate`

## Acceptance criteria

- [ ] `grant` adds a new recipient when owner is absent.
- [ ] `grant` refreshes an existing recipient when provided snapshot is newer than payload snapshot.
- [ ] `grant` no-ops when identical snapshot already granted.
- [ ] `grant` no-ops with warning when provided snapshot is older than payload snapshot.
- [ ] `grant` interactive flow supports known-identity selection and pasted Identity String.
- [ ] `revoke` removes recipient by `ownerId` regardless of snapshot age.
- [ ] `revoke` self-target is rejected.
- [ ] `revoke` absent recipient returns concise no-op.
- [ ] ambiguous display names never auto-resolve.
- [ ] payload/home learning boundary remains intact.
- [ ] payload `needsUpdate` blocks grant/revoke with explicit remediation.
- [ ] package `check` is green at end of phase.

## Risks and pitfalls

- duplicating string-matching logic across app and CLI
- accidentally rewriting stale-self payloads and thereby leaking phase-6 `update` into phase 5
- trusting home known identities more than payload on revoke
- leaking local alias into payload recipient entries
- performing multiple passphrase prompts in one command
- mutating payload even when result should be no-op

## Current done / remain

Done already before phase 5:
- setup / me / add-identity / identities
- create / inspect / read / edit
- shared `OpenPayload`
- env validation + editor/tempfile boundaries

Remain after phase 5:
- explicit `update`
- rotate
- change-passphrase
- phase-6 prompt-into-update integration

## Unresolved questions

- none
