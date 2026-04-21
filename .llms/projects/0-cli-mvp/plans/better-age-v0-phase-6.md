# Plan: Better Secrets V0 Phase 6

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`
> - current implemented state in `packages/cli/src`

## Goal

Deliver explicit payload maintenance:
- `update <path>`
- interactive prompt-into-update for:
  - `read`
  - `edit`
  - `grant`
  - `revoke`

Scope:
- reusable update-state computation
- explicit `update` app + CLI
- self recipient refresh by current local active key
- schema migration seam, even if v0 only has version `1`
- interactive preflight prompt before continuing target command
- same-process passphrase reuse for `update -> continue`

Do **not** implement yet:
- payload rewrite on `inspect`
- non-self recipient refresh from home state
- rotate command
- change-passphrase command
- any global payload crawl/index

## Why this scope

Current state already has:
- `create`
- `inspect`
- `read`
- `edit`
- `grant`
- `revoke`
- shared `OpenPayload`
- shared `RewritePayloadEnvelope`
- typed `...UpdateRequiredError` flows

What is missing for honest v0 UX:
- a real `update` command behind those remediation messages
- the interactive low-friction path promised by spec

Without this phase:
- interactive commands stop at remediation only
- stale-self payloads are visible but not fixable in-flow
- read/edit/share UX is still rough for the lazy-user target

## Durable decisions for phase 6

- `update` is the only explicit maintenance command in v0
- `update` may rewrite only:
  - payload schema version
  - duplicate self snapshots normalization
  - stale self snapshot -> current local self snapshot
- `update` must **not** rewrite non-self recipients
- payload authority still wins for non-self recipient list
- interactive commands may prompt into `update`
- non-interactive commands must never auto-run `update`
- `inspect` reports `needs update` only; it never mutates
- prompt/output stays at CLI edge, not app/domain
- passphrase prompt happens once per CLI invocation and is reused inside chained flow

Warning:
- do not let every command implement its own mini-update branch
- phase 6 should centralize update mutation once, then reuse it

## Required design correction before implementation

Confidence 98%:
- current apps duplicate a small but growing pattern:
  - open payload
  - check `needsUpdate`
  - either fail or proceed
- phase 6 needs one reusable preflight seam, else `read`/`edit`/`grant`/`revoke` each grow bespoke prompt/update chaining

Recommended new shared app helper:
- `src/app/shared/EnsurePayloadReady.ts`

Responsibilities:
- receive:
  - `path`
  - `passphrase`
  - `interactive: boolean`
  - `forceUpdate?: boolean`
- open payload once
- if no update needed:
  - return opened payload + same state + same passphrase
- if update needed and non-interactive:
  - fail typed `...UpdateRequiredError`
- if update needed and interactive:
  - ask caller-supplied callback / option whether to run update now
  - if accepted:
    - run `UpdatePayload`
    - reopen payload
    - return fresh opened payload

Do **not** put in this helper:
- stdout/stderr wording
- prompt rendering
- command-specific success output

Why:
- keeps policy shared
- keeps CLI control of UX
- avoids reopening/prompting logic divergence

## DDD module split

### Domain

Add pure update modules under `src/domain/payload/`:
- `PayloadUpdateState.ts`
- maybe `PayloadUpdatePlan.ts`

Responsibilities:
- compute whether payload needs update
- compute exact self-only rewrite plan
- normalize duplicate self-recipient snapshots deterministically

Recommended pure types:
- `PayloadUpdateReason`
  - `self-stale`
  - `schema-outdated`
  - `duplicate-self-recipient`
- `PayloadUpdateState`
  - `isRequired: boolean`
  - `reasons: NonEmptyArray<PayloadUpdateReason> | []`
- `PayloadUpdatePlan`
  - `unchanged`
  - `rewrite`

Recommended pure helpers:
- `computePayloadUpdateState(...)`
- `planPayloadUpdate(...)`

Rules to encode in domain:
- only self `ownerId` is mutable in v0 update
- if payload contains current self snapshot already and no schema drift:
  - unchanged
- if self exists but fingerprint/public key stale:
  - replace self snapshot with current local self snapshot
- if duplicate self snapshots:
  - keep current local self snapshot if present
  - else keep newest by `identityUpdatedAt`
  - equal timestamp + differing content => treat as invalid/corrupt later only if real case appears; for v0 assume upstream invariant and add defensive typed failure if needed
- non-self duplicates or staleness do not trigger rewrite in v0

Important:
- reuse same semantics as spec `needs update`
- stop recomputing update state ad hoc in `InspectPayload` / `ReadPayload`

### App

Add:
- `src/app/update-payload/UpdatePayload.ts`
- `src/app/update-payload/UpdatePayloadError.ts`
- `src/app/shared/EnsurePayloadReady.ts`
- `src/app/shared/EnsurePayloadReadyError.ts`

`UpdatePayload` responsibilities:
- open payload via `OpenPayload`
- fail if no self identity in home state
- compute update plan
- if unchanged:
  - return explicit unchanged success
- if rewrite:
  - rebuild envelope:
    - same `payloadId`
    - same `createdAt`
    - same `envText`
    - same non-self recipients
    - refreshed self recipient set
    - bumped `lastRewrittenAt`
    - schema version current
  - write via `RewritePayloadEnvelope`
  - return explicit updated success with reasons

Recommended result variants:
- `UpdatePayloadUnchangedSuccess`
- `UpdatePayloadUpdatedSuccess`

Recommended typed errors:
- `UpdatePayloadPersistenceError`
- `UpdatePayloadCryptoError`
- `UpdatePayloadEnvError`
- `UpdatePayloadNoSelfIdentityError`
- optional `UpdatePayloadConflictError` if duplicate-self conflict needs explicit stop

`EnsurePayloadReady` responsibilities:
- central orchestration for commands that need ready payload before acting
- run `UpdatePayload` only when interactive caller opted in
- reopen payload after update
- preserve single-process passphrase reuse

Important:
- `InspectPayload` stays direct/open-only
- `ReadPayload`, `EditPayload`, `GrantPayloadRecipient`, `RevokePayloadRecipient` should consume `EnsurePayloadReady` or equivalent preflight seam, not roll their own

### Ports

No new global infra port required.

Reuse:
- `Prompt`
- `HomeRepository`
- `PayloadRepository`
- `PayloadCrypto`

Optional small interface only if needed:
- app-local callback/enum for update consent

Avoid:
- introducing a process-global passphrase cache service for v0
- keep passphrase as explicit value flowing through apps

### CLI

Add:
- `src/cli/command/updatePayloadCommand.ts`
- `src/cli/command/updatePayloadCommand.test.ts`

Refactor existing commands:
- `readPayloadCommand.ts`
- `editPayloadCommand.ts`
- `grantPayloadCommand.ts`
- `revokePayloadCommand.ts`

CLI responsibilities:
- `update <path>`
  - prompt passphrase
  - call `UpdatePayload`
  - print concise result:
    - updated with reasons
    - already up to date
- interactive preflight:
  - when app says update required, prompt:
    - `Payload needs update before continuing. Update now? [Y/n]`
  - default yes
  - if yes:
    - run update in same process
    - continue original command
  - if no:
    - print remediation
    - stop non-zero

Non-interactive behavior:
- `read` keeps current behavior:
  - fail with exact remediation
- `edit` / `grant` / `revoke` with all args supplied but TTY available:
  - still interactive per product rule, so prompt allowed
- if prompt truly unavailable:
  - fail with remediation

Implementation note:
- do not pre-open payload twice in CLI then app again if avoidable
- either:
  - push preflight into shared app helper
  - or return reopened payload context from preflight

## Tracer bullets

### 1. Pure update-state domain

Build first:
- `computePayloadUpdateState(...)`
- `planPayloadUpdate(...)`

Test first:
- no update when self current and schema current
- update when self fingerprint/public key stale
- update when duplicate self recipient exists
- no update for non-self stale snapshot
- no update for non-self duplicate alone

Acceptance:
- pure tests only
- no IO
- `InspectPayload` can later consume same result

### 2. `UpdatePayload` app

Build:
- explicit update use case using `OpenPayload` + `RewritePayloadEnvelope`

Test first:
- unchanged path returns unchanged result, no write
- stale self path rewrites once
- duplicate self path normalizes once
- rewritten envelope preserves env + non-self recipients + payload id
- missing local self fails typed error

Acceptance:
- no CLI yet
- fake repo/crypto tests green

### 3. `update` CLI

Build:
- root command wiring
- passphrase prompt
- success/no-op rendering
- typed error rendering

Test first:
- explicit `update` success
- explicit `update` unchanged
- explicit `update` missing self / persistence / crypto failures

Acceptance:
- user can manually run `bage update <path>`

### 4. Shared preflight seam

Build:
- `EnsurePayloadReady`
- migrate `ReadPayload` first to prove seam

Test first:
- interactive + update needed + yes => update then continue
- interactive + update needed + no => fail remediation path
- non-interactive + update needed => fail without mutation
- already-ready payload => no extra write

Acceptance:
- passphrase reused in one invocation
- no duplicate prompt when chaining

### 5. Migrate `edit`

Build:
- `EditPayload` uses shared preflight before editor open

Test first:
- stale payload + accepted update => opens editor on fresh payload
- stale payload + declined update => no editor launch
- ready payload => unchanged current behavior

Acceptance:
- no hidden self-refresh outside update path

### 6. Migrate `grant` + `revoke`

Build:
- swap current hard-stop update-required path for interactive preflight route

Test first:
- stale payload + accepted update => command continues and mutates recipient
- stale payload + declined update => command aborts cleanly
- prompt-unavailable path => remediation only

Acceptance:
- no logic regression in existing recipient mutation tests

## Concrete implementation details

### Reuse existing seams

Use current modules as anchors:
- `OpenPayload`
- `RewritePayloadEnvelope`
- `PayloadNeedsUpdate`
- `InspectPayload`
- `ReadPayload`
- `EditPayload`
- `GrantPayloadRecipient`
- `RevokePayloadRecipient`

Do not add another parallel notion of update state. Replace old ad hoc checks with the new pure domain helper.

### Keep `InspectPayload` read-only

Do:
- switch it to consume `computePayloadUpdateState(...)`
- keep output line:
  - `needs update: no`
  - `needs update: yes (...)`

Do not:
- route `inspect` into update prompt
- mutate payload from inspect

### Error taxonomy

Keep errors explicit and narrow:
- app-level typed update error for direct `UpdatePayload`
- preflight typed “declined” / “prompt unavailable” / “needs update non-interactive” only if needed
- prefer composition over giant error union names in CLI

### Message contract

Keep wording concise, remediation-first.

Recommended direct `update` outputs:
- success:
  - `updated ./.env.enc`
- unchanged:
  - `payload already up to date: ./.env.enc`

Recommended prompt path:
- prompt:
  - `Payload needs update before continuing. Update now? [Y/n]`
- decline:
  - `Run: bage update <path>`

### Passphrase handling

Do:
- prompt once in CLI
- pass plaintext passphrase string through app chain for current process only

Do not:
- add daemon cache
- write passphrase anywhere

## Test strategy

### Unit

Add pure domain tests for:
- update-state computation
- update-plan normalization

### App

Add fake-adapter tests for:
- `UpdatePayload`
- `EnsurePayloadReady`

### CLI

Add CLI tests for:
- `update`
- prompt-into-update for `read`
- prompt-into-update for `edit`
- prompt-into-update for `grant`
- prompt-into-update for `revoke`

### Regression

Re-run existing suites affected by migrated apps:
- `InspectPayload`
- `ReadPayload`
- `EditPayload`
- `GrantPayloadRecipient`
- `RevokePayloadRecipient`
- command tests for each

End gate:
- `pnpm --dir packages/cli check`

## Suggested commit sequence

1. pure payload update-state domain + tests
2. `UpdatePayload` app + tests
3. `update` CLI + wiring + tests
4. `EnsurePayloadReady` shared app + tests
5. migrate `read` to shared preflight + tests
6. migrate `edit` to shared preflight + tests
7. migrate `grant`/`revoke` to shared preflight + tests
8. final cleanup: reuse update-state in `InspectPayload`, docs/comments, regression gate

## Acceptance criteria

- [ ] `bage update <path>` exists and works.
- [ ] `update` rewrites only schema/self-recipient concerns in v0.
- [ ] `inspect` reports update state using shared update-state logic.
- [ ] Interactive `read`/`edit`/`grant`/`revoke` can prompt into `update`.
- [ ] Declining update aborts safely with remediation.
- [ ] Non-interactive flows never auto-mutate.
- [ ] Non-self recipient snapshots stay untouched by `update`.
- [ ] Package gate stays green.

## Risks to avoid

- smuggling phase-7 rotate logic into update
- refreshing non-self recipients from home state
- adding a hidden process/global state cache for passphrase
- duplicating preflight logic per command
- letting `inspect` mutate

## Unresolved questions

- none
