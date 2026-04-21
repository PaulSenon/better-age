# Plan: Better Secrets V0 Slice 1

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`

## Slice goal

Deliver the first real v0-capable vertical slice on the home scope:
- `setup`
- `me`
- `add-identity`
- `identities`

Do **not** touch payload commands yet.

Reason:
- every payload command depends on final identity semantics
- current code still uses a pre-v0 model centered around `alias`, `recipient`, and a minimal home state
- payload work done before stabilizing identity/home state will create rework across domain, port, infra, app, and CLI

This slice should end with:
- final v0 home-state shape
- stable identity snapshot model
- shareable `Identity String`
- known-identity import/update behavior
- human-readable home inspection

## What this slice must explicitly not do

Out of scope for slice 1:
- payload envelope
- `create`
- `read`
- `edit`
- `grant`
- `revoke`
- `inspect`
- `update`
- `rotate`
- `change-passphrase`
- alias management command
- any filesystem crawling or payload tracking

## Durable architectural decisions for this slice

- Keep one package: `packages/cli`
- Keep DDD layering:
  - domain = canonical identity/home terms and invariants
  - app = use cases only
  - port = persistence/crypto/prompt/config contracts
  - infra = node fs / crypto / prompt implementations
  - cli = command parsing + branching + message shaping
  - program = layer wiring
- Prefer typed schemas for persisted state and boundary DTOs
- Keep local aliases outside payload concerns entirely
- Keep `Identity String` as the only user-facing share/import format
- Keep raw ownerId/fingerprint out of normal CLI inputs

## Why this is the correct first slice

The current package already has:
- crypto identity generation
- passphrase-protected key writing
- home repository
- prompt handling
- setup CLI wiring

But the current package does **not** yet have:
- stable `ownerId`
- `handle`
- `identityUpdatedAt`
- known identities collection
- `Identity String`
- home inspection command

So the shortest path to a meaningful v0 slice is:
1. replace the old home-state/identity model
2. migrate `setup` onto it
3. expose that model through `me`, `add-identity`, `identities`

This is a true vertical slice because it cuts through:
- domain
- app
- ports
- infra persistence
- CLI
- tests

And it is independently demoable:
- create local identity
- export it
- import another one
- inspect home state

## First commit scope

### Commit title

`refactor(better-age): introduce v0 identity and home-state domain model`

### Commit goal

Create the final domain and persistence foundation for home-scope v0 behavior **without** adding new commands yet.

This commit should only establish the model and wire existing `setup` onto it where required to keep the repo compiling.

### Why this should be commit 1

Because every later commit in this slice depends on these new canonical types:
- `ownerId`
- `displayName`
- `handle`
- `identityUpdatedAt`
- known identities collection
- new home-state shape

If these are not introduced first, later commits will either:
- duplicate translation logic
- keep temporary legacy adapters around too long
- or force wide mechanical rewrites across multiple commands

### Files/modules this commit should touch

Domain:
- `src/domain/identity/*`
- `src/domain/home/*`
- `src/domain/error/*` if new domain/persistence error variants are needed

Ports:
- `src/port/Crypto.ts`
- `src/port/HomeRepository.ts`
- `src/port/HomeRepositoryError.ts`

Infra:
- `src/infra/crypto/typageCrypto.ts`
- `src/infra/fs/nodeHomeRepository.ts`

App:
- existing setup/create-user-identity use case only as needed to compile against the new model

CLI:
- only minimal edits required to keep `setup` compiling against the new use-case contract

Tests:
- domain/unit tests for new identity and home-state invariants
- integration tests for home-state persistence shape

### Exact implementation tasks for commit 1

#### 1. Replace the identity model with canonical v0 terms

Introduce typed schemas/types for:
- `OwnerId`
- `Fingerprint`
- `DisplayName`
- `Handle`
- `IdentityUpdatedAt`
- `IdentityString`

Introduce distinct records for:
- self identity snapshot
- known identity snapshot
- retired key metadata

Do not keep `alias` as the core domain word.

Migration rule for this commit:
- old code may still accept existing setup CLI input named `alias`
- but app/domain model should already call it `displayName`

#### 2. Redesign home-state schema

Replace minimal home state with a schema containing at least:
- `homeSchemaVersion`
- self identity summary
- `activeKeyFingerprint`
- `rotationTtl`
- retired key metadata list
- known identities collection

Known identities collection must support:
- lookup by `ownerId`
- optional local alias overlay
- freshness comparison by `identityUpdatedAt`

Do not add:
- payload index
- usage stats
- alias history

#### 3. Expand crypto output contract

Change crypto output from current setup-only fields to include:
- `ownerId`
- `displayName` only if app computes handle from display name after crypto result
- `publicKey`
- `fingerprint`
- raw age-encrypted private key
- `identityUpdatedAt`

Constraint:
- `typageCrypto` remains responsible only for crypto-level data generation/encryption
- any human-name-derived values like `handle` should be computed in domain/app, not infra

#### 4. Redesign home repository boundary

Repository contract must support:
- load/save final home-state shape
- write active private key as `keys/active.key.age`
- move previous active key to `keys/retired/<fingerprint>.key.age` later, even if slice 1 does not use rotation yet
- return typed location info for home root, state file, keys dir, retired dir

Persistence rules:
- `state.json` is metadata only
- key files are raw age-encrypted private key payloads
- writes stay atomic
- absent state file loads as empty/default state

#### 5. Rework setup use case onto new model

`setup` path after this commit must:
- refuse if self identity already exists
- generate final v0 self identity snapshot
- persist final v0 home state
- write active key to `active.key.age`

Do not implement:
- rotate
- change-passphrase
- payload update logic

#### 6. Add domain helpers needed by later commands

Add pure helpers for:
- computing `handle` from display name + owner id prefix
- comparing identity freshness
- deciding whether an imported identity is `added`, `updated`, or `unchanged`
- reading current self identity from home state

These helpers must live in domain/app, not CLI.

### Tests required in commit 1

Unit:
- handle derivation
- identity freshness comparison
- import decision classification:
  - added
  - updated
  - unchanged
  - conflict on equal timestamp + different content
- home-state self selector behavior

Integration:
- save/load final `state.json` shape
- writing active key to `keys/active.key.age`
- missing state file => empty/default state
- typed decode failure on invalid persisted state

CLI:
- keep existing `setup` sandbox test green after adapting expectations
- verify new setup output still succeeds and home layout is correct

### Commit 1 acceptance criteria

- [ ] Domain model uses `displayName`, `ownerId`, `handle`, and `identityUpdatedAt` instead of old alias-centric semantics.
- [ ] `state.json` matches the new v0 home-state schema.
- [ ] Active private key is written to `keys/active.key.age`.
- [ ] Existing setup flow still works end-to-end on the new model.
- [ ] No payload command code is introduced yet.
- [ ] Unit and integration coverage exists for the new foundation rules.

## Full slice commit plan

### Commit 1

`refactor(better-age): introduce v0 identity and home-state domain model`

Scope:
- canonical identity types
- final home-state schema
- crypto/home repository contract updates
- setup migrated to new state model

### Commit 2

`feat(better-age): add identity string export and import use cases`

Scope:
- `Identity String` encoder/decoder deep module
- `me` use case + CLI command
- `add-identity` use case + CLI command
- known-identity freshness update semantics
- interactive paste handling for `add-identity`

Implementation details:
- keep `me` stdout-only
- preserve local alias on update
- classify result as `added` / `updated` / `unchanged`
- add failure path for malformed identity string

Tests:
- round-trip encode/decode
- malformed import rejection
- add/update/no-op behavior
- CLI output contract for `me` and `add-identity`

### Commit 3

`feat(better-age): add home identity inspection command`

Scope:
- `identities` use case + CLI command
- human-readable rendering of:
  - self summary
  - known identities
  - retired key count/details

Implementation details:
- own rendering in CLI layer
- app layer returns structured inspection DTO, not formatted strings
- no JSON mode
- no payload-derived stale markers

Tests:
- structured inspection data
- CLI snapshot-like assertions for expected sections/labels

### Commit 4

`refactor(better-age): tighten home-scope errors and docs`

Scope:
- normalize error taxonomy for home-scope commands
- align package docs with the newly implemented home slice
- harden test fixtures/support around new home-state shape

Implementation details:
- make errors stage-specific and remediation-oriented
- keep exact string flexibility but stable key phrases
- update README/VISION/CONTRIBUTING only if implementation changed contracts

Tests:
- CLI failure cases
- malformed state and malformed identity string paths

## Detailed implementation notes by layer

### Domain

Create or reshape pure modules around:
- `OwnerId`
- `Fingerprint`
- `DisplayName`
- `Handle`
- `IdentityString`
- `KnownIdentity`
- `SelfIdentity`
- `RetiredKey`
- `HomeState`

Rules:
- each concept gets one canonical schema/type
- avoid “stringly typed” raw ids crossing boundaries
- keep formatting/rendering decisions out of domain

### App

Introduce use cases/services for:
- setup self identity
- export identity string
- import identity string
- inspect identities

App layer should own:
- freshness comparison decisions
- conflict decisions
- repository orchestration

App layer should not own:
- terminal formatting
- fs path concatenation
- raw CLI option parsing

### Ports

Needed boundaries after slice 1:
- crypto service
- home repository
- prompt
- config/time if needed for `identityUpdatedAt`

Prefer service boundaries that return typed domain data, not ad-hoc raw objects.

### Infra

Node home repository should:
- own `state.json` persistence
- own key file writes
- own atomic fs semantics

Crypto adapter should:
- generate crypto material
- passphrase-encrypt private key
- not invent home-state policy

### CLI

Commands in this slice:
- `setup`
- `me`
- `add-identity`
- `identities`

CLI should own:
- TTY/no-input branching
- user prompts
- result rendering
- exit code mapping

CLI should not own:
- identity import rules
- freshness logic
- known-identity conflict policy

## EffectTS-specific guidance

Use current package style and Effect best practices:

- Keep business logic in app/domain, not inside `Command.make` handlers.
- Use layers to construct concrete services at the edge only.
- Prefer typed services/DTOs over implicit object bags crossing boundaries.
- Keep decode/encode at boundaries:
  - persisted JSON decode in infra
  - identity-string decode at app/port boundary
- Keep failure channels typed and meaningful.
- Avoid leaking Node fs or process details above infra/CLI.
- If a use case becomes a reusable capability with dependencies, prefer a service-style module instead of a loose helper pile.

## Risks and traps

- Do not try to implement rotation in the same slice just because retired-key metadata is introduced.
- Do not add payload concerns into home-state types.
- Do not keep both legacy alias-centric and new displayName-centric models long term.
- Do not let `me` or `add-identity` become CLI-only logic; they need stable app/domain modules because payload grant/import later will reuse them.
- Do not hardcode raw string ids across the app layer once typed wrappers exist.

## Recommended review checklist

- Does any domain/app type still use old ambiguous naming like `alias` where `displayName` is now canonical?
- Does any infra module compute human UX concepts that belong in domain/app?
- Is `Identity String` fully reusable outside CLI?
- Can later payload commands import identity snapshots without reworking this slice?
- Are home-state and key-file layouts already final enough to avoid churn in slice 2?

## What the next slice will build on

If slice 1 lands cleanly, slice 2 can start from a stable base and implement:
- payload envelope
- `create`
- `inspect`

without redesigning identity/home semantics again.

## Unresolved questions

- none
