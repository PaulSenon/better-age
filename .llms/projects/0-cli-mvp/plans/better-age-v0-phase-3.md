# Plan: Better Secrets V0 Phase 3

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`
> - current implemented state in `packages/cli/src`

## Goal

Deliver safe plaintext consumption:
- `read <path>`

But phase 3 must also add the minimum maintenance-preflight foundation needed by `read`, or else we either:
- violate the spec
- or ship temporary behavior we will immediately delete in phase 6

So phase 3 scope is:
- `read`
- TTY refusal / `--force-tty`
- stdout vs stderr contract
- reusable payload preflight decision module for `read`

Do **not** implement yet:
- payload mutation via `update`
- temp-file editing flow
- recipient mutation (`grant` / `revoke`)
- interactive identity picking

## Why this scope

Current state already has:
- payload create
- payload inspect
- real payload crypto
- real payload file IO

The next narrow end-to-end value is:
- decrypt to stdout for loaders / pipelines

But `read` sits exactly on the edge of the maintenance model. It must know:
- when a payload is safe to stream as-is
- when to refuse or require remediation
- how to behave differently in TTY vs non-TTY

So this phase should deepen the maintenance boundary without yet mutating payloads.

## Durable decisions for phase 3

- `read` outputs raw `envText` only.
- `read` never writes payload files in phase 3.
- `read` never writes home state except existing recipient-learning already owned by payload-open path.
- all warnings/errors/prompts go to `stderr`.
- plaintext payload content goes to `stdout` only.
- if `stdout` is a TTY, `read` refuses unless `--force-tty` is set.
- phase 3 introduces a reusable **preflight result** for payload commands:
  - `ok`
  - `tty-refused`
  - `update-required`
- phase 3 does **not** run update automatically.
- when update is required, phase 3 must fail with exact remediation:
  - `bage update <path>`
- phase 6 will reuse this same preflight module and add the actual mutation path.

## Warning

Do **not** bury TTY detection, prompt logic, or remediation wording inside crypto or app services.

Correct split:
- domain/app decides payload maintenance state
- CLI decides whether current terminal mode allows streaming plaintext
- CLI prints remediation

Wrong split:
- app directly checking `process.stdout.isTTY`
- crypto deciding whether user intended a pipe
- read command silently mutating payload before printing

## DDD module split

### Domain

Add pure modules under `src/domain/payload/`:
- `PayloadReadPolicy.ts`
- maybe `PayloadPreflight.ts` if clearer than extending `PayloadNeedsUpdate`

Responsibilities:
- represent preflight result for read-like commands
- combine:
  - `needs update`
  - `stdout is tty`
  - `force tty override`
- stay pure, no `process`, no prompt, no fs

Recommended shape:
- `PayloadReadPreflightResult`
  - `ok`
  - `tty-refused`
  - `update-required`
- carry minimal typed context:
  - optional update reason
  - optional tty refusal reason

Do **not** put:
- command text
- stderr strings
- prompt behavior

### App

Add use case:
- `src/app/read-payload/ReadPayload.ts`
- `src/app/read-payload/ReadPayloadError.ts`

Responsibilities:
- orchestrate:
  - home load
  - payload read
  - payload decrypt
  - recipient-learning
  - env extraction
  - preflight status
- return a structured DTO, not CLI text

Recommended DTO:
- `path`
- `envText`
- `needsUpdate`
- `preflight`

Important:
- app should accept passphrase explicitly
- app should **not** know whether stdout is tty
- app should **not** know about `--force-tty`

So preflight should be split:
- app returns payload maintenance state + plaintext
- CLI combines that with terminal mode

This keeps `ReadPayload` reusable for future non-CLI integrations.

### Ports

No new major ports required if current stack is reused:
- `HomeRepository`
- `PayloadRepository`
- `PayloadCrypto`

But if current app code gets duplicated, extract a shared app-level helper:
- `openPayloadForRead` or similar internal helper

Use only if it actually deepens the module.
Do not extract speculative abstractions.

### Infra

No new major infra adapters required.

Possible small adapter:
- terminal/stdio capability helper at CLI edge only

Keep it trivial unless tests force extraction.

### CLI

Add command:
- `src/cli/command/readPayloadCommand.ts`
- `src/cli/command/readPayloadCommand.test.ts`

Responsibilities:
- parse `path`
- parse `--force-tty`
- prompt for passphrase
- inspect stdout TTY state
- call `ReadPayload.execute`
- if stdout is TTY and no override:
  - refuse
  - print remediation to `stderr`
- if payload update required:
  - fail
  - print exact remediation to `stderr`
- if success:
  - write plaintext env to `stdout`
  - write nothing else to `stdout`

Also wire into:
- `src/cli/program.ts`
- `src/program/layer.ts`

## Tracer-bullet TDD order

### Slice A: payload read policy domain

Goal:
- prove terminal-safety and maintenance-safety logic as a pure module

First red tests:
- `stdout tty` + no force => `tty-refused`
- `stdout tty` + force => `ok`
- no tty + no update needed => `ok`
- no tty + update needed => `update-required`
- force tty does **not** bypass update-required

Green implementation:
- pure function only
- no CLI or app deps

Acceptance:
- pure domain tests green

### Slice B: read-payload app with fake repo/crypto

Goal:
- prove read orchestration without CLI

First red tests:
- decrypts payload and returns raw `envText`
- imports unknown/fresher payload recipients into home state
- preserves payload file without rewrite
- reports `needsUpdate`
- fails with typed app errors on:
  - payload file read failure
  - decrypt failure
  - envelope parse failure
  - env parse failure if needed by app contract

Green implementation:
- reuse inspect-path helpers where possible
- do not leak CLI concerns into app

Acceptance:
- app tests green
- no duplicated payload-open logic if a real deep helper can be extracted cleanly

### Slice C: read CLI contract

Goal:
- prove shell-safe stdout/stderr behavior

First red tests:
- prompts for passphrase
- writes env plaintext to stdout on success
- writes nothing extra to stdout
- tty stdout without force => fail with exact remediation
- update required => fail with exact remediation
- app failure => stderr + non-zero exit
- prompt unavailable => stderr + non-zero exit

Implementation details:
- inject tty state in tests via small helper or command-local function seam
- do not rely on real process stdout in unit tests

Acceptance:
- CLI tests green
- stdout/stderr split is explicit and stable

### Slice D: root CLI/live wiring

Goal:
- make `read` reachable from real program graph

Tasks:
- register command in `src/cli/program.ts`
- provide app live layer in `src/program/layer.ts`
- ensure no existing commands regress

Acceptance:
- root CLI compiles
- package `check` green

## Implementation details by layer

### 1. Shared payload-open helper

Current code already has overlapping payload-open behavior in:
- `InspectPayload`
- future `ReadPayload`

Before writing `ReadPayload`, inspect duplication candidates:
- parse outer file
- gather encrypted local key files
- decrypt inner envelope
- import recipient snapshots into home state

If duplication is already meaningful, extract one app-internal helper:
- likely under `src/app/payload/` or `src/app/shared/`

Do not over-abstract:
- helper should return a strongly typed opened payload object
- helper should not know command-specific rendering
- helper should not know terminal behavior

Suggested returned shape:
- `state`
- `envelope`
- `nextState`
- `didLearnIdentities`

### 2. Read app contract

`ReadPayload.execute` input:
- `path`
- `passphrase`

`ReadPayload.execute` output:
- `path`
- `envText`
- `needsUpdate`

Do not include:
- tty status
- remediation strings
- prompt booleans

### 3. Read policy

Pure function input:
- `needsUpdate`
- `stdoutIsTty`
- `forceTty`

Pure result:
- discriminated union

Suggested tags:
- `ok`
- `tty-refused`
- `update-required`

This module is phase-3 critical because phase 6 should reuse it instead of rewriting read behavior.

### 4. CLI remediation wording

Lock minimal wording style only, not pixel-perfect prose.

Required messages:
- TTY refusal:
  - says `read` is for pipes/redirection
  - says use `edit` for human interaction
  - says `--force-tty` exists
- update required:
  - says payload must be updated before read
  - prints exact command:
    - `bage update <path>`

### 5. Testing details

Unit tests:
- pure read policy

App tests:
- fake payload repo
- fake payload crypto
- in-memory home repo
- recipient-learning assertions
- no payload rewrite assertion

CLI tests:
- fake prompt
- fake `ReadPayload`
- fake tty detector seam
- stdout/stderr assertions

Verification gate:
- `pnpm --dir packages/cli check`

## Deliverables

By end of phase 3, repo should have:
- `read` command available in root CLI
- shell-safe plaintext streaming
- no hidden mutation on read
- reusable preflight foundation for later `update`

By end of phase 3, repo should **not** yet have:
- actual `update` command
- auto-mutation during `read`
- editor/tempfile behavior
- recipient mutation

## Suggested commit sequence

1. `domain: add payload read preflight policy`
2. `app: add ReadPayload use case with fake-adapter tests`
3. `cli: add read command with tty refusal and stderr/stdout contract`
4. `wire: register read in root cli and live layer`

## Acceptance criteria

- [ ] `read <path>` decrypts payload and prints raw `.env` text to `stdout`.
- [ ] `read` refuses stdout TTY by default.
- [ ] `read --force-tty` bypasses only tty refusal, not update-required failure.
- [ ] `read` prints no metadata or warnings to `stdout`.
- [ ] `read` prints remediation to `stderr` when payload requires update.
- [ ] `read` continues to learn unknown/fresher payload recipients into home state.
- [ ] `read` never rewrites payload files in phase 3.
- [ ] package `check` is green at end of phase.
