# Plan: Better Secrets V0 Phase 4

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`
> - current implemented state in `packages/cli/src`

## Goal

Deliver human-safe payload editing:
- `edit <path>`

Phase 4 should make payloads practically usable day-to-day without yet solving:
- explicit `update`
- recipient mutation

Scope:
- editor-based plaintext `.env` editing
- env validation / duplicate-key rejection
- unchanged-edit no-op
- changed-edit payload rewrite with same recipient list
- no-editor remediation

Do **not** implement yet:
- `grant`
- `revoke`
- `update`
- interactive update prompt flow

## Why this scope

Current state already has:
- payload create
- payload inspect
- payload read
- real payload crypto
- read preflight contract

The next narrow end-to-end value is:
- edit secrets safely in a familiar `.env` buffer

But phase 4 must avoid spreading payload-open logic across three apps.
`InspectPayload`, `ReadPayload`, and future `EditPayload` all need the same core:
- load home state
- read payload file
- read encrypted local private keys
- decrypt envelope
- import recipient snapshots into known identities
- compute `needsUpdate`

So phase 4 should first deepen that shared path, then build `edit` on top.

## Durable decisions for phase 4

- editor buffer contains plaintext `.env` only
- metadata never appears in temp file
- no editor fallback guessing:
  - use `$VISUAL`, else `$EDITOR`
  - if neither exists, fail with exact retry example
- duplicate env keys are invalid
- invalid env keeps user in repair loop, not silent failure
- unchanged content must not rewrite payload
- changed content rewrites payload using existing recipient list exactly as stored
- phase 4 still does **not** run `update` mutation
- if payload `needsUpdate`, phase 4 may still proceed for now only if spec-compatible decision is explicit in command contract

Warning:
- spec says edit flow should eventually prompt into `update` first
- phase 4 should therefore isolate an edit preflight seam now, even if actual update command lands later
- do not hardcode behavior that phase 6 must delete

## Required design correction before implementation

Confidence 98%:
- current app layer now duplicates payload-open orchestration in `InspectPayload` and `ReadPayload`
- phase 4 should extract one internal shared module before adding `EditPayload`

Recommended internal module:
- `src/app/shared/OpenPayload.ts`
- or `src/app/payload/OpenPayload.ts`

Responsibilities:
- load home state
- read payload file
- parse preamble/blob
- read encrypted local keys
- decrypt envelope
- import/refresh known identities from recipients
- persist learned known identities if needed
- compute `needsUpdate`

Recommended output shape:
- `path`
- `state`
- `nextState`
- `envelope`
- `needsUpdate`

Do **not** put into this helper:
- terminal logic
- editor logic
- stdout/stderr strings
- temp-file management

This extraction is phase-4-critical. Without it, `EditPayload` will repeat the same orchestration a third time.

## DDD module split

### Domain

Add pure env-editing modules under `src/domain/payload/`:
- `EnvDocument.ts`
- maybe `EnvDocumentError.ts`

Responsibilities:
- parse supported v0 dotenv subset
- preserve key order
- reject duplicate keys
- normalize serialized output

V0 supported syntax:
- `KEY=value`
- empty values
- blank lines
- `#` comments

V0 non-goals:
- shell expansion
- multiline heredocs
- comment round-trip fidelity

Recommended API:
- `parseEnvDocument(text)`
- `serializeEnvDocument(document)`
- maybe `normalizeEnvText(text)`

Do **not** hide destructive normalization.
Tests must lock the exact supported subset.

### App

Add:
- `src/app/shared/OpenPayload.ts`
- `src/app/edit-payload/EditPayload.ts`
- `src/app/edit-payload/EditPayloadError.ts`

`OpenPayload` responsibilities:
- shared payload-open orchestration for inspect/read/edit

`EditPayload` responsibilities:
- accept path + passphrase + edited plaintext env text
- validate env
- compare edited content vs current env
- no-op if unchanged
- if changed:
  - rebuild envelope with same metadata except `lastRewrittenAt`
  - keep same recipients
  - keep same `payloadId`
  - write final payload file
- return structured result:
  - `unchanged`
  - `rewritten`
  - `needsUpdate`

Important:
- `EditPayload` should not launch editors itself
- editor lifecycle stays CLI/infrastructure edge

### Ports

Add explicit editor/tempfile boundaries:
- `src/port/Editor.ts`
- `src/port/EditorError.ts`
- `src/port/TempFile.ts`
- `src/port/TempFileError.ts`

`Editor` owns:
- opening a temp file in configured editor
- waiting for process exit

`TempFile` owns:
- create temp file with initial contents
- read back contents
- best-effort delete

Why separate:
- editor launch and temp file lifecycle are distinct operational concerns
- makes tests much simpler
- keeps CLI thin

Do **not** fold tempfile logic into CLI command.

### Infra

Add node adapters:
- `src/infra/editor/nodeEditor.ts`
- `src/infra/fs/nodeTempFile.ts`

Responsibilities:
- resolve `$VISUAL` then `$EDITOR`
- fail clearly if both missing
- create temp file under OS tmp dir
- best-effort cleanup

No shell tricks.
No inline heredoc editor launch.

### CLI

Add:
- `src/cli/command/editPayloadCommand.ts`
- `src/cli/command/editPayloadCommand.test.ts`

Responsibilities:
- parse `path`
- prompt for passphrase
- open payload for edit through app/editor/tempfile boundaries
- loop on invalid env:
  - show error on stderr
  - reopen editor
- if unchanged:
  - concise stdout/stderr success with no rewrite
- if changed:
  - concise success
- if editor missing:
  - fail with exact retry example:
    - `EDITOR=vim bage edit <path>`

## Tracer-bullet TDD order

### Slice A: env document domain

Goal:
- prove supported dotenv subset and duplicate-key rejection

First red tests:
- parse ordered key/value pairs
- ignore blank lines/comments
- allow empty values
- duplicate keys fail
- serialize normalized output deterministically

Acceptance:
- pure env-domain tests green

### Slice B: shared `OpenPayload` extraction

Goal:
- remove duplication before adding edit

First red tests:
- existing `InspectPayload` and `ReadPayload` behavior still pass after extraction
- payload-open result includes envelope + learned identities + `needsUpdate`

Implementation details:
- migrate inspect/read to use shared helper
- behavior must remain unchanged

Acceptance:
- inspect/read focused tests still green
- code duplication materially reduced

### Slice C: `EditPayload` app

Goal:
- prove rewrite vs no-op behavior without real editor process

First red tests:
- unchanged env text => no payload rewrite
- changed env text => payload rewritten with same recipients + same payload id
- rewrite updates `lastRewrittenAt`
- invalid env => typed app error
- no payload mutation on invalid env

Use fake payload repo/crypto first.

Acceptance:
- app tests green

### Slice D: editor/tempfile adapters

Goal:
- prove temp-file lifecycle and editor resolution separately

First red tests:
- temp file created with initial env text and read back
- best-effort cleanup
- editor command resolves `$VISUAL` before `$EDITOR`
- missing editor => typed error

Acceptance:
- infra tests green

### Slice E: `edit` CLI loop

Goal:
- prove actual user-facing edit behavior

First red tests:
- prompts for passphrase
- opens plaintext env only
- invalid env => stderr + reopen loop
- unchanged => concise no-op message
- changed => concise success
- missing editor => retry command in stderr

Implementation details:
- keep loop at CLI/app orchestration layer
- do not put retry loop inside domain

Acceptance:
- CLI tests green

### Slice F: live wiring + regression gate

Goal:
- register `edit` in root CLI/live layer

Acceptance:
- package `check` green
- inspect/read/create still green

## Implementation details by layer

### 1. Shared payload-open module

This should be introduced before `EditPayload`, not after.

Reason:
- inspect/read already share the hard part
- edit will need same exact path
- delaying extraction increases churn and test rewriting

Target consumers:
- `InspectPayload`
- `ReadPayload`
- `EditPayload`

### 2. Editor model

Recommended editor port contract:
- `editFile(path: string): Effect<void, EditorLaunchError | EditorExitError | EditorUnavailableError>`

No file contents in editor port API.
TempFile port should own file content.

### 3. Temp file model

Recommended temp-file port contract:
- `create(initialContents: string): Effect<{ path: string }, TempFileCreateError>`
- `read(path: string): Effect<string, TempFileReadError>`
- `delete(path: string): Effect<void, TempFileDeleteError>`

CLI/app orchestrates:
- create
- edit
- read
- delete

### 4. Edit result contract

Recommended discriminated result:
- `unchanged`
- `rewritten`

Keep invalid env as failure, not success variant.

This keeps CLI output simpler.

### 5. Update-preflight seam

Phase 4 should **not** implement `update`.
But `edit` must not bake in the wrong maintenance contract.

Recommended seam:
- if `needsUpdate.isRequired`:
  - return typed `EditPayloadUpdateRequiredError`
  - CLI can later evolve to prompt into update in phase 6

This is cleaner than silently editing stale-self payloads now.

Warning:
- if you skip this and let edit rewrite stale-self payloads now, you partially implement `update` accidentally.

## Suggested commit sequence

1. `domain: add env document parser and serializer`
2. `app: extract shared open-payload helper and migrate inspect/read`
3. `app: add EditPayload use case with fake-adapter tests`
4. `infra: add editor and tempfile adapters`
5. `cli: add edit command and retry loop`
6. `wire: register edit and run full regression gate`

## Acceptance criteria

- [ ] `edit <path>` opens plaintext `.env` only.
- [ ] duplicate env keys are rejected.
- [ ] invalid env sends user back through edit loop instead of corrupting payload.
- [ ] unchanged edit session does not rewrite payload.
- [ ] changed edit session rewrites payload with same recipients and same payload id.
- [ ] metadata never enters editor temp file.
- [ ] missing `$VISUAL` and `$EDITOR` fails with exact retry example.
- [ ] inspect/read/create regressions remain green.
- [ ] package `check` is green at end of phase.
