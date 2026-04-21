# Plan: Artifact Migration Architecture

> Source PRD: [1-BETTER_AGE_ARTIFACT_VERSIONING_PRD.md](../1-BETTER_AGE_ARTIFACT_VERSIONING_PRD.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Versioned artifacts**: `Home State`, `Payload`, and `Public Identity Snapshot` plus its encodings/containers.
- **Separate compatibility boundary**: `Load Protocol` stays outside persisted artifact migration.
- **Migration shape**: one shared migration engine, artifact-specific policy layers on top.
- **Migration routing**: explicit schema version markers, no shape inference.
- **Migration direction**: normalize only to current runtime shape.
- **Migration granularity**: adjacent steps only; no direct jump migrations.
- **Support policy**: all released versions supported by default, with explicit per-artifact hard-break policy tables for intentional cutoffs.
- **Home policy**: one global home migration preflight runs before any command logic and may auto-persist.
- **Payload policy**: payload is user-managed; reads may use in-memory migration only, writes require explicit persisted update before mutation.
- **Payload update boundary**: one idempotent `bage update <payload>` command handles payload format migration and payload self refresh.
- **Payload version marker**: payload `schemaVersion` lives only inside the encrypted envelope and is discovered after decrypt.
- **Identity core**: one canonical `Public Identity Snapshot` shared across identity strings, payload recipients, known identities, and self identity public core.
- **Public identity persisted fields**: `ownerId`, `publicKey`, `displayName`, `identityUpdatedAt`.
- **Derived public identity fields**: `handle` derives from `displayName + ownerId`; `fingerprint` derives from `publicKey`.
- **Alias policy**: local aliases live in separate home-local state keyed by `ownerId`.
- **Nested migration ownership**: payload and home migrations own their container shapes only and delegate embedded public identity evolution to shared identity migration.
- **Implementation order**: start with identity/public-shape cleanup before the full migration engine rollout.

---

## Phase 1: Identity Core Cleanup

**User stories**: 13, 14, 15, 16, 17, 18, 19, 20, 29, 34

### What to build

Realign identity storage and encoding around one canonical `Public Identity Snapshot`. Split local aliases into separate overlay state, make self identity reuse the same public core, and make identity-string, known-identity, payload-recipient, and self-public-core shapes interoperate losslessly.

### Acceptance criteria

- [ ] One canonical public identity model exists with the agreed persisted fields only.
- [ ] `handle` and `fingerprint` are treated as derived behavior, not persisted public fields.
- [ ] Known identities are represented as public identity snapshots plus separate alias overlay keyed by `ownerId`.
- [ ] Self identity stores the public snapshot plus only local/private fields.
- [ ] Identity-string, payload-recipient, known-identity, and self-public-core forms can map to the same public identity shape without information loss.

---

## Phase 2: Shared Migration Engine Skeleton

**User stories**: 21, 22, 23, 24, 28, 35, 38

### What to build

Introduce the shared migration engine contract and artifact policy boundary. Add explicit schema-version routing, adjacent-step chaining, normalize-to-current behavior, and per-artifact hard-break policy tables with default allow behavior.

### Acceptance criteria

- [ ] Shared migration engine can classify current, legacy, and unsupported artifacts.
- [ ] Engine supports adjacent-step chaining only.
- [ ] Engine always normalizes to current runtime shape only.
- [ ] Per-artifact hard-break policy tables exist and default to allow.
- [ ] Unsupported and intentionally hard-broken branches are distinguishable from normal legacy migration.

---

## Phase 3: Home Migration Preflight

**User stories**: 11, 12, 26, 27, 37

### What to build

Wire `Home State` through one global CLI preflight that runs before command logic. Legacy home state should auto-migrate and persist, unsupported home state should hard-fail immediately, and embedded identity migration should reuse the shared identity migration chain while alias-map evolution stays local.

### Acceptance criteria

- [ ] Home migration runs before any command-specific behavior.
- [ ] Legacy home state migrates and persists automatically before command logic continues.
- [ ] Unsupported newer home state fails before downstream logic starts.
- [ ] Embedded self/known public identities reuse shared identity migration rather than home-specific identity logic.
- [ ] Home migration remains allowed even for flows that are otherwise read-only.

---

## Phase 4: Payload Read Preflight

**User stories**: 1, 2, 5, 6, 10, 25, 27, 31, 36

### What to build

Implement shared payload read preflight: decrypt first, read payload `schemaVersion`, classify payload state, migrate to current runtime shape in memory when readable, and apply the agreed interactive/headless read behaviors and unsupported-version failures.

### Acceptance criteria

- [ ] Payload version routing uses the explicit schema marker inside the encrypted envelope.
- [ ] Readable legacy payloads can be migrated in memory and read successfully.
- [ ] Interactive reads of outdated payloads complete and warn without prompting.
- [ ] Headless reads of outdated payloads complete and warn on `stderr` without prompting.
- [ ] Unsupported newer payload versions hard-fail with update-CLI remediation.

---

## Phase 5: Explicit Payload Update

**User stories**: 8, 9, 25, 30, 31

### What to build

Implement `bage update <payload>` as the explicit persisted rewrite boundary. It must persist any required payload format migration and/or payload self refresh, remain idempotent, and report exactly what it handled.

### Acceptance criteria

- [ ] Explicit payload update persists payload format migration when needed.
- [ ] Explicit payload update persists self refresh when needed.
- [ ] Explicit payload update handles “both reasons” correctly in one invocation.
- [ ] Explicit payload update is idempotent when rerun on an already-current payload.
- [ ] Explicit payload update reports whether it handled format migration, self refresh, both, or nothing.

---

## Phase 6: Payload Write Gates

**User stories**: 3, 4, 7, 25, 27, 30, 31

### What to build

Apply the shared payload preflight to mutating payload commands. Interactive writes should prompt for explicit update acceptance and then continue original intent only after persisted update; headless writes should hard-fail with remediation and never mutate partially.

### Acceptance criteria

- [ ] Interactive mutating payload commands prompt before persisted migration on outdated-but-readable payloads.
- [ ] Accepted interactive prompts migrate first, then continue original write intent.
- [ ] Refused interactive prompts abort without payload mutation.
- [ ] Headless mutating payload commands hard-fail with explicit remediation instead of auto-migrating.
- [ ] No mutating payload command partially executes original intent after a migration gate failure.

---

## Phase 7: Support-Cutoff and Exhaustive Test Matrix

**User stories**: 28, 30, 32, 33, 35, 38

### What to build

Complete the regression-proofing layer: exhaustive historical-version coverage, support-window guarantees, explicit hard-break behavior, and command-matrix tests proving that cutoffs happen only through declared policy and not incidental code drift.

### Acceptance criteria

- [ ] Exhaustive tests cover all supported historical version paths and multi-hop migrations.
- [ ] Tests prove unsupported newer versions fail with the correct remediation.
- [ ] Tests prove intentional hard-break behavior is driven by explicit policy tables.
- [ ] Tests prove no-partial-mutation guarantees across payload write flows.
- [ ] Tests prove read/write, interactive/headless, and home/payload policy differences exactly match the agreed contract.
