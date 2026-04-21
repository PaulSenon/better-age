# Plan: Better Secrets V0 Phase 7

> Source docs:
> - `BETTER_AGE_V0_PRD.md`
> - `BETTER_AGE_V0_SPEC.md`
> - `UBIQUITOUS_LANGUAGE.md`
> - `plans/better-age-v0.md`
> - current implemented state in `packages/cli/src`

## Goal

Finish local key lifecycle:
- `rotate`
- `change-passphrase`

Scope:
- rotate local active identity only
- preserve `ownerId`
- retire prior active key
- write new active private key file
- move old active private key into retired storage
- re-encrypt all local keys under new passphrase
- reflect active/retired state correctly in `identities`

Do **not** implement:
- payload crawling
- payload rewrite during rotate
- retired-key GC
- display-name rename
- OS keychain integration

## Why this scope

Current state already has:
- final home state model
- active key persistence in `keys/active.key.age`
- retired key metadata slot in `state.json`
- explicit payload maintenance via phase 6

What is missing for v0:
- local key rotation
- passphrase rollover across all local keys

Without phase 7:
- key hygiene story is incomplete
- `identities` cannot show meaningful retired-key lifecycle
- phase-6 update only solves payload maintenance, not local identity maintenance

## Durable decisions for phase 7

- `rotate` is local-state only
- `rotate` preserves `ownerId`
- `rotate` changes:
  - fingerprint
  - public key
  - private key file contents
  - `identityUpdatedAt`
- old active key becomes retired and stays on disk
- retired keys remain indefinitely in v0
- `change-passphrase` re-encrypts:
  - active key
  - all retired keys
- one passphrase protects all local keys
- no cross-process passphrase cache
- same-process reuse only inside one CLI invocation

Warning:
- do not implement rotate by reusing `CreateUserIdentity` as-is
- today `Crypto.generateUserIdentity` derives a fresh `ownerId`; phase 7 needs explicit owner-id continuity

## Required design correction before implementation

Confidence 99%:
- current `Crypto` port is too small for phase 7
- it only supports `generateUserIdentity({ keyMode, passphrase })`
- phase 7 needs:
  - rotate while forcing existing `ownerId`
  - decrypt passphrase-protected private key
  - re-encrypt private key with a new passphrase

Recommended port refactor:
- extend `src/port/Crypto.ts`

Add operations:
- `generateUserIdentity({ keyMode, ownerId?, passphrase })`
  - optional `ownerId`
  - if absent: current setup behavior
  - if present: preserve exact owner id for rotate
- `decryptPrivateKey({ encryptedPrivateKey, passphrase })`
  - returns plaintext private key material string
- `encryptPrivateKey({ privateKey, passphrase })`
  - returns raw armored age passphrase-encrypted string

Why this exact split:
- `rotate` needs generate with fixed `ownerId`
- `change-passphrase` should not generate anything
- re-encryption must be explicit and testable

Do **not** hide re-encryption logic inside `HomeRepository`.
`HomeRepository` stores bytes/files; `Crypto` owns key-material transforms.

## DDD module split

### Domain

Add pure home/key-lifecycle modules under `src/domain/home/`:
- `HomeKeyLifecycle.ts`
- maybe `RetiredKeyPath.ts`

Responsibilities:
- compute next home state after rotate
- compute next home state after passphrase change metadata rewrite
- derive retired-key path from fingerprint

Recommended pure helpers:
- `buildRotatedHomeState(...)`
- `toRetiredPrivateKeyPath(fingerprint)`

Rules to encode in domain:
- old active key metadata becomes retired key record
- new active key metadata becomes `self`
- `activeKeyFingerprint` points to new fingerprint
- retired key path format:
  - `keys/retired/<fingerprint>.key.age`
- retired key metadata order:
  - newest first recommended

Keep pure domain free of:
- actual file moves
- actual crypto decrypt/encrypt
- prompt UX

### App

Add:
- `src/app/rotate-user-identity/RotateUserIdentity.ts`
- `src/app/rotate-user-identity/RotateUserIdentityError.ts`
- `src/app/change-passphrase/ChangePassphrase.ts`
- `src/app/change-passphrase/ChangePassphraseError.ts`

#### `RotateUserIdentity`

Responsibilities:
- load home state
- require active self identity
- read current active private key file
- generate new identity with:
  - same `ownerId`
  - same key mode
  - same display name
  - new passphrase-protected key under current passphrase
- write old active encrypted key bytes to retired path
- write new active encrypted key bytes to `keys/active.key.age`
- save state with:
  - updated `self`
  - updated `activeKeyFingerprint`
  - appended retired key record
- return:
  - old fingerprint
  - new fingerprint
  - new identity string/export hint data

Atomicity implementation detail:
- write retired file first
- write new active file second
- save state last
- on failure after writing new files but before state save:
  - best-effort cleanup of newly written files
  - keep old active file untouched until final state save if possible

Recommended safer implementation:
1. read current active encrypted key
2. generate new identity
3. write old active bytes to retired path
4. overwrite `keys/active.key.age` with new encrypted key
5. save next state
6. if save fails:
   - restore old active bytes into `keys/active.key.age`
   - delete newly written retired file best-effort

This avoids needing a filesystem rename port in v0.

#### `ChangePassphrase`

Responsibilities:
- load home state
- require active self identity
- prompt old/new passphrase at CLI edge only
- collect all local private key paths:
  - active
  - retired
- read every encrypted private key
- decrypt every key with old passphrase
- re-encrypt every key with new passphrase
- write all new encrypted bytes only if every decrypt/encrypt succeeded
- no payload mutations
- no state schema change unless you want a metadata timestamp later; v0 says no state change needed

Atomicity implementation detail:
- phase 7 must not half-rewrite key set
- use two-phase app flow:
  1. read all encrypted files
  2. decrypt all with old passphrase
  3. encrypt all with new passphrase
  4. write all outputs
- if any read/decrypt/encrypt fails:
  - write nothing
- if write N fails after write N-1 succeeded:
  - best-effort restore already-written earlier files from original encrypted bytes

Recommended result variants:
- `RotateUserIdentitySuccess`
- `ChangePassphraseSuccess`

Recommended typed errors:
- `...NoActiveIdentityError`
- `...PersistenceError`
- `...CryptoError`
- `...RollbackError` only if restore failure needs explicit surfacing

### Ports

Refactor `src/port/Crypto.ts`:
- extend `GeneratedIdentity` only if needed
- add:
  - `decryptPrivateKey`
  - `encryptPrivateKey`
  - optional `ownerId` input on generation

Reuse:
- `HomeRepository`
- `Prompt`

Do **not** add:
- rename/move file port
- passphrase cache service

Current `HomeRepository` is enough:
- `loadState`
- `saveState`
- `readPrivateKey`
- `writePrivateKey`
- `deletePrivateKey`

One gap:
- `writePrivateKey` currently always targets active path in some adapters/tests
- phase 7 likely needs a new explicit write-by-path method

Recommended `HomeRepository` change:
- add `writePrivateKeyAtPath({ privateKeyPath, contents })`

Why:
- rotate must write retired file path
- change-passphrase must rewrite arbitrary retired paths

Keep existing `writePrivateKey(fingerprint, contents)` only if setup still wants convenience. Do not contort phase 7 around an active-only helper.

### Infra

#### `typageCrypto`

Implement:
- generate with forced owner id
- decrypt raw armored age passphrase-encrypted private key
- encrypt plaintext private key into raw armored age passphrase-encrypted payload

Important:
- `ownerId` must remain `bsid1_<16hex>`
- when rotating with forced owner id, do **not** derive new owner id from recipient
- fingerprint still derived from new recipient

#### `nodeHomeRepository`

Implement arbitrary key-path write:
- `writePrivateKeyAtPath`

Preserve current file layout:
- `keys/active.key.age`
- `keys/retired/<fingerprint>.key.age`

### CLI

Add:
- `src/cli/command/rotateUserIdentity.ts`
- `src/cli/command/rotateUserIdentity.test.ts`
- `src/cli/command/changePassphraseCommand.ts`
- `src/cli/command/changePassphraseCommand.test.ts`

Wire both into root CLI and exit-code mapping.

#### `rotate`

CLI responsibilities:
- prompt passphrase once
- call rotate app
- print concise result:
  - old fingerprint
  - new fingerprint
  - instruction to reshare via `bage me`

Recommended output:
- `rotated identity bs1_old -> bs1_new`
- `Share updated identity: bage me`

Do not auto-print full identity string in rotate by default; too noisy.

#### `change-passphrase`

CLI responsibilities:
- prompt current passphrase
- prompt new passphrase
- prompt confirm new passphrase
- mismatch => fail before app
- success => concise confirmation only

Recommended output:
- `updated passphrase for all local keys`

## Tracer bullets

### 1. Extend crypto port + fake adapters

Build:
- add new crypto operations
- update in-memory/fake crypto used by tests

Test first:
- compile-facing tests only where needed
- no rotate app yet

Acceptance:
- setup still works unchanged
- new crypto methods available for phase 7 apps

### 2. Pure home lifecycle domain

Build:
- rotated home-state builder
- retired path helper

Test first:
- old active becomes retired
- new self preserves ownerId/displayName/keyMode
- active fingerprint updates
- retired path shape correct

Acceptance:
- no IO
- deterministic state transform

### 3. `RotateUserIdentity` app

Build:
- full rotate orchestration

Test first:
- requires active self identity
- preserves owner id
- changes fingerprint/public key
- writes retired key bytes to retired path
- overwrites active key path with new encrypted bytes
- saves state with one new retired key record
- rollback on save failure restores old active bytes and removes new retired file best-effort

Acceptance:
- no payload writes
- fake adapter tests green

### 4. `rotate` CLI

Build:
- prompt passphrase
- success/failure rendering
- root wiring

Test first:
- happy path
- prompt unavailable
- app error surfaces cleanly

Acceptance:
- user can rotate locally
- CLI tells user to reshare

### 5. `ChangePassphrase` app

Build:
- collect active + retired keys
- decrypt all with old passphrase
- re-encrypt all with new passphrase
- write all with restore-on-partial-write failure

Test first:
- rewrites active + retired keys
- wrong old passphrase => no writes
- encrypt/decrypt failure => no writes
- partial write failure => restores earlier rewritten files

Acceptance:
- no state mutation required
- payload files untouched

### 6. `change-passphrase` CLI

Build:
- prompt current/new/confirm
- mismatch short-circuit
- root wiring

Test first:
- happy path
- mismatch
- prompt unavailable
- app error rendering

Acceptance:
- visible contract matches spec

### 7. `identities` regression

Build:
- update `InspectHomeIdentities` / renderer only if needed

Test first:
- after rotate, identities shows:
  - new active key fingerprint
  - retired key count/details
- after change-passphrase, display output unchanged except no failures

Acceptance:
- active vs retired reporting is accurate

## Concrete implementation details

### Refactor `CreateUserIdentity` carefully

Do not duplicate identity-generation orchestration if avoidable.

Recommended extraction:
- shared app-local helper for:
  - generate identity
  - persist active encrypted key
  - build self identity record

But keep extraction small. Phase 7 is not a full home-state refactor.

### Owner-id continuity

This is the critical invariant.

Implementation rule:
- setup:
  - `generateUserIdentity({ passphrase, keyMode })`
- rotate:
  - `generateUserIdentity({ ownerId: current.ownerId, passphrase, keyMode: current.keyMode })`

Never recompute rotated owner id from the new recipient.

### Retired key metadata

Use existing `RetiredKey` model:
- `fingerprint`
- `privateKeyPath`
- `retiredAt`

Set `retiredAt` from current clock at rotate time, not from prior self timestamp.

### Home-state save order

For rotate:
- save state last

For passphrase change:
- no state save unless needed

### Test support updates

Update:
- `makeInMemoryHomeRepository`
- any fake `HomeRepository.make(...)` in CLI tests
- fake `Crypto` services in create-user-identity tests

Needed because new methods/overloads will otherwise break the suite.

### Message contract

Keep concise.

Recommended:
- rotate success:
  - `rotated identity bs1_old -> bs1_new`
  - `Share updated identity: bage me`
- change-passphrase success:
  - `updated passphrase for all local keys`

Errors:
- old passphrase wrong => simple crypto failure message
- confirm mismatch => `Passphrases do not match`

## Test strategy

### Unit

Add pure tests for:
- rotated state transform
- retired path helper

### App

Add fake-adapter tests for:
- `RotateUserIdentity`
- `ChangePassphrase`

### CLI

Add command tests for:
- `rotate`
- `change-passphrase`

### Integration

Add at least one integration test per command against real `typageCrypto` + node fs adapter:
- rotate preserves owner id across real generated keys
- change-passphrase rewrites raw `.key.age` files and old passphrase no longer decrypts them

### Regression

Re-run:
- `setup`
- `me`
- `identities`
- `OpenPayload`
- `update`

Reason:
- all depend on self identity and local key readability

End gate:
- `pnpm --dir packages/cli check`

## Suggested commit sequence

1. extend crypto port + fake/test adapters
2. pure rotate state domain + tests
3. `RotateUserIdentity` app + tests
4. `rotate` CLI + wiring + tests
5. `ChangePassphrase` app + tests
6. `change-passphrase` CLI + wiring + tests
7. `identities` regression + integration tests + final gate

## Acceptance criteria

- [ ] `rotate` exists and preserves `ownerId`.
- [ ] `rotate` changes active fingerprint/public key and retires prior key.
- [ ] `rotate` never rewrites payloads.
- [ ] `change-passphrase` rewrites active and retired local keys only.
- [ ] `change-passphrase` is atomic or restores previous encrypted bytes on partial failure.
- [ ] `identities` reflects active and retired keys after rotation.
- [ ] Package gate stays green.

## Risks to avoid

- silently generating a new owner id on rotate
- phase-7 payload mutation creep
- using active-only key write helper for retired keys
- half-written passphrase changes with no restore path
- broad refactor of setup/home model beyond what phase 7 needs

## Unresolved questions

- none
