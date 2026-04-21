# Better Secrets Artifact Versioning and Migration PRD

## Technical Spec

### Related Documents

This PRD should be read alongside the existing `better-age` documents that define the broader product, UX, machine contract, and current package language.

Core product docs: (at packages/cli/.llms/projects , packages/cli, and project root)
- [BETTER_AGE_V0_PRD.md](2-BETTER_AGE_V0_PRD.md)
- [BETTER_AGE_V0_SPEC.md](1-BETTER_AGE_V0_SPEC.md)
- [BETTER_AGE_UX_PRD.md](1-BETTER_AGE_UX_PRD.md)
- [BETTER_AGE_EFFECT_BASE_PRD.md](1-BETTER_AGE_EFFECT_BASE_PRD.md)
- [VARLOCK_PRD.md](VARLOCK_PRD.md)

Rationale / design-history docs:
- [GRILL_ME_V0_SPECS.md](0-GRILL_ME_V0_SPECS.md)
- [GRILL_ME_UX.md](0-GRILL_ME_UX.md)
- [GRILL_ME_AUDIT_EFFECT.md](0-GRILL_ME_AUDIT_EFFECT.md)
- [GRILL_ME_VARLOCK.md](0-GRILL_ME_VARLOCK.md)
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)

Current package-level docs:
- [VISION.md](VISION.md)
- [README.md](README.md)
- [CONTEXT.md](CONTEXT.md)
- [INTERACTION_FLOW_SPEC.md](1-INTERACTION_FLOW_SPEC.md)
- [ERROR_HANDLING_SOURCE_OF_TRUTH.md](2-ERROR_HANDLING_SOURCE_OF_TRUTH.md)
- [ERROR_MESSAGE_SPEC.md](1-ERROR_MESSAGE_SPEC.md)

How this PRD fits:
- it does not replace the broader v0 or UX PRDs
- it specializes the artifact compatibility and migration contract underneath them
- where this PRD conflicts with older persistence assumptions, this PRD should win for artifact versioning behavior

### Context

`better-age` currently versions some contracts, but not through one uniform migration boundary:
- `load --protocol-version=1` is explicit and caller-owned
- `home state` has `homeSchemaVersion`, but current decode accepts only latest shape
- `payload envelope` has `version`, but current decode accepts only latest shape
- `identity string` has `v1` prefix and payload literal, but no generic migration engine exists

That creates the main product gap:
- newer CLI cannot smoothly open older persisted artifacts unless they already match latest schema
- mutating and non-mutating commands do not share one migration contract
- “schema outdated” is partly modeled at product level but not yet enforced at the persistence boundary consistently

### Goal

Ship one uniform artifact versioning system for all persisted `better-age` contracts:
- `home state`
- `payload`
- `identity string`
- `load protocol` remains versioned separately as machine caller contract

Rules:
- any artifact ever written by a released CLI should remain readable by newer CLIs
- all known old artifact versions should migrate forward to latest
- future/unknown versions should fail explicitly
- an explicit hard-break gate must exist but default to “allow”
- `home state` migrates automatically before any command logic
- old payloads may be read through in-memory migration, but persisted payload migration remains explicit before mutation
- old identity strings should import gracefully forever

### Non-Goals

- backward compatibility with future newer artifacts from older CLIs
- recovery from corrupted JSON/text pretending to be valid old schema
- package-semver-based compatibility
- silent payload rewrites during machine-oriented flows
- per-command bespoke migration logic

### Canonical Terms

**Artifact**:
A persisted contract with its own version line and migration policy.

**Artifact Version**:
The schema version carried inside one artifact. Not package semver.

**Current Artifact Version**:
The latest schema version this CLI writes for that artifact.

**Legacy Artifact**:
An artifact with an older schema version still known to this CLI.

**Future Artifact**:
An artifact with a schema version newer than this CLI knows.

**Hard Break Gate**:
An explicit policy check that may block a known historical version even if a migration exists.

**In-Memory Migration**:
Migration to latest domain shape without immediately rewriting persisted bytes.

**Persisted Migration**:
Migration followed by rewrite of the artifact in latest schema.

### Artifacts and Policies

| Artifact | Version field | Open old with new | Persist automatically | Notes |
| --- | --- | --- | --- | --- |
| Home state | `homeSchemaVersion: number` | Yes | Yes | Must happen before any command behavior |
| Payload envelope | `version: number` | Yes | No, except explicit update gate before mutation | Reads may use in-memory migrated shape |
| Identity string | prefix + payload `version` | Yes | N/A | Import old forever, export latest only |
| Load protocol | `--protocol-version=<n>` | No | N/A | Machine caller compatibility, not persistence |

### Behavioral Rules

#### Home State

- Every command that touches `HomeRepository` must load through the migration engine.
- If state is legacy but migratable:
  - decode exact historical schema
  - migrate to latest
  - persist latest atomically
  - continue command
- If state is future:
  - fail explicit: CLI too old for this state
- If state is hard-blocked:
  - fail explicit with reason
- If state is corrupted:
  - fail explicit as invalid persisted state

#### Payload

- Opening payload must not decode directly to latest schema.
- Open flow must:
  - decrypt
  - inspect version
  - decode exact historical schema
  - migrate in memory to latest domain envelope
  - return migration metadata
- Read-only commands:
  - `inspect`: allowed on legacy payloads, reports `needsMigration`
  - `view`: allowed on legacy payloads, reports `needsMigration`
  - `load`: allowed on legacy payloads only if migrated envelope can be read safely in memory and no explicit policy says otherwise; must still fail if command contract requires persisted update first
- Mutating commands:
  - `edit`
  - `grant`
  - `revoke`
  - any future payload write path
  must require persisted migration before mutation
- `update` is the explicit persisted migration boundary for payload schema + self-recipient refresh

#### Identity String

- Import path must support all known historical identity string versions
- Import path must:
  - parse prefix
  - parse version
  - decode exact historical payload shape
  - migrate in memory to latest domain identity snapshot
- Export path always emits latest format only

#### Load Protocol

- Remains separate from artifact migration
- CLI may read old payloads through in-memory migrated envelope
- caller still must present supported `--protocol-version`
- future protocol version from caller fails explicitly

### State Model

Each open/decode operation should resolve to one of four states:

1. `current`
2. `legacy-migrated-in-memory`
3. `legacy-migrated-and-persisted`
4. `unsupported`

`unsupported` covers:
- future version
- hard-blocked known version
- unknown version not in registry
- invalid bytes for claimed version

### Uniform Engine

Use one explicit engine per artifact kind, not ad hoc command logic.

```ts
export type ArtifactKind =
  | "home-state"
  | "payload"
  | "identity-string"

export type MigrationStatus =
  | "current"
  | "legacy-migrated-in-memory"
  | "legacy-migrated-and-persisted"

export type OpenArtifactResult<A, V extends number | string> = {
  readonly artifact: ArtifactKind
  readonly status: MigrationStatus
  readonly fromVersion: V
  readonly toVersion: V
  readonly value: A
}

export type VersionPolicy<V extends number | string> = {
  readonly isHardBlocked: (version: V) => boolean
  readonly explainHardBlock: (version: V) => string
}

export type VersionedArtifactRegistry<
  EncodedLatest,
  DomainLatest,
  V extends number | string,
  Historical
> = {
  readonly artifact: ArtifactKind
  readonly currentVersion: V
  readonly decodeVersionHeader: (raw: unknown) => Effect.Effect<V, ArtifactDecodeError>
  readonly decodeKnownVersion: (
    version: V,
    raw: unknown,
  ) => Effect.Effect<Historical, ArtifactDecodeError>
  readonly migrateToLatest: (
    value: Historical,
  ) => Effect.Effect<EncodedLatest, ArtifactMigrationError>
  readonly toDomain: (
    value: EncodedLatest,
  ) => Effect.Effect<DomainLatest, ArtifactMigrationError>
  readonly encodeLatest: (
    value: EncodedLatest,
  ) => Effect.Effect<unknown, ArtifactEncodeError>
  readonly policy: VersionPolicy<V>
}
```

### Registry Pattern

Keep:
- versioned persisted schemas in `persisted/`
- versionless domain types in domain modules
- one-step migration functions only

Do not keep:
- direct `v1 -> v7` migrations
- domain types with embedded historical version unions
- “latest only” decode in repositories

```ts
export const CURRENT_HOME_SCHEMA_VERSION = 3 as const

export const HomeStateV1 = Schema.Struct({
  homeSchemaVersion: Schema.Literal(1),
  knownIdentities: Schema.Array(HomeKnownIdentityV1),
  retiredKeys: Schema.Array(RetiredKeyV1),
  self: Schema.NullOr(SelfIdentityV1),
})

export const HomeStateV2 = Schema.Struct({
  homeSchemaVersion: Schema.Literal(2),
  activeKeyFingerprint: Schema.NullOr(KeyFingerprint),
  knownIdentities: Schema.Array(HomeKnownIdentityV2),
  retiredKeys: Schema.Array(RetiredKeyV2),
  self: Schema.NullOr(SelfIdentityV2),
})

export const HomeStateV3 = Schema.Struct({
  homeSchemaVersion: Schema.Literal(3),
  activeKeyFingerprint: Schema.OptionFromNullOr(KeyFingerprint),
  defaultEditorCommand: Schema.OptionFromNullOr(Schema.String),
  knownIdentities: Schema.Array(KnownIdentity),
  retiredKeys: Schema.Array(RetiredKey),
  rotationTtl: RotationTtl,
  self: Schema.OptionFromNullOr(SelfIdentity),
})

export type HomeStatePersisted =
  | Schema.Schema.Type<typeof HomeStateV1>
  | Schema.Schema.Type<typeof HomeStateV2>
  | Schema.Schema.Type<typeof HomeStateV3>

const migrateHomeStateV1ToV2 = (
  v1: Schema.Schema.Type<typeof HomeStateV1>,
): Schema.Schema.Type<typeof HomeStateV2> => ({
  homeSchemaVersion: 2,
  activeKeyFingerprint: null,
  knownIdentities: v1.knownIdentities.map(migrateKnownIdentityV1ToV2),
  retiredKeys: v1.retiredKeys.map(migrateRetiredKeyV1ToV2),
  self: v1.self === null ? null : migrateSelfIdentityV1ToV2(v1.self),
})

const migrateHomeStateV2ToV3 = (
  v2: Schema.Schema.Type<typeof HomeStateV2>,
): Schema.Schema.Type<typeof HomeStateV3> => ({
  homeSchemaVersion: 3,
  activeKeyFingerprint: Option.fromNullable(v2.activeKeyFingerprint),
  defaultEditorCommand: Option.none(),
  knownIdentities: v2.knownIdentities,
  retiredKeys: v2.retiredKeys,
  rotationTtl: "3m",
  self: Option.fromNullable(v2.self),
})
```

### Header-First Decode

Prefer version-header-first decode over giant union decode.

Reason:
- cleaner future-version detection
- cleaner hard-break gate
- clearer error messages
- easier command behavior branching

```ts
const HomeStateVersionHeader = Schema.Struct({
  homeSchemaVersion: Schema.Number,
})

const decodeHomeStateVersion = (raw: unknown) =>
  Schema.decodeUnknown(HomeStateVersionHeader)(raw).pipe(
    Effect.map(({ homeSchemaVersion }) => homeSchemaVersion),
    Effect.mapError(
      () =>
        new ArtifactDecodeError({
          artifact: "home-state",
          message: "Persisted home state is missing a valid schema version",
        }),
    ),
  )

const decodeKnownHomeState = (version: number, raw: unknown) => {
  switch (version) {
    case 1:
      return Schema.decodeUnknown(HomeStateV1)(raw)
    case 2:
      return Schema.decodeUnknown(HomeStateV2)(raw)
    case 3:
      return Schema.decodeUnknown(HomeStateV3)(raw)
    default:
      return Effect.fail(
        new ArtifactUnsupportedVersionError({
          artifact: "home-state",
          message: `Unsupported home state schema version: ${version}`,
        }),
      )
  }
}
```

### Migration Chaining

```ts
const migrateHomeStateToLatest = (
  state: HomeStatePersisted,
): Schema.Schema.Type<typeof HomeStateV3> => {
  switch (state.homeSchemaVersion) {
    case 1:
      return migrateHomeStateV2ToV3(migrateHomeStateV1ToV2(state))
    case 2:
      return migrateHomeStateV2ToV3(state)
    case 3:
      return state
  }
}
```

### Repository Boundary Example

```ts
const loadState = Effect.tryPromise({
  try: async () => {
    try {
      return await fs.readFile(location.stateFile, "utf8")
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null
      }
      throw error
    }
  },
  catch: () =>
    new HomeStateLoadError({
      message: "Failed to load home state",
      stateFile: location.stateFile,
    }),
}).pipe(
  Effect.flatMap((json) =>
    json === null
      ? Effect.succeed(emptyHomeState())
      : openAndMaybePersistHomeState({
          rawJson: json,
          stateFile: location.stateFile,
          persistLatest: writeFileAtomically,
        }),
  ),
)
```

Where `openAndMaybePersistHomeState`:
- parses JSON
- reads version header
- rejects future/hard-blocked versions
- decodes exact version
- migrates to latest persisted shape
- persists latest if migrated
- returns latest domain `HomeState`

### Payload Open Boundary Example

```ts
export type OpenPayloadEnvelopeResult = {
  readonly envelope: PayloadEnvelope
  readonly migration: {
    readonly status: "current" | "legacy-migrated-in-memory"
    readonly fromVersion: number
    readonly toVersion: number
    readonly needsPersistedMigration: boolean
  }
}

const openPayloadEnvelope = (decrypted: unknown) =>
  Effect.gen(function* () {
    const version = yield* decodePayloadEnvelopeVersion(decrypted)
    const persisted = yield* decodeKnownPayloadEnvelope(version, decrypted)
    const latest = yield* migratePayloadEnvelopeToLatest(persisted)
    const envelope = yield* toDomainPayloadEnvelope(latest)

    return {
      envelope,
      migration: {
        status:
          version === CURRENT_PAYLOAD_SCHEMA_VERSION
            ? "current"
            : "legacy-migrated-in-memory",
        fromVersion: version,
        toVersion: CURRENT_PAYLOAD_SCHEMA_VERSION,
        needsPersistedMigration:
          version !== CURRENT_PAYLOAD_SCHEMA_VERSION,
      },
    } satisfies OpenPayloadEnvelopeResult
  })
```

### Command Behavior Matrix

| Command | Auto-migrate home state | Read old payload in memory | Require persisted payload migration first | Auto-persist payload |
| --- | --- | --- | --- | --- |
| `setup` | Yes | N/A | N/A | N/A |
| `me` | Yes | N/A | N/A | N/A |
| `add-identity` | Yes | N/A | N/A | N/A |
| `identities` | Yes | N/A | N/A | N/A |
| `rotate` | Yes | N/A | N/A | N/A |
| `change-passphrase` | Yes | N/A | N/A | N/A |
| `inspect` | Yes | Yes | No | No |
| `view` | Yes | Yes | No | No |
| `load` | Yes | Yes, if readable after in-memory migration | Product policy decides whether update required before machine load | No |
| `update` | Yes | Yes | No, this command is the migration boundary | Yes |
| `edit` | Yes | Yes | Yes | Only after explicit accept/update |
| `grant` | Yes | Yes | Yes | Only after explicit accept/update |
| `revoke` | Yes | Yes | Yes | Only after explicit accept/update |

Recommended product rule for `load`:
- allow decrypt + in-memory schema migration
- if legacy payload also needs persisted update for contract reasons, fail with explicit remediation
- do not silently rewrite payload in machine path

### User-Facing Command Semantics

#### `inspect`
- legacy payload opens
- metadata shown from migrated-in-memory envelope
- output includes `payload schema is outdated` or equivalent
- no rewrite

#### `view`
- legacy payload opens
- secure viewer shows migrated-in-memory content
- warning indicates payload should be updated
- no rewrite

#### `load`
- old payload may open through in-memory migration
- if machine contract says persisted update required before load, fail explicit
- never auto-run payload update
- never auto-rewrite payload

#### `edit` / `grant` / `revoke`
- if payload is legacy:
  - prompt: payload must be migrated before continuing
  - if accept:
    - run persisted payload migration/update first
    - continue original command
  - if decline:
    - stop cleanly

### Error Taxonomy

```ts
export class ArtifactDecodeError extends Schema.TaggedError<ArtifactDecodeError>()(
  "ArtifactDecodeError",
  {
    artifact: Schema.Literal("home-state", "payload", "identity-string"),
    message: Schema.String,
  },
) {}

export class ArtifactUnsupportedVersionError extends Schema.TaggedError<ArtifactUnsupportedVersionError>()(
  "ArtifactUnsupportedVersionError",
  {
    artifact: Schema.Literal("home-state", "payload", "identity-string"),
    foundVersion: Schema.Union(Schema.Number, Schema.String),
    message: Schema.String,
  },
) {}

export class ArtifactHardBreakError extends Schema.TaggedError<ArtifactHardBreakError>()(
  "ArtifactHardBreakError",
  {
    artifact: Schema.Literal("home-state", "payload", "identity-string"),
    foundVersion: Schema.Union(Schema.Number, Schema.String),
    message: Schema.String,
  },
) {}

export class ArtifactMigrationError extends Schema.TaggedError<ArtifactMigrationError>()(
  "ArtifactMigrationError",
  {
    artifact: Schema.Literal("home-state", "payload", "identity-string"),
    fromVersion: Schema.Union(Schema.Number, Schema.String),
    toVersion: Schema.Union(Schema.Number, Schema.String),
    message: Schema.String,
  },
) {}
```

User-facing guidance:
- future version:
  - `Payload schema version 5 is newer than this CLI supports`
  - `Update better-age to a compatible version.`
- hard break:
  - `Home state schema version 1 is no longer supported by this CLI`
  - `<reason>`
- invalid:
  - `Persisted home state did not match schema version 2`

### Hard-Break Gate

Default policy: allow all historical known versions.

Implementation:

```ts
const defaultHomeStatePolicy: VersionPolicy<number> = {
  isHardBlocked: () => false,
  explainHardBlock: () => "This schema version is blocked by policy",
}
```

If a future emergency hard break is needed:
- add exact blocked version(s)
- keep failure explicit
- do not silently reinterpret

### File Structure Example

```txt
packages/cli/src/
  artifact/
    shared/
      ArtifactVersionError.ts
      ArtifactVersionPolicy.ts
      MigrationEngine.ts
      MigrationTypes.ts

    home-state/
      HomeStateDomain.ts
      HomeStateOpen.ts
      HomeStatePersist.ts
      persisted/
        HomeStateV1.ts
        HomeStateV2.ts
        HomeStateV3.ts
        decodeHomeStateVersion.ts
        homeStateRegistry.ts
        migrateHomeStateV1ToV2.ts
        migrateHomeStateV2ToV3.ts
      __tests__/
        HomeStateOpen.test.ts
        HomeStateMigrationFixtures.test.ts

    payload/
      PayloadEnvelopeDomain.ts
      PayloadEnvelopeOpen.ts
      PayloadEnvelopePersist.ts
      persisted/
        PayloadEnvelopeV1.ts
        PayloadEnvelopeV2.ts
        decodePayloadEnvelopeVersion.ts
        payloadRegistry.ts
        migratePayloadEnvelopeV1ToV2.ts
      __tests__/
        PayloadEnvelopeOpen.test.ts
        PayloadEnvelopeMigrationFixtures.test.ts

    identity-string/
      IdentityStringDomain.ts
      IdentityStringOpen.ts
      IdentityStringPersist.ts
      persisted/
        IdentityStringV1.ts
        IdentityStringV2.ts
        decodeIdentityStringVersion.ts
        identityStringRegistry.ts
        migrateIdentityStringV1ToV2.ts
      __tests__/
        IdentityStringOpen.test.ts
        IdentityStringMigrationFixtures.test.ts

  domain/
    home/
      HomeState.ts
    identity/
      Identity.ts
      IdentityString.ts
    payload/
      PayloadEnvelope.ts

  infra/
    fs/
      nodeHomeRepository.ts
      nodePayloadRepository.ts

  app/
    shared/
      OpenPayload.ts
    update-payload/
      UpdatePayload.ts
```

Module ownership:
- `artifact/*/persisted/*`: historical encoded shapes + migration pipeline
- `domain/*`: latest versionless domain types only
- `infra/*Repository*`: call migration engine, never hand-roll version logic
- `app/*`: consume migration metadata, enforce command policy

### Test Matrix

Each artifact needs:
- one fixture for every released historical version
- one `future version` fixture
- one `invalid/corrupted` fixture

Per artifact assertions:
- exact-version decode works
- migration chain reaches latest
- latest encode/decode roundtrip works
- future version fails explicit
- hard-block gate fails explicit
- corrupted data fails explicit

Command assertions:
- every command auto-migrates home state first
- `inspect` reads legacy payload without rewrite
- `view` reads legacy payload without rewrite
- `edit` prompts for payload migration before mutation
- `grant` prompts for payload migration before mutation
- `revoke` prompts for payload migration before mutation
- identity import accepts all historical versions
- identity export emits latest only

### External References

Official Effect references used for the shape of the schema/migration approach:
- Effect Schema `Union`: https://effect-ts.github.io/effect/effect/Schema.ts.html#union-interface
- Effect Schema `transformOrFail`: https://effect-ts.github.io/effect/effect/Schema.ts.html#transformorfail-interface
- Effect Schema API overview: https://effect-ts.github.io/effect/effect/Schema.ts.html

## PRD

## Problem Statement

`better-age` needs a durable compatibility model for all persisted contracts.

The current product direction already assumes explicit versioning and long-lived local artifacts:
- users rotate keys locally and still expect old payload access to remain legible
- payloads move between machines and across CLI upgrades
- identity strings may outlive the CLI version that produced them
- `load` already treats machine compatibility as an explicit protocol boundary

The missing piece is a single artifact migration system.

Without it:
- a newer CLI may fail on an older but otherwise valid artifact
- command behavior drifts between home state, payloads, and identity strings
- migration policy is not obvious to users or maintainers
- future breaking changes become riskier because each new schema change requires bespoke handling

The problem is not “how to version one file”. The problem is:
- define artifact-specific version lines clearly
- support all historical released versions by default
- preserve explicit mutation rules
- keep older artifacts readable by newer CLIs
- fail explicitly on future or intentionally blocked versions

## Solution

Introduce a first-class artifact versioning and migration subsystem for `better-age`.

This subsystem versions four contracts independently:
- home state schema
- payload schema
- identity string schema
- machine load protocol

The product behavior becomes:
- every command auto-migrates legacy home state before doing anything else
- read-oriented payload commands may open old payloads through in-memory migration and warn that update is needed
- payload-mutating commands require explicit persisted payload migration before continuing
- importing old identity strings always works when the version is historically known
- exporting identity strings always uses the latest version
- future artifact versions fail explicitly with compatibility guidance
- a hard-break gate exists for emergency cases but remains off by default

This keeps the CLI honest:
- `home state` migration is automatic because it is local internal state
- `payload` migration remains explicit before mutation because payload bytes are caller-owned
- `identity string` migration is transparent because import is already a translation boundary
- `load protocol` remains a separate machine compatibility contract

## User Stories

1. As a developer, I want a newer `better-age` CLI to open any old home state it previously wrote, so that upgrades do not strand my machine.
2. As a developer, I want every command to normalize old home state before doing anything else, so that command behavior stays consistent.
3. As a developer, I want legacy home state to be rewritten automatically to the latest schema, so that my local state converges without manual intervention.
4. As a developer, I want old payloads to remain readable after upgrading the CLI, so that I can still inspect and view secrets from historical files.
5. As a developer, I want `inspect` to read legacy payloads without silently rewriting them, so that payload ownership stays explicit.
6. As a developer, I want `view` to read legacy payloads without silently rewriting them, so that human access does not mutate caller-owned files unexpectedly.
7. As a developer, I want old payloads to clearly report when they need update, so that maintenance is visible.
8. As a developer, I want `edit` to stop and ask for payload migration first when the payload schema is old, so that edits never layer on top of stale structure.
9. As a developer, I want `grant` to stop and ask for payload migration first when the payload schema is old, so that ACL mutation stays structurally safe.
10. As a developer, I want `revoke` to stop and ask for payload migration first when the payload schema is old, so that removal logic runs against the current structural contract.
11. As a developer, I want `update` to be the explicit persisted migration boundary for payload schema changes, so that payload rewrites remain honest and scriptable.
12. As a developer, I want old identity strings to keep importing forever when they are historically known, so that sharing and archival workflows do not break.
13. As a developer, I want importing an old identity string found inside an old payload to work gracefully, so that recipient discovery remains smooth across versions.
14. As a developer, I want newly exported identity strings to use only the latest format, so that the system converges naturally toward current contracts.
15. As a developer, I want future artifact versions to fail explicitly, so that I know I need a newer CLI instead of guessing what went wrong.
16. As a developer, I want corrupted artifacts to fail differently from unsupported versions, so that troubleshooting stays legible.
17. As a developer, I want machine callers to keep using explicit `--protocol-version`, so that automation compatibility remains deliberate.
18. As a developer, I want old payloads to be readable in machine flows only when the command contract allows it, so that machine mutation remains predictable.
19. As a developer, I want no command to silently rewrite payloads just because I read them, so that visible file mutation remains intentional.
20. As a developer, I want home state migration to be atomic, so that interrupted upgrades do not leave my local state half-written.
21. As a developer, I want schema migration messages to name the artifact involved, so that I immediately know whether the issue is local state, payload, or identity import.
22. As a developer, I want a CLI upgraded across many versions to still open my oldest valid artifacts, so that I do not need stepwise upgrade rituals.
23. As a developer, I want historical compatibility support to be the default policy, so that breaking changes remain rare and explicit.
24. As a maintainer, I want artifact versioning handled through one reusable subsystem, so that new schema changes do not create bespoke code paths everywhere.
25. As a maintainer, I want persisted schemas separated from versionless domain models, so that domain logic stays clean and latest-focused.
26. As a maintainer, I want each artifact to own its own version line, so that package semver never becomes a hidden persistence contract.
27. As a maintainer, I want one-step migrations chained to latest, so that migration history remains understandable and testable.
28. As a maintainer, I want a hard-break gate available for emergency or security cases, so that compatibility policy can be tightened explicitly if ever needed.
29. As a maintainer, I want command behavior to depend on migration metadata rather than ad hoc decode failures, so that UX remains coherent.
30. As a maintainer, I want every released schema version covered by fixtures, so that compatibility regressions are caught before release.
31. As a maintainer, I want future-version errors to be normalized across artifacts, so that support and docs stay simpler.
32. As a maintainer, I want payload reads and payload writes to have distinct migration policies, so that caller-owned file semantics stay honest.
33. As a maintainer, I want identity-string compatibility to remain broad and durable, so that shared references age well.
34. As a maintainer, I want repository adapters to stop decoding latest-only schemas directly, so that persistence boundaries become trustworthy.
35. As a maintainer, I want this PRD to freeze the migration contract now, so that future breaking changes extend one known system instead of inventing new ones.

## Implementation Decisions

- Version four contracts independently:
  - home state schema
  - payload schema
  - identity string schema
  - machine load protocol
- Keep machine load protocol separate from persisted artifact migration.
- Support all historically released known artifact versions by default.
- Keep an explicit hard-break gate in code for each artifact version line, defaulting to “allow”.
- Represent persisted historical shapes separately from latest versionless domain models.
- Decode artifact version header first, then decode the exact historical schema for that version.
- Reject future versions explicitly before attempting migration.
- Reject hard-blocked versions explicitly with a user-facing reason.
- Store one-step migrations only and chain them to latest.
- Auto-migrate and auto-persist home state before every command that touches local state.
- Allow read-oriented payload operations to use in-memory migrated envelopes without rewriting payload bytes.
- Require explicit persisted payload migration before any payload mutation continues.
- Treat `update` as the explicit persisted migration boundary for payload schema changes.
- Import all known historical identity string versions and normalize them to the latest identity domain model in memory.
- Export only the latest identity string format.
- Make repository/adaptor boundaries responsible for invoking the migration engine rather than open-coding latest-only schema decode.
- Return migration metadata from artifact open paths so command code can enforce UX policy cleanly.
- Normalize error taxonomy across artifacts:
  - invalid/corrupted artifact
  - unsupported future version
  - hard-blocked known version
  - migration failure
  - persistence failure
- Cover every released historical schema version with fixtures and regression tests.

## Testing Decisions

- Good tests assert externally visible artifact behavior, not implementation details.
- Good migration tests focus on:
  - exact-version decode
  - deterministic migration to latest
  - explicit unsupported-version failure
  - explicit hard-break failure
  - invalid-data failure
  - correct command gating after migration metadata is produced
- Modules/behaviors to test:
  - home state auto-migration before command use
  - payload legacy open through in-memory migration
  - payload update requirement before mutating commands
  - identity string historical import coverage
  - latest-only export coverage
  - normalized future-version failure wording
  - normalized invalid-artifact failure wording
  - hard-break gate behavior
  - load protocol remaining independent from artifact schema migration
- Prior art in the codebase:
  - existing repository tests
  - existing command tests
  - existing payload/open/update tests
  - existing identity string encode/decode tests
- Expected test layers:
  - pure unit tests for migration functions and registry logic
  - integration tests for repository persistence boundaries
  - CLI tests for command policy around legacy vs current artifacts

## Out of Scope

- compatibility with artifacts produced by future newer CLIs
- recovery of corrupted artifacts beyond explicit error reporting
- package-semver-driven compatibility logic
- silent payload rewrites during read-only commands
- automatic migration of caller-owned payloads during machine flows
- removal of explicit `update` as a product concept
- support for unknown historical versions with no registered schema

## Further Notes

- This PRD intentionally treats `home state`, `payload`, `identity string`, and `load protocol` as separate contracts because they have different product semantics.
- The core architectural rule is: latest domain models are not historical persistence models.
- The main UX rule is: local internal state may self-heal automatically; caller-owned payloads may not.
- The long-term maintenance rule is: every released schema version becomes part of the migration surface and must remain test-covered unless an explicit hard-break decision is taken.
