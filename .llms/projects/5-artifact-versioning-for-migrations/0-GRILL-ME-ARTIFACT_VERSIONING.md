# Grill Log: Better Age Artifact Versioning

## Session Start

- Topic: artifact versioning and migration for persisted contracts in `packages/cli`
- Scope confirmed by user: home state, payload envelope, identity string, and existing load protocol boundary
- Relevant source docs:
  - `1-BETTER_AGE_ARTIFACT_VERSIONING_PRD.md`
  - `UBIQUITOUS_LANGUAGE.md`
- Relevant current code seams:
  - `packages/cli/src/domain/home/HomeState.ts`
  - `packages/cli/src/domain/payload/PayloadEnvelope.ts`
  - `packages/cli/src/domain/identity/IdentityString.ts`
  - `packages/cli/src/app/shared/OpenPayload.ts`
  - `packages/cli/src/infra/fs/nodeHomeRepository.ts`

## Reconstructed Intent

- Version each persisted contract separately:
  - home state schema version
  - payload schema version
  - identity string schema version
  - load protocol version
- Keep package/app version separate from decode/migration decisions.
- Newer CLI should open any valid older released artifact.
- Future/newer artifact version should fail explicitly.
- Home state should auto-migrate and persist before command logic.
- Payload reads may migrate in memory; payload writes must require explicit persisted migration first.
- Identity string imports should support old known versions indefinitely and normalize to latest internal form.
- Add hard-break gate in code, default off.
- Keep domain types versionless; keep persisted schemas versioned.
- Prefer header-first decode, exact-version decode, linear one-step migrations, chained to latest.

## Transcript

### Assistant Q1

Should compatibility commitment start now from current `v1` artifacts, even before first breaking schema lands?

Recommended answer: yes.

Reason:
- otherwise no real baseline
- no real fixture history
- migration engine risks becoming speculative infra

### User A1

Recovered notes from previous session confirm:

- compatibility baseline should include current released persisted artifacts
- support all released historical versions by default
- keep explicit hard-break gate available for emergencies
- allow old payload reads via in-memory migration, but require explicit update before mutating commands
- support old identity string imports indefinitely
- keep load protocol version separate from persisted artifact migration
- use uniform migration engine with explicit version header decode and version-specific schemas

User supplied prior design notes/examples covering:

- `RawV1 / RawV2 / RawV3`
- `LatestRaw`
- `DomainModel`
- `migrateVnToVn+1`
- header-first decode
- uniform error taxonomy
- persisted-vs-domain separation
- linear migration registry

## Current Working Assumptions

- Current `v1` for home state, payload envelope, and identity string is the first committed historical baseline.
- "Support forever" means all released known versions remain readable unless explicitly hard-blocked by policy.
- "Unsupported" should cover future version, hard-blocked version, unknown version, and invalid bytes for claimed version.

### Assistant Q2

For mutating payload commands on legacy payloads, which UX do you want?

- Option A: interactive inline consent, then persisted migration, then continue original command
- Option B: hard stop with `Run: bage update <path>`

Recommended answer:

- interactive terminal: prompt, migrate, continue
- headless terminal: hard stop with explicit remediation

Reason:
- matches existing interaction model
- preserves explicit mutation boundary
- keeps headless/machine flows deterministic

### User A2

Confirmed:

- use both depending on runtime capability
- `Interactive Terminal`: prompt for migration
- `Headless Terminal`: hard stop and tell user to run update
- this should mirror current payload update behavior when self key rotation makes payload outdated
# Reminder

- likely start implementation with a cleanup / realignment phase first
- first align public identity structure across self / known / payload / identity-string forms
- only after that implement the full migration system
