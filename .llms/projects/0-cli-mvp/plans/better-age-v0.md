# Plan: Better Secrets V0

> Source PRD: `BETTER_AGE_V0_PRD.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Command surface**:
  - Home: `setup`, `me`, `add-identity`, `identities`, `rotate`, `change-passphrase`
  - Payload: `create`, `read`, `edit`, `grant`, `revoke`, `inspect`, `update`
- **Key models**:
  - Identity continuity uses `ownerId`
  - Current key instance uses `fingerprint`
  - Human display uses `displayName`
  - Portable ergonomic reference uses `handle`
  - Freshness uses `identityUpdatedAt`
  - Canonical v0 text `ownerId` format is `bsid1_<16hex>`
  - Canonical v0 `handle` format is `<display-name>#<first-8-hex-of-owner-id-body>`
  - Current identity-string URL path stays opaque in v0; any later path hints are cosmetic only
- **Home state**:
  - One `state.json`
  - Raw age-encrypted private key files under `keys/`
  - Known identities and retired-key metadata in state, not in key files
- **Payload format**:
  - Caller-owned visible file
  - Static plaintext instructional preamble
  - `BEGIN/END BETTER-SECRETS PAYLOAD` armored block
  - Inner envelope with `version`, `payloadId`, timestamps, recipients, `envText`
- **Mutation policy**:
  - Interactive mode may prompt into `update`
  - Non-interactive mode never prompts and never hides mutation
  - Non-self payload recipients are never auto-upgraded from home data
- **Editing model**:
  - Human editing always happens on plaintext `.env` temp content only
  - Metadata is never exposed in editor buffer
- **Testing model**:
  - Unit tests for pure domain/use-case rules
  - Integration tests for adapters, file formats, and state transitions
  - Sandboxed CLI tests for visible command contracts

---

## Phase 1: Rebuild The Identity And Home-State Core

**User stories**: 1, 2, 3, 4, 5, 6, 8, 9, 26, 32, 34

### What to build

Replace the current setup-only identity model with the v0 identity registry and home-state model. This phase should deliver a complete home-scope vertical slice where a user can set up their identity, export it with `me`, import another identity with `add-identity`, inspect local state with `identities`, and persist all data in the final v0 home layout.

Implementation details:
- Redesign the identity domain around:
  - self identity snapshot
  - known identity snapshot
  - local alias overlay
  - retired key metadata
  - freshness comparison via `identityUpdatedAt`
- Redesign home state to store:
  - schema version
  - self summary
  - active fingerprint
  - rotation TTL
  - retired key metadata
  - known identities collection
- Redesign home repository contract so it can:
  - load/save the richer home state atomically
  - read/write active and retired raw `.key.age` files
  - expose home location details cleanly
- Extend crypto contract only as needed to support:
  - generating identity material that can produce `ownerId`, `fingerprint`, `publicKey`
  - passphrase-encrypted private key output
  - emitting canonical `ownerId` in `bsid1_<16hex>` format rather than current temporary artifact
- Replace current `alias` terminology in setup with `displayName` where needed in user-facing semantics, while keeping backward-compatibility decisions explicit if needed during migration
- Implement `me` identity-string encoding/decoding as a stable deep module
- Correct current temporary handle derivation so handle suffix is the first 8 hex chars of the owner-id body, not a prefix of raw text like `owner_...`
- Implement `add-identity` freshness update semantics and collision-safe local alias suggestion hook
- Implement `identities` human-readable output contract
- Migrate the existing setup command onto the new model instead of leaving a parallel legacy setup path

### Acceptance criteria

- [ ] `setup` creates final v0 home-state shape and raw age-encrypted key file layout.
- [ ] `me` prints the resolved v0 identity string and nothing else to `stdout`.
- [ ] `add-identity` adds, updates, or no-ops by `ownerId` with freshness rules enforced.
- [ ] `identities` shows `Me`, `Known identities`, and retired-key information per the spec.
- [ ] Existing setup behavior is migrated onto the new home-state architecture rather than duplicated.
- [ ] Unit tests cover identity freshness and collision rules.
- [ ] Integration tests cover final on-disk home layout.
- [ ] Sandboxed CLI tests cover setup/me/add-identity/identities happy paths.

---

## Phase 2: Introduce The Payload Envelope And Inspection Slice

**User stories**: 10, 12, 13, 14, 15, 16, 30, 33, 34, 35

### What to build

Build the payload envelope as a real end-to-end slice before any editing or sharing. This phase should let a user create a payload file with self as the only recipient and inspect it safely. It establishes the final payload file contract, schema parsing, recipient snapshot model, and home-state learning from payload recipients.

Implementation details:
- Introduce payload domain models for:
  - outer preamble
  - armored payload block markers
  - inner envelope schema
  - recipient snapshot
  - payload update state computation
- Add a payload repository or equivalent persistence boundary to own:
  - parsing raw file text
  - serializing final file text
  - decrypting/encrypting inner envelope
- Implement `create` end-to-end:
  - explicit path or interactive filename prompt
  - self recipient only
  - generated `payloadId`
  - correct timestamps
  - final preamble + armored block layout
- Implement `inspect` end-to-end:
  - decrypt inner envelope
  - import unknown/fresher recipient snapshots into known identities
  - print non-secret metadata and env key names
  - always print `needs update`
- Define corruption-stage classification in the payload path and surface it cleanly
- Keep all payload metadata encrypted except static preamble text

### Acceptance criteria

- [ ] `create` produces a final-format payload file with static preamble and armored payload block.
- [ ] New payloads contain self as the only recipient and a generated `payloadId`.
- [ ] `inspect` prints non-secret metadata, recipient list, env keys, and `needs update`.
- [ ] Opening/inspecting payloads imports unknown or fresher recipient snapshots into home state without mutating payload recipients.
- [ ] Invalid file format, decryption failure, envelope failure, and env-content failure are distinguishable error classes.
- [ ] Unit tests cover payload envelope parse/serialize invariants.
- [ ] Integration tests cover real payload file round-trip.
- [ ] Sandboxed CLI tests cover create + inspect happy path and corruption errors.

---

## Phase 3: Deliver Safe Plaintext Consumption With `read`

**User stories**: 17, 18, 28, 29, 33, 35

### What to build

Add machine-facing plaintext access without introducing human-oriented leakage. This phase should make payloads usable by downstream env loaders while preserving the interactive/non-interactive maintenance contract and TTY safety rules.

Implementation details:
- Implement `read` against the Phase 2 payload stack
- Enforce:
  - `stdout` TTY refusal by default
  - `--force-tty` override
  - all non-payload user messaging on `stderr`
- Reuse the payload update state computation:
  - in TTY interactive flow, prompt into `update`
  - in non-interactive flow, fail with explicit remediation
- Keep payload home-learning behavior active during `read`
- Preserve raw `.env` output exactly as stored in payload `envText`

### Acceptance criteria

- [ ] `read` outputs plaintext `.env` to `stdout` only.
- [ ] `read` refuses TTY output by default and allows explicit override.
- [ ] Interactive `read` can prompt into `update` before output when required.
- [ ] Non-interactive `read` never mutates payload and fails with exact remediation when update is required.
- [ ] CLI tests verify stdout/stderr separation and TTY refusal behavior.

---

## Phase 4: Deliver Real Editing And Env Validation

**User stories**: 19, 20, 28, 29, 33, 35

### What to build

Add the human editing workflow using plaintext `.env` temp content only. This phase should make payloads truly useful for daily secret maintenance.

Implementation details:
- Add editor boundary if not already introduced in prior phases
- Implement env parsing/normalization module for the supported v0 dotenv subset
- Implement `edit` flow:
  - update preflight in TTY
  - temp plaintext file creation
  - editor launch from `$VISUAL` or `$EDITOR`
  - failure with retry example if neither is set
  - parse-on-exit
  - invalid env => show error and offer return to editor
  - unchanged => no rewrite
  - changed => rewrite payload with same recipient list
- Ensure metadata never enters the temp editor buffer
- Ensure best-effort temp-file cleanup

### Acceptance criteria

- [ ] `edit` opens only plaintext `.env` content.
- [ ] Invalid env syntax returns user to fix the edit instead of corrupting the payload.
- [ ] Duplicate keys are rejected as invalid.
- [ ] Unchanged edit session does not rewrite payload.
- [ ] Missing editor configuration fails with explicit retry command.
- [ ] Integration tests cover edit round-trip and env normalization behavior.
- [ ] CLI tests cover changed, unchanged, invalid, and no-editor scenarios.

---

## Phase 5: Deliver Recipient Mutation With `grant` And `revoke`

**User stories**: 7, 8, 21, 22, 23, 24, 25, 30, 31, 35

### What to build

Add explicit sharing mutation through payload recipient updates. This slice should make the product collaborative enough for v0 while preserving payload authority and local alias boundaries.

Implementation details:
- Implement identity-ref resolver as a deep module shared by `grant` and `revoke`
- Implement interactive identity selection flows:
  - `grant` picks from known identities or pasted identity string
  - `revoke` picks from payload recipients
- Implement homonym handling:
  - never guess among duplicate display names
  - prompt for exact handle
  - suggest optional local alias afterward
- Implement `grant` upsert semantics by `ownerId`
- Implement `revoke` by `ownerId`, payload-recipient-authoritative
- Forbid self revoke
- Preserve payload/home learning boundary:
  - payload recipient snapshots may update local known identities
  - local home state must not implicitly rewrite non-self payload recipients

### Acceptance criteria

- [ ] `grant` adds a new recipient when owner is absent.
- [ ] `grant` refreshes an existing recipient when an older snapshot is granted again.
- [ ] `grant` no-ops with a warning when supplied snapshot is older than the payload’s current recipient snapshot.
- [ ] `grant` interactive flow allows known-identity selection and pasted identity import.
- [ ] `revoke` removes by `ownerId` regardless of snapshot age.
- [ ] `revoke` self-target is rejected.
- [ ] Ambiguous display names never auto-resolve.
- [ ] CLI tests cover grant/revoke happy path, ambiguity path, and self-revoke failure.

---

## Phase 6: Deliver Explicit Maintenance With `update`

**User stories**: 27, 28, 29, 31, 33, 35

### What to build

Add the explicit maintenance command that makes the hidden complexity honest while keeping interactive flows low friction. This slice should complete the v0 operational model.

Implementation details:
- Implement payload update-state computation as a reusable domain/app service
- Implement `update` command:
  - schema migration when needed
  - self recipient refresh when local active key is newer than granted self snapshot
- Integrate update preflight into interactive commands:
  - `read`
  - `edit`
  - `grant`
  - `revoke`
  - `inspect` only for reporting, not mutation
- Keep non-self recipient snapshots untouched by `update`
- Ensure rotation does not rewrite payloads directly; payloads only change when `update` or another explicit mutating command runs

### Acceptance criteria

- [ ] `update` is documented and callable directly.
- [ ] `update` rewrites only schema and self-recipient freshness concerns in v0.
- [ ] Interactive commands can route into `update` before continuing.
- [ ] Non-interactive commands never hide update-driven mutation.
- [ ] CLI tests cover update-needed vs no-update states.

---

## Phase 7: Complete Local Key Lifecycle

**User stories**: 3, 9, 26, 27, 32, 34, 35

### What to build

Finish the local key lifecycle by implementing production-grade `rotate` and `change-passphrase` behavior against the final state model and payload maintenance model.

Implementation details:
- Implement `rotate` end-to-end on final state:
  - create new keypair
  - preserve `ownerId`
  - retire previous key
  - update active key pointer
  - update `identityUpdatedAt`
  - output re-share guidance
- Implement `change-passphrase` across active and retired local keys with atomic rewrite semantics
- Confirm `identities` reflects rotated and retired keys correctly
- Ensure same-process passphrase caching works across chained flows
- Keep retired keys indefinitely; do not add GC or payload indexes

### Acceptance criteria

- [ ] `rotate` updates local state only and never crawls payloads.
- [ ] `rotate` preserves `ownerId` and changes fingerprint.
- [ ] `change-passphrase` rewrites all local keys atomically or fails cleanly.
- [ ] `identities` accurately reflects active and retired key state after rotation.
- [ ] Integration tests cover rotate and passphrase change behavior.
- [ ] CLI tests cover visible rotate/change-passphrase contracts.

---

## Phase 8: Finish Documentation Alignment And Regression Hardening

**User stories**: 1 through 35

### What to build

Bring package docs, command help, and regression coverage into alignment with the now-implemented v0 contract so the shipped tool matches the spec and the product story is coherent.

Implementation details:
- Align user-facing docs with the final v0 command set and file format
- Align contributor docs with the new deep modules and testing expectations
- Remove or rewrite any stale references to old setup-only or alias terminology
- Expand regression tests to cover:
  - corruption stage classification
  - non-interactive refusal paths
  - collision flows
  - update prompts
  - inspect redaction contract

### Acceptance criteria

- [ ] README, vision/spec docs, and help output agree on v0 behavior.
- [ ] Regression suite covers high-risk CLI and payload edge cases.
- [ ] No stale documentation remains for superseded v0 behavior.
