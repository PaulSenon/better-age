# Plan: Better Secrets V0 Phase 2

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`

## Goal

Deliver the first payload vertical slice:
- `create`
- `inspect`

Do **not** implement yet:
- `read`
- `edit`
- `grant`
- `revoke`
- `update`

Phase 2 ends when:
- a user can create a final-format payload file
- payload contains self as only recipient
- `inspect` can safely read it
- payload recipient snapshots can enrich home known identities
- corruption stages are classified cleanly

## Why this scope

This is the smallest payload slice that:
- proves final payload file format
- proves real encryption/decryption path
- proves home-state learning from payloads
- avoids premature edit/update/grant complexity

If we skip straight to `read` or `edit`, we will blur:
- file format decisions
- recipient snapshot rules
- corruption taxonomy
- payload repository boundaries

## Durable decisions for phase 2

- Payload stays caller-owned visible file.
- File format stays:
  - static plaintext instructional preamble
  - `BEGIN/END BETTER-SECRETS PAYLOAD` armored block
  - encrypted inner envelope
- All real metadata stays encrypted.
- `create` grants self only.
- `inspect` never prints secret values.
- `inspect` always prints `needs update`.
- Opening payload may learn recipient identities into home state.
- Home learning never mutates payload.

## DDD module split

### Domain

Add pure payload modules:
- `src/domain/payload/PayloadPreamble.ts`
- `src/domain/payload/PayloadFile.ts`
- `src/domain/payload/PayloadEnvelope.ts`
- `src/domain/payload/PayloadId.ts`
- `src/domain/payload/PayloadRecipient.ts`
- `src/domain/payload/PayloadNeedsUpdate.ts`

Responsibilities:
- preamble text generation
- delimiter constants
- file parse/serialize invariants
- inner envelope schema
- recipient snapshot schema
- `needs update` computation

Do **not** put:
- fs
- crypto IO
- CLI strings

### App

Add use cases:
- `src/app/create-payload/CreatePayload.ts`
- `src/app/create-payload/CreatePayloadError.ts`
- `src/app/inspect-payload/InspectPayload.ts`
- `src/app/inspect-payload/InspectPayloadError.ts`

Responsibilities:
- orchestrate repositories + crypto
- classify corruption stages
- import fresher/unknown recipient snapshots into home state
- return structured DTOs only

### Ports

Add boundaries:
- `src/port/PayloadRepository.ts`
- `src/port/PayloadRepositoryError.ts`
- `src/port/PayloadCrypto.ts`
- `src/port/PayloadCryptoError.ts`

`PayloadRepository` owns:
- read raw payload file text
- write raw payload file text
- maybe stat path type if needed for dir-vs-file `create` flow

`PayloadCrypto` owns:
- encrypt inner envelope to armored ciphertext for recipients
- decrypt armored ciphertext using local private key(s)

Keep age/private-key loading concerns behind ports, not CLI.

### Infra

Add node adapters:
- `src/infra/fs/nodePayloadRepository.ts`
- `src/infra/crypto/payloadAgeCrypto.ts`

Responsibilities:
- file IO
- directory detection
- atomic writes
- actual age encryption/decryption

### CLI

Add commands:
- `src/cli/command/createPayloadCommand.ts`
- `src/cli/command/inspectPayloadCommand.ts`

Responsibilities:
- parse args/options
- prompt for missing filename in TTY
- print user-facing output
- map typed app errors to stderr + exit

No domain logic in commands.

## Proposed tracer-bullet TDD order

### Slice A: payload file domain

Goal:
- prove final file text shape without real crypto

First red tests:
- payload file serializes to:
  - 5-line preamble
  - blank line
  - begin marker
  - armored ciphertext body
  - end marker
- parser rejects:
  - missing begin marker
  - missing end marker
  - duplicated markers

Green implementation:
- pure file formatter/parser only
- no envelope semantics yet

Acceptance:
- pure domain tests green

### Slice B: envelope schema

Goal:
- prove decrypted inner envelope contract

First red tests:
- envelope round-trips with:
  - `version`
  - `payloadId`
  - `createdAt`
  - `lastRewrittenAt`
  - `recipients`
  - `envText`
- recipient snapshot contains:
  - `ownerId`
  - `publicKey`
  - `fingerprint`
  - `displayNameSnapshot`
  - `identityUpdatedAt`

Green implementation:
- pure schema modules only

Acceptance:
- pure schema tests green

### Slice C: create-payload app with fake crypto/repo

Goal:
- prove `create` behavior through app interface first

First red tests:
- with self identity present, `CreatePayload.execute`:
  - creates payload id
  - uses self as only recipient
  - writes final payload text
  - returns structured success DTO
- when no self identity:
  - app returns typed not-set-up error

Green implementation:
- fake repo + fake payload crypto in unit tests
- no CLI yet

Acceptance:
- app tests green for self-only create path

### Slice D: inspect-payload app with fake crypto/repo

Goal:
- prove `inspect` behavior and home learning

First red tests:
- `InspectPayload.execute` returns structured DTO with:
  - schema version
  - payload id
  - created at
  - last rewritten at
  - recipient list
  - env key names
  - `needs update`
- unknown recipient snapshot gets imported into home state
- newer known identity snapshot from payload updates home state
- payload is not rewritten during inspect

Green implementation:
- app orchestration only

Acceptance:
- inspect DTO + home learning tests green

### Slice E: real node payload repository integration

Goal:
- prove actual file layout on disk

First red tests:
- write payload file -> read back same parsed structure
- missing file error is typed
- malformed preamble/blob classify as file-format error

Green implementation:
- node fs adapter only

Acceptance:
- integration tests green for file IO

### Slice F: real age payload crypto integration

Goal:
- prove self-encrypted envelope can be decrypted by local key

First red tests:
- encrypt envelope for self recipient using stored active key/public key
- decrypt same envelope with local passphrase-protected private key
- decryption failure maps to typed decrypt error

Green implementation:
- age adapter only

Acceptance:
- integration tests green for real crypto round-trip

### Slice G: `create` CLI

Goal:
- prove visible command contract

First red tests:
- explicit path creates file
- omitted path in TTY prompts for filename
- directory path in TTY prompts for filename inside dir
- no self identity:
  - non-interactive => fail with remediation
  - interactive => prompt toward setup behavior can be deferred to exact message contract if needed

Green implementation:
- command wiring + prompt branching

Acceptance:
- source-level command tests green

### Slice H: `inspect` CLI

Goal:
- prove human-readable output contract

First red tests:
- prints:
  - payload path
  - schema version
  - payload id
  - recipient list
  - env keys
  - `needs update: no|yes`
- no secret values printed
- corruption class maps to concise stderr

Green implementation:
- renderer only in CLI

Acceptance:
- source-level command tests green

## Exact acceptance criteria

- [ ] `create` writes final payload file shape with static preamble and armored block.
- [ ] created payload contains self as only recipient.
- [ ] created payload inner envelope matches final v0 schema.
- [ ] `inspect` returns/prints env key names but never values.
- [ ] `inspect` always prints `needs update`.
- [ ] inspecting payload imports unknown or fresher recipient snapshots into home state.
- [ ] inspect home-learning never mutates payload text.
- [ ] corruption stages are distinguishable at least as:
  - file format
  - decrypt
  - envelope schema
  - env content
- [ ] package `check` stays green after each tracer bullet.

## Concrete implementation notes

### Preamble

Freeze exact static text in one pure module.
Do not duplicate strings in CLI/adapters.

### Payload id

Generate at app layer, not CLI.
Use typed schema.
Canonical v0 text format:
- `bspld_<16hex>`

### Recipient snapshot source

For `create`, derive self recipient snapshot from `HomeState.self`.
Do not recompute from crypto adapter.

### Env keys extraction

For phase 2 only, parsing can be minimal:
- blank lines
- comment lines starting `#`
- `KEY=value`

Need only enough to list keys in `inspect`.
Do not build edit-normalization yet unless forced.

### Needs update

For phase 2, implement only current self-staleness + schema-version check.
Do not add external recipient freshness logic.

### Home-state learning

Move into one app helper, not spread through CLI:
- unknown recipient => add known identity
- fresher same `ownerId` => update known identity, preserve local alias
- equal timestamp different snapshot => fail as conflict if encountered

### Error taxonomy

Keep separate typed errors:
- payload file read/write
- payload file parse
- payload decrypt
- payload envelope decode
- payload env parse
- create without self identity

Do not collapse into one generic payload error.

## Commit plan

### Commit 1

`feat(better-age): add payload file and envelope domain`

Scope:
- pure payload domain modules
- parser/serializer tests
- envelope schema tests

### Commit 2

`feat(better-age): add create-payload use case`

Scope:
- create app service + fake-adapter tests
- payload id generation
- self recipient snapshot creation

### Commit 3

`feat(better-age): add inspect-payload use case`

Scope:
- inspect app service + fake-adapter tests
- home-state learning
- corruption stage mapping

### Commit 4

`feat(better-age): add node payload repository and age payload crypto`

Scope:
- real fs adapter
- real age adapter
- integration tests

### Commit 5

`feat(better-age): add create and inspect CLI commands`

Scope:
- command wiring
- rendering
- prompt behavior
- program layer registration

## What phase 2 must not solve

- plaintext `read`
- editor flow
- dotenv normalization for rewrite
- recipient mutation
- update prompts on non-create/non-inspect commands
- rotate touching payloads
- grant/revoke UX

## TDD execution rule

Implement strictly by tracer bullets:
- 1 red test
- minimal green
- small refactor
- rerun focused tests + `pnpm --dir packages/cli check`

Do not write all phase-2 tests first.
Do not scaffold all adapters before first green path.

## Recommended first tracer bullet

Start with **Slice A**:
- pure `PayloadFile` parse/serialize round-trip

Reason:
- smallest stable contract
- no adapter noise
- all later create/inspect behavior depends on it

## Ready-to-start next coding step

If approved, first implementation cycle should be:
1. add `PayloadFile` domain test for final preamble + markers round-trip
2. implement minimal pure formatter/parser
3. rerun focused tests + `check`

## Unresolved questions

- payload id exact format?
- exact create success stdout wording?
- exact inspect output ordering beyond required fields?
