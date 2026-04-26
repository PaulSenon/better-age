# Contributor Guide: Breaking Schema Changes

This guide explains how to ship a breaking persisted-schema change in `better-age` without breaking users.

Use it together with:
- [docs/adr/0001-artifact-migration-architecture.md](./adr/0001-artifact-migration-architecture.md)
- [.llms/projects/5-artifact-versioning-for-migrations/2-ARTIFACT_MIGRATION_ARCHITECTURE_SPEC.md](../.llms/projects/5-artifact-versioning-for-migrations/2-ARTIFACT_MIGRATION_ARCHITECTURE_SPEC.md)

## Current architecture

Versioned persisted artifacts:
- `Home State`
- `Payload Envelope`
- `Identity String`

Shared nested migration concern:
- `Public Identity Snapshot` legacy representations, reused inside home/payload/identity-string migration

Compatibility boundary kept separate:
- `Load Protocol`

Core rules implemented today:
- one shared parser/migration helper module in core
- explicit version marker per persisted artifact
- adjacent steps only
- normalize to current runtime shape only
- support all rebuilt-MVP released versions by default
- intentional support cutoffs must be explicit and documented before removing
  old schema support

Current code entry points:
- artifact schemas, parsers, encoders, and migration helpers:
  `packages/core/src/persistence/ArtifactDocument.ts`
- payload file wrapper parser/formatter:
  `packages/core/src/persistence/PayloadFileEnvelope.ts`
- core command/query behavior:
  `packages/core/src/identity/BetterAgeCore.ts`
- node persistence/crypto adapters:
  `packages/core/src/infra/RealCoreAdapters.ts`
- CLI grammar and flows:
  `packages/cli/src/cli/commandGrammar.ts`,
  `packages/cli/src/cli/runCli.ts`

## First question: which artifact changed?

### Home State

Use when managed CLI-local state changed.

Behavior contract:
- migrated automatically before any command logic
- persisted automatically
- newer unsupported home hard-fails immediately with update-CLI remediation

### Payload Envelope

Use when encrypted payload structure changed.

Behavior contract:
- reads may migrate in memory only
- writes must not mutate until explicit payload update happened
- `bage update <payload>` is the persisted rewrite boundary
- newer unsupported payload hard-fails with update-CLI remediation

### Public Identity Snapshot

Use when the shared public identity representation changed.

Important:
- do not invent parallel identity migration logic inside home or payload
- migrate legacy identity shapes in `ArtifactDocument.ts`
- then let home/payload migrations reuse that

### Identity String

Use when shareable/importable identity encoding changed.

Behavior contract:
- explicit stable version marker in prefix and payload
- decode must reject prefix/payload version mismatch
- older supported versions may normalize to current in memory
- newer unsupported versions hard-fail with update-CLI remediation
- import keeps using canonical public identity after normalization

## Do not skip cleanup

If the current shape is messy, first realign shapes before adding migration steps.

Examples:
- remove derived persisted fields
- move local-only fields out of shared public shape
- unify container shapes around the canonical public identity snapshot

That keeps migration steps smaller and easier to reason about.

## Step-by-step: adding a new schema version

### 1. Change the current schema shape first

Update the canonical runtime schema.

Examples:
- `ArtifactDocument.ts`
- `PayloadFileEnvelope.ts` when the outer payload wrapper changes

Keep runtime shape as the only destination shape. Do not add “target version” options.

### 2. Bump the current version constant

Examples:
- `CURRENT_HOME_SCHEMA_VERSION`
- `CURRENT_PAYLOAD_SCHEMA_VERSION`

Also update the schema literal:
- `homeSchemaVersion: Schema.Literal(...)`
- `version: Schema.Literal(...)`

### 3. Add one adjacent migration step only

If current goes from `2` to `3`, add:
- `2 -> 3`

Do not write:
- `1 -> 3`
- `0 -> 3`

The engine already chains steps in order.

### 4. Keep old schemas explicit

Define legacy schemas alongside the migration definition.

Pattern:
- `LegacyHomeStateV2`
- `LegacyPayloadEnvelopeV2`

Then include them in the versioned union used for decoding historical bytes.

### 5. Register the step in the artifact definition

Add the step to the ordered `steps` array in the artifact migration definition.

Pattern:
- `fromVersion`
- `toVersion`
- `migrate`

The shared engine will:
- read current artifact version
- reject newer unsupported versions
- reject explicit support cutoffs, if one exists
- walk adjacent steps until current

### 6. Reuse nested identity migration instead of duplicating it

If a home or payload change includes embedded identity snapshots:
- keep container migration in the home/payload file
- reuse shared public identity helpers from `ArtifactDocument.ts`

Do not let payload/home own public-identity evolution rules.

### 7. Preserve artifact policy behavior

Schema steps are not enough. Keep the policy contract intact.

Home:
- preflight auto-migrates and persists

Payload read:
- migrate in memory only
- complete read
- warn after success

Payload write:
- block on outdated payload
- require explicit update first

Payload update:
- persist format migration
- persist self refresh if needed
- remain idempotent

If behavior changes, update:
- `BetterAgeCore.ts`
- `runCli.ts`
- payload write command tests

## Intentional support cutoffs

Default rule:
- all released versions remain migratable

Only de-support an old version by explicit code and documentation.

Do not remove legacy schema support “because tests still pass”. That creates accidental cutoffs.

## Tests you must update

Minimum required coverage for any breaking schema change:

### Artifact migration definition tests

Update or add:
- `packages/core/src/persistence/ArtifactDocument.test.ts`
- `packages/core/src/persistence/PayloadFileEnvelope.test.ts`

Must prove:
- current version stays current
- previous released version migrates
- oldest supported version still multi-hop migrates
- explicit support cutoff, if introduced, flips migratable old versions into failure
- unsupported newer stays distinct from intentionally unsupported old

### Preflight tests

Update:
- `packages/core/src/identity/BetterAgeCore.test.ts`
- `packages/core/src/identity/BetterAgeCore.payload.test.ts`

Must prove:
- correct artifact classification
- correct runtime normalization
- correct persistence vs in-memory-only behavior

### Command/app tests

Update whichever boundary is affected:
- read commands
- `bage update`
- edit/grant/revoke mutation gates
- interactive flows
- headless commands

Must prove:
- read/write behavior contract unchanged
- no partial mutation after a blocked write
- correct remediation messages

### Integration tests

Keep these green:
- `packages/core/test/integration/**/*.integration.test.ts`
- package-local unit tests affected by CLI rendering or command behavior

These catch shape drift that unit tests can miss.

## Required command checklist before merging

Run:

```sh
pnpm -F @better-age/core check
pnpm -F @better-age/core test
pnpm -F @better-age/cli check
pnpm -F @better-age/cli test
```

Do not stop at unit tests only.

`test` includes integration coverage.

## Contributor checklist

Before merging a breaking schema change, confirm all are true:

- artifact boundary is correct
- current runtime schema is updated
- version literal and current-version constant are bumped
- exactly one adjacent migration step was added
- legacy schema union still decodes all supported released versions
- nested public identity changes were delegated to shared identity migration
- no accidental support cutoff was introduced
- home vs payload policy behavior still matches contract
- definition tests cover current, oldest supported, multi-hop, support cutoff,
  unsupported-newer
- app/command tests cover user-facing behavior changes
- `pnpm -F @better-age/cli check` passes
- `pnpm -F @better-age/cli test` passes
- `pnpm -F @better-age/core check` passes
- `pnpm -F @better-age/core test` passes

## Current target shapes

### Public Identity Snapshot

Persisted fields:
- `ownerId`
- `publicKey`
- `displayName`
- `identityUpdatedAt`

Derived only:
- `handle`
- `fingerprint`

### Home known identities

Persist:
- public identity snapshots
- local alias overlay data keyed by `ownerId` semantics

### Self identity

Persist:
- `ownerId`
- `displayName`
- `identityUpdatedAt`
- current key metadata, including `encryptedPrivateKeyRef`
- retired key metadata
- preferences

### Payload recipients

Persist:
- same public identity core as above

## Bad patterns to avoid

- inferring version from shape
- writing direct `v1 -> v3` migrations
- adding downgrade support
- auto-rewriting payloads during reads
- duplicating public identity migration logic inside payload/home
- silently dropping support for an old released version
- storing derived public fields just for convenience

## Rule of thumb

If the change mutates bytes users own, be explicit.

If the change mutates managed CLI-local state, do it in home preflight.
