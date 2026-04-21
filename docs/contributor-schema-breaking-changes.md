# Contributor Guide: Breaking Schema Changes

This guide explains how to ship a breaking persisted-schema change in `better-age` without breaking users.

Use it together with:
- [docs/adr/0001-artifact-migration-architecture.md](./adr/0001-artifact-migration-architecture.md)
- [.llms/projects/5-artifact-versioning-for-migrations/2-ARTIFACT_MIGRATION_ARCHITECTURE_SPEC.md](../.llms/projects/5-artifact-versioning-for-migrations/2-ARTIFACT_MIGRATION_ARCHITECTURE_SPEC.md)

## Current architecture

Versioned persisted artifacts:
- `Home State`
- `Payload Envelope`
- `Public Identity Snapshot` legacy representations, reused inside home/payload migration

Compatibility boundary kept separate:
- `Load Protocol`

Core rules implemented today:
- one shared migration engine
- explicit version marker per persisted artifact
- adjacent steps only
- normalize to current runtime shape only
- support all released versions by default
- intentional support cutoffs only through explicit hard-break policy

Current code entry points:
- shared engine: `packages/cli/src/domain/migration/ArtifactMigration.ts`
- home migration definition: `packages/cli/src/domain/home/HomeStateMigration.ts`
- payload migration definition: `packages/cli/src/domain/payload/PayloadEnvelopeMigration.ts`
- shared legacy identity adapters: `packages/cli/src/domain/identity/PublicIdentityMigration.ts`
- home preflight: `packages/cli/src/app/shared/HomeStatePreflight.ts`
- payload read preflight: `packages/cli/src/app/shared/OpenPayload.ts`
- explicit payload update boundary: `packages/cli/src/app/update-payload/UpdatePayload.ts`

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
- migrate legacy identity shapes in `PublicIdentityMigration.ts`
- then let home/payload migrations reuse that

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
- `HomeState.ts`
- `PayloadEnvelope.ts`
- `PublicIdentity.ts`

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
- reject explicit hard-broken versions
- walk adjacent steps until current

### 6. Reuse nested identity migration instead of duplicating it

If a home or payload change includes embedded identity snapshots:
- keep container migration in the home/payload file
- reuse helpers from `PublicIdentityMigration.ts`

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
- `OpenPayload.ts`
- `UpdatePayload.ts`
- payload write flows/commands

## Hard-break policy

Default rule:
- all released versions remain migratable

Only de-support an old version by explicit policy.

Shared policy shape lives in:
- `ArtifactMigrationPolicy`

Current knobs:
- `hardBreakAtOrBelowVersion`
- `hardBreakVersions`

Use this only when you intentionally want:
- old version to stop migrating
- hard failure with explicit remediation

Do not remove legacy schema support “because tests still pass”. That creates accidental cutoffs.

## Tests you must update

Minimum required coverage for any breaking schema change:

### Artifact migration definition tests

Update or add:
- `HomeStateMigration.test.ts`
- `PayloadEnvelopeMigration.test.ts`

Must prove:
- current version stays current
- previous released version migrates
- oldest supported version still multi-hop migrates
- explicit hard-break policy flips migratable old versions into failure
- unsupported newer stays distinct from hard-broken old

### Preflight tests

Update:
- `HomeStatePreflight.test.ts`
- `ReadPayload.test.ts`
- `OpenPayload.test.ts`

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
- `test/integration/create-user-identity/CreateUserIdentity.integration.test.ts`
- `test/integration/payload-crypto/PayloadAgeCrypto.integration.test.ts`

These catch shape drift that unit tests can miss.

## Required command checklist before merging

Run:

```sh
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
- no accidental hard-break was introduced
- home vs payload policy behavior still matches contract
- definition tests cover current, oldest supported, multi-hop, hard-break, unsupported-newer
- app/command tests cover user-facing behavior changes
- `pnpm -F @better-age/cli check` passes
- `pnpm -F @better-age/cli test` passes

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
- local alias map keyed by `ownerId`

### Self identity

Persist:
- `publicIdentity`
- `privateKeyPath`
- `createdAt`
- `keyMode`

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
