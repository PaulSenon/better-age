# Plan: Better Age MVP Reimplementation

> Source PRD: `.llms/projects/4-cli-core-boundary-hardening/10-PRD_MVP_REIMPLEMENTATION.md`

## Architectural Decisions

- **Packages**: park the current CLI as private `@better-age/cli-legacy`, then build new `@better-age/core`, new `@better-age/cli`, and adapt `@better-age/varlock`.
- **Dependency direction**: CLI depends on core; varlock shells out to CLI `load`; core does not depend on CLI or varlock; new packages do not import `cli-legacy`.
- **Technology**: core uses `effect`; CLI uses `effect + @effect/cli`; human styling lives behind an internal presenter.
- **Persistence**: new v1 schemas only; no prototype schema compatibility; persisted/shareable artifacts use explicit `kind` and `version`.
- **Key storage**: home state stores key metadata and refs; encrypted private key blobs live under `keys/<fingerprint>.age` using age-native encrypted files.
- **Execution model**: CLI execution uses exact/guided invocation mode and interactive/headless terminal mode.
- **Machine output**: `load` and `identity export` keep stdout clean and unstyled; prompts/warnings/errors go to stderr.
- **Testing**: exhaustive core unit tests with fake ports; focused integration tests with real filesystem and age adapter; CLI contract tests; varlock stdio/process tests.

---

## Phase 1: Legacy Parking And Workspace Skeleton

**User stories**: 38, 39, 43, 45

### What To Build

Park the current CLI as a private legacy reference and create the empty target workspace shape for the rebuild. Establish the new package boundaries, basic scripts, exports, and test harness conventions without implementing product behavior yet.

### Acceptance Criteria

- [ ] Current CLI is renamed to a private legacy package with no public `bage` bin.
- [ ] New core package exists with Effect-ready package/test structure.
- [ ] New CLI package exists with parser/presenter/test structure placeholders.
- [ ] Varlock package remains separate and is ready to be adapted later.
- [ ] Workspace scripts can target packages consistently.
- [ ] No new package imports legacy CLI.

---

## Phase 2: Artifact And Migration Foundation

**User stories**: 40, 41, 42, 43

### What To Build

Implement the v1 artifact foundation for home state, payload documents, payload plaintext, private key plaintext, and public identity strings. Add pure parse/encode/migration contracts with fixtures and deterministic unit tests.

### Acceptance Criteria

- [ ] V1 artifact kind/version parsing exists for every artifact type.
- [ ] Wrong-kind, future-version, malformed-version, and missing-field fixtures are covered.
- [ ] V1 no-op migration is tested for each artifact type.
- [ ] Prototype schema compatibility is intentionally absent.
- [ ] Migration functions are pure over decoded data.
- [ ] Fixture layout is documented and usable by later phases.

---

## Phase 3: Core Identity And Key Lifecycle

**User stories**: 1, 24, 25, 26, 27, 28, 29, 31, 38, 43

### What To Build

Build the core identity store and key vault over fake ports first. Cover self identity setup, public identity export/import, known identity listing/forgetting, alias validation, key rotation, and passphrase change with deterministic unit tests.

### Acceptance Criteria

- [ ] Core can create self identity and protected current key metadata.
- [ ] Core exports current public identity string only.
- [ ] Core imports known identities with optional local alias behavior.
- [ ] Duplicate/invalid alias cases are tested.
- [ ] Core lists self, known identities, and retired keys without private key material.
- [ ] Core forgets known identity and alias without payload mutation.
- [ ] Core rotates identity under same OwnerId and retires the old key.
- [ ] Core passphrase change reencrypts current and retired key blobs through fake ports.
- [ ] Identity/key errors and idempotent outcomes match the specs.

---

## Phase 4: Core Payload Lifecycle

**User stories**: 4-23, 38, 43

### What To Build

Build core payload behavior over fake ports. Cover create, decrypt, edit, grant, revoke, update, recipient snapshots, stale self recipient detection, readable-but-outdated notices, idempotent success outcomes, and exact semantic errors.

### Acceptance Criteria

- [ ] Core creates an empty payload for the self recipient.
- [ ] Core decrypts payloads into the target read model.
- [ ] Core edit validates env text and distinguishes edited vs unchanged.
- [ ] Core grant adds, updates, or returns unchanged according to recipient state.
- [ ] Core revoke removes or returns unchanged according to recipient state.
- [ ] Core update rewrites only for payload migration or self-recipient refresh reasons.
- [ ] Core returns notices for in-memory read migration and update recommendation.
- [ ] Core rejects self grant/revoke.
- [ ] Payload errors, idempotence, and update gates match the specs.

---

## Phase 5: Real Core Adapters

**User stories**: 40, 43, 44

### What To Build

Implement the real filesystem and age-backed core adapters. Prove the v1 file layout, age-native encrypted key blobs, encrypted payload files, and real decryptability behavior through focused integration tests.

### Acceptance Criteria

- [ ] Home state reads/writes real v1 documents.
- [ ] Encrypted private key blobs are written under the expected key ref layout.
- [ ] Real age adapter round-trips protected private keys.
- [ ] Real age adapter round-trips encrypted payloads.
- [ ] Passphrase change proves new passphrase works and old passphrase no longer works.
- [ ] Rotation keeps old key decryptability where expected.
- [ ] Grant/revoke decryptability behavior is proven through real adapter tests.
- [ ] Integration tests stay focused and do not duplicate every unit branch.

---

## Phase 6: New CLI Identity Slice

**User stories**: 1-3, 24-28, 32-37, 39, 45

### What To Build

Build the first usable CLI slice around identity workflows. Include parser setup, home preflight, prompt policy, presenter, stdout/stderr routing, and the identity commands that do not require payload flows.

### Acceptance Criteria

- [x] `bage setup` works in exact and guided interactive mode.
- [x] Headless setup fails with the correct missing operand or passphrase-unavailable behavior.
- [x] `bage identity export` prints identity string only to stdout.
- [x] `bage identity import` supports optional alias prompting and `--alias`.
- [x] `bage identity list` renders human output to stdout.
- [x] `bage identity forget` resolves known identities and never mutates payloads.
- [x] Passphrase retry behavior works where applicable.
- [x] Human errors/warnings/success output is styled through the presenter.
- [x] CLI contract tests cover stdout/stderr and exit codes.

---

## Phase 7: New CLI Payload Read/Edit Slice

**User stories**: 4-12, 21-23, 32-37, 39, 45

### What To Build

Add payload create and read/edit commands to the new CLI. Implement shared payload context opening, passphrase retry, inspect/view/load output routing, editor behavior, and readable-but-outdated warnings.

### Acceptance Criteria

- [x] `bage create` validates target existence before passphrase prompt.
- [x] `bage inspect` renders metadata, keys, and recipients without plaintext values.
- [x] `bage view` opens plaintext through the secure viewer and never stdout.
- [x] `bage load --protocol-version=1` prints raw env text only to stdout.
- [x] `load` protocol errors are handled before prompts.
- [x] `bage edit` handles cancel, unchanged, invalid env retry, and changed save.
- [x] Payload read notices/warnings route to stderr where required.
- [x] Exact/guided/headless behavior matches the command contracts.

---

## Phase 8: New CLI Sharing And Maintenance Slice

**User stories**: 13-23, 32-37, 39, 45

### What To Build

Add grant, revoke, and update command flows. Implement guided recipient pickers, exact identity resolution, custom identity string entry, self disabling, already-granted rendering, outdated write gates, and update-now resume behavior.

### Acceptance Criteria

- [ ] `bage grant` exact flow resolves known identity, identity string, or payload recipient reference.
- [ ] Guided grant picker merges self, known identities, and payload recipients correctly.
- [ ] Already-granted and self identities are visible but disabled in guided grant.
- [ ] `bage revoke` exact flow resolves against payload recipients.
- [ ] Guided revoke picker shows payload recipients only and disables self.
- [ ] `bage update` rewrites only for allowed update reasons.
- [ ] Outdated payload write gate works for guided edit/grant/revoke.
- [ ] Exact outdated write commands fail with update remediation.
- [ ] Idempotent grant/revoke/update outcomes render as success.

---

## Phase 9: CLI Identity Security Slice

**User stories**: 29-32, 36, 37, 39, 45

### What To Build

Add the remaining identity security commands to the new CLI: identity rotation and passphrase change. Connect passphrase retry, confirmation mismatch retry, retired key handling, and stale self-recipient warning presentation.

### Acceptance Criteria

- [ ] `bage identity rotate` prompts for passphrase and preserves OwnerId.
- [ ] Rotation moves previous key to retired keys and renders update remediation.
- [ ] `bage identity passphrase` prompts current passphrase with retry.
- [ ] New passphrase confirmation mismatch retries the pair.
- [ ] Passphrase change reencrypts current and retired key blobs.
- [ ] Headless mode fails passphrase unavailable for both commands.
- [ ] Success/warning output uses presenter and never machine stdout.

---

## Phase 10: Varlock Load Protocol Slice

**User stories**: 8, 9, 37, 46

### What To Build

Adapt varlock to the new CLI `load` protocol. Preserve the proven stdio contract: inherited stdin for passphrase, stdout piped for env text, stderr inherited for prompts and human messages.

### Acceptance Criteria

- [ ] Varlock spawns new `bage load --protocol-version=1`.
- [ ] Stdin is inherited for passphrase prompts.
- [ ] Stdout is captured as raw env text.
- [ ] Stderr carries prompts, warnings, and errors.
- [ ] Non-zero load exits map to adapter failure.
- [ ] Stdio setup failures map to adapter failure.
- [ ] Varlock does not import core and does not handle passphrases directly.

---

## Phase 11: Final Contract Hardening

**User stories**: all

### What To Build

Run a final product contract pass across core, CLI, and varlock. Close edge-case gaps, tighten snapshots, verify styling boundaries, and ensure docs/specs match the implementation before release.

### Acceptance Criteria

- [ ] Full command surface matches the target command list.
- [ ] Error/message mapping is covered by tests or snapshots.
- [ ] Machine stdout commands are clean under success and failure.
- [ ] Guided/headless/exact behavior is covered for representative commands.
- [ ] Migration and fixture tests pass.
- [ ] Real adapter integration tests pass.
- [ ] Varlock process integration tests pass.
- [ ] User-facing docs are updated enough for MVP use.
- [ ] Legacy package remains private and unreferenced by new packages.
