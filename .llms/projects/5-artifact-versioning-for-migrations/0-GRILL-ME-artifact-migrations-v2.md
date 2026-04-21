# Artifact Migrations Grilling Log

## 2026-04-21

### User position

- Candidate versioned artifacts:
  - Home State
  - Identity representation / snapshot
  - Payload
  - Load command machine interface, maybe simpler hard-fail contract instead of full migration machinery
- Read operations must not persist updates.
- When local CLI can understand an older artifact:
  - read commands migrate in memory only
  - write commands require explicit user acceptance before persistent migration
- When local CLI is older than artifact version:
  - hard fail
  - explain remediation
- Home State is special:
  - auto-migrate on newer CLI startup
  - any older CLI against newer Home State must hard fail
- Identity String is special:
  - pasted/imported old strings migrate on the fly when possible
  - Home State migration should migrate embedded known identities
  - Payload migration should migrate embedded recipient identity snapshots
- Load protocol version is basic:
  - fixed param mismatch
  - hard fail on incompatibility

### Codebase findings

- Current code already has four version boundaries:
  - `HomeState.homeSchemaVersion`
  - `IdentityStringPayload.version` plus prefix `better-age://identity/v1/`
  - `PayloadEnvelope.version`
  - `load --protocol-version`
- Current `payload needs update` mixes distinct concerns:
  - schema outdated
  - stale self recipient after rotation
  - duplicate self recipient cleanup
- Current `OpenPayload` persists Home State side effects during reads by merging known identities from payload recipients.
- Existing glossary already defines:
  - **Update** as explicit payload rewrite
  - **Load Protocol** as separate compatibility boundary

### Working tension

- One word, "update", currently covers:
  - schema migration
  - self-recipient refresh
  - duplicate-recipient reconciliation
- Likely next step: split these into separate domain concepts before designing generic migration API.

### User clarification

- "Read ops shouldn't trigger updates" applies to Payload only.
- Home State is tool-managed state, not user-managed state.
- Any CLI operation should auto-migrate Home State when needed.
- Payload is user-managed state:
  - never rewrite it without explicit user intent to mutate/update it
  - read operations may still do in-memory migration only

### User correction

- Current code should not be treated as evidence of an implemented migration mechanism.
- Existing code references are useful only to locate future integration points and existing terminology.
- Design questions must be asked independently from current placeholder/update logic.

### Resolved in this turn

- Payload `update` command remains a single user command with no granular choice.
- That command covers two distinct internal rewrite reasons:
  - payload self identity refresh after local key rotation
  - payload format/schema migration to the current CLI-supported version
- Payload reads should use an explicit migration pipeline.
- That pipeline normalizes into the current runtime shape before read logic continues.
- Persistence policy remains separate:
  - read path = in-memory only
  - update/write path = may persist
- Migration pipelines normalize only to the current CLI runtime shape.
- No arbitrary target-version migration is needed.
- No downgrade migration path is needed.
- Schema migrations are authored as explicit adjacent steps only:
  - `1 -> 2`
  - `2 -> 3`
- When opening an older artifact, runtime chains all missing adjacent steps in order until current runtime shape.
- User-visible behavior may look like `1 -> 3`, but implementation remains `1 -> 2 -> 3`.
- Default support policy:
  - every released schema version keeps a complete forward migration chain to current
- Optional future cutoff is allowed only as an explicit documented decision with hard-fail remediation
- Use one shared migration engine/contract for all versioned artifacts.
- Keep artifact-specific behavior in separate policy layers:
  - auto-persist vs in-memory only
  - prompts / remediation
  - sub-migration hooks

### Naming correction

- "Identity String" was too narrow for the intended versioned thing.
- The broader concern is one versioned identity snapshot/entity representation reused across:
  - import/export string payload
  - home known identities
  - payload recipient snapshots
  - possibly more places
- Design should prefer one canonical identity snapshot model plus projections/adapters, not separate unrelated parsers.

### Resolved in this turn

- Identity evolution should center on one canonical **Identity Snapshot** schema.
- Other forms should be containers or projections around that shared canonical identity shape when possible.
- Correction:
  - payload recipients, identity strings, and home known identities must stay interoperable
  - they should share the same full public identity representation so payload recipients can be auto-promoted into known identities without information loss
  - local alias should not live inside that shared public identity representation
  - local alias should move to separate home-local mapping/index state
- Local alias map should be keyed by `ownerId`.
- Reason:
  - `ownerId` is the most stable identity key
  - it survives rotation
  - it survives rename
- `handle` should be derived, not stored, in the canonical public identity shape.
- `fingerprint` should be derived from `publicKey`, not stored, in the canonical public identity shape.
- The current target public identity shape is explicitly:
  - `ownerId`
  - `publicKey`
  - `displayName`
  - `identityUpdatedAt`
- This is the chosen direction for now, not just an open idea.
- `Self Identity` should embed the same `Public Identity Snapshot` as its public core.
- `Self Identity` then adds only local/private fields around that shared public core.
- This is the chosen direction because it makes the public part of any identity trivial to reason about.
- Reminder for later planning:
  - likely start implementation with a cleanup / realignment phase
  - first align identity/public-structure model
  - only then implement the full migration system
- `/home` known identities should be modeled as:
  - collection of `PublicIdentitySnapshot` keyed by `ownerId`
  - separate `LocalAliasMap` keyed by `ownerId`
- Persisted `Self Identity` should follow the same target:
  - embed/store `PublicIdentitySnapshot`
  - add only local/private fields such as `privateKeyPath`, `createdAt`, `keyMode`
  - do not persist derived `handle`
  - do not persist derived `fingerprint`
- Payload migration owns payload envelope/container evolution only.
- Nested recipient/public-identity evolution inside payload is delegated to the shared identity migration chain.
- Home migration owns home container/state shape only.
- Embedded self/known public identities inside home reuse the shared identity migration chain.
- Alias-map evolution stays home-local and is not part of shared public identity migration.
- Payload commands should share one migration preflight state machine before command-specific business logic.
- Canonical payload preflight outcomes are:
  - CLI too old -> hard fail
  - readable but outdated
  - up to date
- Command policy then decides:
  - read -> continue with in-memory migration + warn/remediate
  - write -> block until explicit payload update/acceptance
  - explicit update -> persist migration
- Home migration should run as global CLI preflight before any command logic.
- Nothing else should run until managed home I/O is normalized or rejected as unsupported.
- Payload must expose one explicit stable `schemaVersion` marker.
- That marker exists to deterministically route the migration chain from current artifact version to current runtime shape.
- It is not the payload embedding its whole schema, only a stable version start point.
- Payload `schemaVersion` lives only inside the encrypted envelope.
- No plaintext duplicate version marker is wanted outside the envelope.
- Interactive payload read commands, when readable-but-outdated:
  - perform in-memory migration
  - complete the read operation
  - then emit non-blocking warning/remediation only
  - do not prompt to update
- Headless payload read commands, when readable-but-outdated:
  - perform in-memory migration
  - complete the read operation
  - emit remediation warning on `stderr`
  - never prompt
- Interactive payload write commands, when readable-but-outdated:
  - prompt for explicit update/migration acceptance
  - if accepted: persist migration, then continue original write intent
  - if refused: abort original write with no payload mutation
- Headless payload write commands, when readable-but-outdated:
  - hard fail
  - print remediation to run explicit payload update
  - never auto-migrate
  - never partially execute original write intent
- Explicit `bage update <payload>` should be idempotent.
- It should report which rewrite reasons it handled:
  - payload format migration
  - payload self refresh
  - both
- If nothing is needed, it should clearly report "already up to date" equivalent.
- Unsupported newer payload version should hard-fail every payload command kind:
  - read
  - write
  - explicit update
- Remediation in that branch always says to update CLI, not payload.
- Hard-break gate should exist as explicit per-artifact version policy in code.
- Default hard-break policy is allow.
- It is used only when intentionally de-supporting some old known versions.
