# Better Age CLI

CLI context for local identity state, encrypted payloads, and compatibility boundaries between persisted artifacts and calling tools.

## Language

### Versioned artifacts

**Home State**:
The local persisted state under the tool home directory.
_Avoid_: Config, cache, metadata db

**Identity String**:
The shareable string encoding of an **Identity Snapshot** used for import/export.
_Avoid_: Generic identity model, whole identity entity

**Payload Envelope**:
The decrypted structured payload body containing metadata plus `envText`.
_Avoid_: Payload json, inner blob, container

**Identity Snapshot**:
The canonical versioned representation of one identity state that may be serialized in different containers such as home records, payload recipient entries, or identity strings.
_Avoid_: Identity string, contact row, recipient row

**Public Identity Snapshot**:
The full interoperable public identity representation shared by identity strings, payload recipients, and known identities.
_Avoid_: Payload-only recipient shape, home-only contact shape

Current target persisted fields:
- `ownerId`
- `publicKey`
- `displayName`
- `identityUpdatedAt`

**Self Identity**:
The local identity record whose public core is one **Public Identity Snapshot** plus local/private fields needed only on the owning machine.
_Avoid_: Separate public identity model, self-only public schema

**Derived Handle**:
The runtime handle computed from `displayName + ownerId`, not a persisted public identity field.
_Avoid_: Canonical stored field, separate migration concern

**Derived Fingerprint**:
The runtime fingerprint computed from `publicKey`, not a persisted public identity field.
_Avoid_: Canonical stored field, duplicated key identity

**Load Protocol**:
The versioned stdout/stderr/exit-code contract used by external tools to invoke `load`.
_Avoid_: Machine interface, API, machine mode

### Compatibility concepts

**Artifact Schema Version**:
The version marker embedded inside one versioned artifact and used to decide compatibility or migration.
_Avoid_: CLI version, protocol version

**Migration**:
A schema-shape transform from one artifact schema version to another.
_Avoid_: Update, refresh, repair

**In-Memory Migration**:
A migration applied only for the current operation result and not persisted.
_Avoid_: Silent update, auto-save

**Persistent Migration**:
A migration whose result is written back to the artifact store.
_Avoid_: Read-time fix, implicit save

**Migration Pipeline**:
An explicit ordered chain of schema transforms that normalizes an artifact into the current runtime shape before domain logic uses it.
_Avoid_: Ad-hoc version branching, scattered decode logic

**Current Runtime Shape**:
The single canonical artifact shape understood natively by the running CLI version after all required migrations.
_Avoid_: Arbitrary target version, negotiated schema

**Adjacent Migration Step**:
A schema migration that converts exactly one artifact schema version to the next version.
_Avoid_: Jump migration, direct `v1 -> v3`

**Migration Chain**:
The ordered application of all missing adjacent migration steps from an artifact's current version to the current runtime shape.
_Avoid_: Version branching, direct jump logic

**Migration Support Window**:
The set of released schema versions that still have a complete forward migration chain to the current runtime shape.
_Avoid_: Implicit support guess, accidental backward compatibility

**Migration Engine**:
The shared runtime contract that detects artifact version, chains adjacent migration steps, and normalizes into current runtime shape.
_Avoid_: Artifact-specific ad-hoc migration loop

**Migration Policy**:
Artifact-specific rules that decide when migrated results may be persisted, prompted, warned, or rejected.
_Avoid_: Generic engine logic, schema transform

**Nested Identity Migration**:
The reuse of the shared identity migration chain when another artifact contains embedded public identity snapshots.
_Avoid_: Re-implementing identity evolution inside payload or home migrators

**Payload Migration Preflight**:
The shared decision phase run before any payload command logic to classify the payload as unsupported, readable-but-outdated, or up-to-date.
_Avoid_: Per-command version branching

**Home Migration Preflight**:
The global CLI startup phase that validates or migrates managed home state before any command-specific logic runs.
_Avoid_: Late per-command home migration

**Schema Version Marker**:
The explicit stable version field stored in an artifact so the migration engine can deterministically choose the starting migration step.
_Avoid_: Shape inference, guessed version

**Hard-Break Policy Table**:
The explicit per-artifact code policy that can intentionally block some known historical versions even when migration machinery exists.
_Avoid_: Hidden cutoff, accidental support drop

**Compatibility Gate**:
A hard version check with no migration path in the current runtime.
_Avoid_: Migration, refresh

**Payload Update**:
The explicit payload rewrite command exposed to users.
_Avoid_: Generic migration, repair

**State Reconciliation**:
A rewrite needed to realign current local state with payload contents without changing artifact schema version.
_Avoid_: Migration

**Payload Self Refresh**:
A payload rewrite that refreshes the payload's self recipient snapshot after local identity rotation without changing payload schema version.
_Avoid_: Migration, generic update

**Payload Format Migration**:
A payload rewrite that changes the payload artifact from one schema version to another supported schema version.
_Avoid_: Refresh, reconciliation

**Managed State**:
Persisted tool-owned state that the CLI may migrate automatically without explicit user approval.
_Avoid_: User resource, user-owned file

**User-Managed Resource**:
Persisted user-owned data that the CLI must not rewrite without explicit user intent.
_Avoid_: Internal state, managed state

**Local Alias Map**:
Home-local mapping from identity owner to a user-scoped alias, stored separately from the public identity snapshot.
_Avoid_: Canonical display name, embedded identity field

## Relationships

- A **Home State**, **Identity String**, and **Payload Envelope** each carry their own **Artifact Schema Version**.
- An **Identity Snapshot** may appear in multiple serialized containers, including **Identity String**, home records, and payload recipients.
- Identity evolution is centered on one canonical **Identity Snapshot** schema.
- The shared canonical identity shape is the **Public Identity Snapshot**.
- **Identity String**, payload recipients, and known identities must all map to the same **Public Identity Snapshot** without information loss.
- **Self Identity** reuses the same **Public Identity Snapshot** as its public core.
- A **Local Alias Map** belongs only to home-local managed state and is not part of the **Public Identity Snapshot**.
- A **Local Alias Map** is keyed by **Owner Id**.
- `/home` known identities are modeled as a collection of **Public Identity Snapshot** records keyed by **Owner Id**, plus separate **Local Alias Map** overlay state.
- Persisted **Self Identity** stores the same **Public Identity Snapshot** plus only local/private fields such as `privateKeyPath`, `createdAt`, and `keyMode`.
- **Handle** is a **Derived Handle**, not a stored field of the **Public Identity Snapshot**.
- **Fingerprint** is a **Derived Fingerprint**, not a stored field of the **Public Identity Snapshot**.
- The current target persisted fields of **Public Identity Snapshot** are `ownerId`, `publicKey`, `displayName`, and `identityUpdatedAt`.
- A **Load Protocol** is a **Compatibility Gate**, not a persisted artifact schema.
- A **Migration** may be executed as an **In-Memory Migration** or a **Persistent Migration**.
- A **Migration Pipeline** normalizes a versioned artifact into the **Current Runtime Shape** before domain logic runs.
- A **Migration Pipeline** does not target arbitrary schema versions.
- A **Payload Format Migration** is implemented as one or more **Adjacent Migration Steps**.
- A **Migration Chain** applies all missing **Adjacent Migration Steps** in order.
- The default **Migration Support Window** includes every released schema version.
- Shrinking the **Migration Support Window** is an explicit documented choice, not an accident.
- A **Migration Engine** is shared across versioned artifacts.
- A **Migration Policy** is artifact-specific and sits above the **Migration Engine**.
- Payload migration owns payload container shape only and uses **Nested Identity Migration** for embedded public identities.
- Home migration owns home container/state shape only, uses **Nested Identity Migration** for embedded public identities, and keeps alias-map evolution local.
- The CLI runs one global **Home Migration Preflight** before any command-specific logic.
- Payload commands share one **Payload Migration Preflight** before business logic runs.
- A versioned artifact should expose a **Schema Version Marker** so migration routing is deterministic.
- Payload `schemaVersion` lives only inside the encrypted envelope and is not duplicated in plaintext wrapper metadata.
- A **Hard-Break Policy Table** exists per artifact, defaults to allow, and is used only for intentional de-support decisions.
- A read operation may use an **In-Memory Migration** but must not perform a **Persistent Migration**.
- A write operation may require a **Persistent Migration** before mutation.
- A **Payload Update** may perform both **Payload Self Refresh** and **Payload Format Migration**.
- In interactive mode, a readable-but-outdated payload read completes using **In-Memory Migration** and then emits warning/remediation without prompting for update.
- In headless mode, a readable-but-outdated payload read completes using **In-Memory Migration**, emits warning/remediation on `stderr`, and never prompts.
- In interactive mode, a readable-but-outdated payload write requires explicit acceptance before persistent payload migration; on acceptance it migrates then continues, otherwise it aborts without mutation.
- In headless mode, a readable-but-outdated payload write hard-fails with remediation and never auto-migrates or partially executes the original write intent.
- Explicit payload update is idempotent and reports which rewrite reasons it handled, or reports that no update was needed.
- An unsupported newer payload version hard-fails every payload command kind and always remediates by updating the CLI, not the payload.
- A **Compatibility Gate** fails when runtime support is older than the encountered version.
- **Home State** is **Managed State**.
- **Payload Envelope** is a **User-Managed Resource**.
- The CLI may auto-migrate **Managed State** on any command.
- The CLI must not auto-rewrite a **User-Managed Resource** during read operations.

## Example dialogue

> **Dev:** "If an old payload schema can still be understood, do we rewrite it during `load`?"
> **Domain expert:** "No. `load` may use an **In-Memory Migration**, but persistent rewrite stays an explicit **Payload Update** because the payload is a **User-Managed Resource**."
>
> **Dev:** "Do we branch read logic by artifact version forever?"
> **Domain expert:** "No. A **Migration Pipeline** first normalizes the artifact into the current runtime shape, then normal read logic runs."
>
> **Dev:** "Can the CLI migrate to some requested older schema version?"
> **Domain expert:** "No. It only normalizes into the **Current Runtime Shape** of the running CLI."
>
> **Dev:** "If CLI v3 opens a payload on schema v1, do we need a direct `v1 -> v3` migration?"
> **Domain expert:** "No. We author **Adjacent Migration Steps** only, then the runtime runs one **Migration Chain**: `v1 -> v2 -> v3`."
>
> **Dev:** "Is the versioned identity thing just the import string?"
> **Domain expert:** "No. The canonical thing is the **Identity Snapshot**. The **Identity String** is only one encoding of it."
>
> **Dev:** "Do home identities, payload recipients, and identity strings each version themselves separately?"
> **Domain expert:** "Prefer no. They should reuse one canonical **Identity Snapshot** and add container-specific fields only where needed."
>
> **Dev:** "Can a payload recipient become a known identity automatically when first seen?"
> **Domain expert:** "Not in MVP. If the payload recipient matches an existing **Known Identity** and carries a newer snapshot, update that known identity silently. Unknown payload recipients stay transient for the current command until a future import-from-payload flow exists."
>
> **Dev:** "Then where does the user-scoped alias live?"
> **Domain expert:** "In a separate **Local Alias Map** under home state, not inside the shared public identity shape."
>
> **Dev:** "What key should the local alias map use?"
> **Domain expert:** "**Owner Id**, because alias should survive both key rotation and rename."
>
> **Dev:** "Should handle be stored in the public identity snapshot?"
> **Domain expert:** "No. It is a **Derived Handle** computed from display name and owner id."
>
> **Dev:** "Should fingerprint be stored in the public identity snapshot?"
> **Domain expert:** "No. It is a **Derived Fingerprint** computed from public key."
>
> **Dev:** "Does self identity get a different public shape than everyone else?"
> **Domain expert:** "No. **Self Identity** embeds the same **Public Identity Snapshot** and only adds local/private fields around it."
>
> **Dev:** "How should known identities live in home state?"
> **Domain expert:** "As **Public Identity Snapshot** records keyed by **Owner Id**, with aliases stored separately in the **Local Alias Map**."
>
> **Dev:** "Should self identity still store handle and fingerprint explicitly?"
> **Domain expert:** "No. Persisted **Self Identity** stores the same **Public Identity Snapshot** and only adds local/private fields."
>
> **Dev:** "Does payload migration also define identity evolution rules for recipients?"
> **Domain expert:** "No. Payload migration owns payload shape only and delegates embedded recipient upgrades through **Nested Identity Migration**."
>
> **Dev:** "And home migration follows the same rule?"
> **Domain expert:** "Yes. Home migration owns home shape only, reuses **Nested Identity Migration** for embedded public identities, and keeps alias-map evolution local."
>
> **Dev:** "Do payload commands decide migration status independently?"
> **Domain expert:** "No. They all start from the same **Payload Migration Preflight**, then command policy decides read, write, or update behavior."
>
> **Dev:** "When does home migration happen?"
> **Domain expert:** "First. The CLI runs **Home Migration Preflight** before any other command logic so all later I/O sees compatible managed state."
>
> **Dev:** "Why does a payload need a version field if the CLI already knows all migrations?"
> **Domain expert:** "Because the CLI still needs one stable **Schema Version Marker** to know where the migration chain starts."
>
> **Dev:** "Should the payload version marker also exist outside the encrypted envelope?"
> **Domain expert:** "No. The payload `schemaVersion` lives only inside the encrypted envelope."
>
> **Dev:** "How do we model intentional support cutoffs later?"
> **Domain expert:** "With one explicit per-artifact **Hard-Break Policy Table** in code. Default is allow."
>
> **Dev:** "How should an interactive read behave when the payload is outdated but still readable?"
> **Domain expert:** "Complete the read with **In-Memory Migration**, then warn. Do not prompt for update."
>
> **Dev:** "And headless read?"
> **Domain expert:** "Same migration behavior, but warning goes to `stderr` and there is never any prompt."
>
> **Dev:** "How should an interactive write behave when the payload is outdated but still migratable?"
> **Domain expert:** "Prompt first. If accepted, migrate and continue the write. If refused, abort without mutating the payload."
>
> **Dev:** "And headless write?"
> **Domain expert:** "Hard fail with remediation to run explicit update. Never auto-migrate and never partially execute the original write intent."
>
> **Dev:** "How should explicit `bage update` behave?"
> **Domain expert:** "Idempotent. It reports whether it handled payload format migration, self refresh, both, or nothing."
>
> **Dev:** "What if the payload is newer than this CLI supports?"
> **Domain expert:** "Then every payload command hard-fails and the remediation is always to update the CLI, not the payload."
>
> **Dev:** "Can we drop support for very old released schemas one day?"
> **Domain expert:** "Only by explicitly narrowing the **Migration Support Window** and then hard-failing with remediation."
>
> **Dev:** "Do payload, home, and identity each invent their own migration loop?"
> **Domain expert:** "No. They share one **Migration Engine**. What differs is each artifact's **Migration Policy**."
>
> **Dev:** "Then is `--protocol-version` another schema migration case?"
> **Domain expert:** "No. That is a **Load Protocol** **Compatibility Gate**. It hard fails instead of migrating."

> **Dev:** "What about home files when a newer CLI starts?"
> **Domain expert:** "Those are **Managed State**. The CLI migrates them automatically."

> **Dev:** "Why does `bage update payload` exist if there is only one command?"
> **Domain expert:** "Because one user command can cover both **Payload Self Refresh** and **Payload Format Migration** without asking the user to pick."

## Flagged ambiguities

- "update" currently covers both **Payload Self Refresh** and **Payload Format Migration**. Resolution: keep one user-facing **Payload Update** command, but model the two internal rewrite reasons separately.
- "version" was used for both artifact schema and load contract. Resolution: use **Artifact Schema Version** for persisted/shared artifacts and **Load Protocol** for the external caller contract.
- "read operations should not trigger updates" was ambiguous across payload and home state. Resolution: this restriction applies to **User-Managed Resource** payload rewrites, not to **Managed State** home migration.
- "identity string" was used to mean both one import/export encoding and the broader reusable identity representation. Resolution: use **Identity Snapshot** for the canonical versioned entity shape and **Identity String** for one serialized encoding of it.
- "payload recipient as projection" conflicted with lossless promotion into known identities. Resolution: payload recipients, identity strings, and known identities share one **Public Identity Snapshot**; only local alias remains separate in **Local Alias Map**.
- "payload recipients become known automatically" was too broad. Resolution: existing known identities may silently refresh from newer payload recipient snapshots; unknown payload recipients remain transient in MVP and need a future import-from-payload flow.

## Current Target

The current target design is:

- one shared **Migration Engine** with artifact-specific **Migration Policy**
- `Home State` auto-migrates on any CLI run
- payload never auto-rewrites on read; reads may use **In-Memory Migration** only
- one user-facing payload `update` command covering both **Payload Self Refresh** and **Payload Format Migration**
- one canonical **Public Identity Snapshot** shared across identity strings, payload recipients, and known identities
- **Self Identity** embeds that same **Public Identity Snapshot** as its public core
- `/home` known identities are stored as public snapshots keyed by `ownerId`, plus separate alias overlay state
- persisted self identity stores public snapshot + only local/private fields
- payload migration owns payload shape; nested identities reuse shared identity migration
- home migration owns home shape; embedded identities reuse shared identity migration; alias map stays local
- home migration runs as global CLI preflight before any command logic
- payload commands share one preflight state machine before command-specific logic
- payload has one explicit stable schema version marker for deterministic migration routing
- payload schema version marker lives only inside encrypted envelope
- hard-break gate exists as explicit per-artifact policy table, default allow
- interactive readable-outdated payload reads succeed via in-memory migration, then warn only
- headless readable-outdated payload reads succeed via in-memory migration, warn on `stderr`, never prompt
- interactive readable-outdated payload writes prompt, then migrate-and-continue or abort-without-mutation
- headless readable-outdated payload writes hard-fail with remediation, never auto-migrate
- explicit payload update is idempotent and reports handled reasons
- unsupported newer payload version hard-fails all payload commands with update-CLI remediation
- current target persisted public identity fields are:
  - `ownerId`
  - `publicKey`
  - `displayName`
  - `identityUpdatedAt`
- `handle` is derived from `displayName + ownerId`
- `fingerprint` is derived from `publicKey`
- local aliases live in separate home-local state keyed by `ownerId`
