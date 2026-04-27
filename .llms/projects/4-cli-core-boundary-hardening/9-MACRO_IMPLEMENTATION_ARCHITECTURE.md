# Macro Implementation Architecture

Status: pre-PRD implementation framing. Goal: make the next PRD and tracer-bullet plan implementation-grade without drifting into code details.

## Current Workspace Reality

Current packages:

```txt
packages/cli
packages/varlock
```

Current `packages/cli` contains:

```txt
CLI command entrypoint
app logic
ports/adapters
crypto/payload/home repositories
prompt/editor/viewer infrastructure
tests
```

Target packages:

```txt
packages/cli-legacy
packages/core
packages/cli
packages/varlock
```

## Rollout Decision

The current CLI is not a compatibility constraint during the MVP rebuild.

Implementation rollout:

```txt
1. Rename current `packages/cli` to `packages/cli-legacy`.
2. Rename package to `@better-age/cli-legacy`.
3. Mark `@better-age/cli-legacy` private.
4. Remove legacy `bin.bage`.
5. Create new `packages/core`.
6. Build and test core to full MVP behavior.
7. Create new `packages/cli` on top of core.
8. Keep `packages/varlock`, then adapt it to the new CLI load protocol.
9. Release only after new core/CLI/varlock are clean.
```

Rules:

- no `bage-legacy` binary.
- no legacy/prototype schema compatibility.
- legacy CLI is source reference only.
- do not refactor legacy toward the new design.

## Target Dependency Direction

```txt
@better-age/core
  no dependency on CLI or varlock

@better-age/cli
  depends on @better-age/core

@better-age/varlock
  shells out to new bage load protocol
  does not depend on @better-age/core

@better-age/cli-legacy
  private reference package
  not imported by new packages
```

Rules:

- core owns domain/app/persistence/crypto adapter contracts.
- CLI owns argv, exact/guided flow, prompts, editor/viewer, presentation.
- varlock owns process spawning and stdio contract only.

## Technology Choices

Core:

```txt
effect
```

Use Effect for:

```txt
typed failures
services/ports/layers
dependency injection
resource-safe orchestration
test runtimes with fake ports
```

CLI:

```txt
effect
@effect/cli
```

Use `@effect/cli` for:

```txt
command/subcommand definitions
args/options parsing
help/usage
basic prompt primitives when sufficient
```

Do not use `@effect/cli` as a full TUI framework.

Presentation:

```txt
internal CliPresenter boundary
minimal ANSI styling
emoji/color/bold where useful
```

Rules:

- styling belongs behind presentation ports, not in command/core logic.
- message ids and params are the stable contract.
- renderer may use a small styling/color package if needed.
- keep machine stdout commands clean (`load`, `identity export`).
- interactive UI can be richer than non-interactive output, but stays simple and terminal-safe.

Decision:

```txt
use @effect/cli for command grammar/help and @inquirer/prompts for normal interactive IO
```

## Core Deep Modules

Core should be built as a few deep, testable modules with narrow public APIs.

### Artifact Codecs And Migrations

Owns:

```txt
HomeStateDocumentV1 parse/encode
PrivateKeyPlaintextV1 parse/encode
PayloadDocumentV1 parse/encode
PayloadPlaintextV1 parse/encode
PublicIdentityStringV1 parse/encode
version/kind validation
pure migration functions
```

Why deep:

- lots of edge cases behind simple parse/migrate APIs.
- fixture-driven tests.
- protects all higher layers from malformed data.

### Identity Store

Owns:

```txt
self identity lifecycle
known identity address book
local aliases
retired keys metadata
identity string import/export
identity reference resolution
passphrase change
rotation
```

Why deep:

- centralizes OwnerId/fingerprint/alias/freshness rules.
- separates home-state semantics from CLI wording.

### Key Vault

Owns:

```txt
key generation
encrypted private key refs
read/write key blobs
decrypt current/retired keys with passphrase
reencrypt all keys on passphrase change
```

Why deep:

- isolates age encrypted-key behavior.
- keeps private-key handling concentrated.

### Payload Store

Owns:

```txt
payload create/decrypt/edit/grant/revoke/update
payload recipient snapshots
payload compatibility/update reasons
payload plaintext validation
payload encryption/decryption through ports
```

Why deep:

- central MVP behavior surface.
- stateless path/passphrase mutations stay canonical.

### Core Facade

Owns:

```txt
BetterAgeCoreLifecycle
BetterAgeCoreQueries
BetterAgeCoreCommands
CoreResponse / notices / typed failures
```

Why deep:

- stable API for CLI and tests.
- hides module composition.

## Core Ports And Adapters

Core ports:

```txt
HomeRepositoryPort
PayloadRepositoryPort
IdentityCryptoPort
PayloadCryptoPort
ClockPort
RandomIdsPort
```

Core adapters:

```txt
NodeHomeRepository
NodePayloadRepository
AgeIdentityCrypto
AgePayloadCrypto
SystemClock
RandomIdGenerator
```

Testing adapters:

```txt
InMemoryHomeRepository
InMemoryPayloadRepository
FakeIdentityCrypto
FakePayloadCrypto
FixedClock
DeterministicIds
```

Rules:

- fake ports power exhaustive unit tests.
- real adapters are integration-tested narrowly.
- crypto adapter proves age interoperability, not every domain branch.

## New CLI Macro Modules

### Shell Parser

Owns:

```txt
target command surface
aliases
operand classification
exact/guided calculation
protocol operand validation
```

### Flow Orchestrator

Owns:

```txt
global home preflight
shared payload context flow
passphrase retry policy
guided resolution flows
outdated payload write gate
command-specific flow continuations
```

### Interaction Ports

Owns:

```txt
prompt
select menu
editor
secure viewer
terminal mode
cwd payload discovery
```

### Presentation

Owns:

```txt
message ids
minimal styling
emoji/color/bold rendering
stdout/stderr routing
success/warning/error rendering
machine-output cleanliness
```

Rules:

- CLI should not reimplement domain rules from core.
- CLI may compose core queries/commands to improve UX.
- CLI may open payload early for context but mutations remain stateless core calls.

## Varlock Macro Module

Owns:

```txt
spawn bage load
stdin inherit
stdout pipe env text
stderr inherit human prompts/warnings
adapter failure mapping
```

Rules:

- no passphrase collection in varlock.
- no core import in varlock MVP.
- varlock tests focus on process/stdio contract.

## Build Order

Recommended order:

```txt
0. Move legacy CLI to private cli-legacy.
1. Create core package skeleton, exports, test harness.
2. Implement artifact codecs and v1 fixtures.
3. Implement migration mechanism and no-op v1 migrations.
4. Implement fake ports and core test runtime.
5. Implement identity/key vault vertical slice.
6. Implement payload create/decrypt vertical slice.
7. Implement payload edit/grant/revoke/update.
8. Implement real node filesystem + age adapters.
9. Create new CLI shell/parser/presentation skeleton.
10. Add CLI flows command by command.
11. Adapt varlock to new load protocol.
12. Run final contract/e2e hardening.
```

## First Tracer Bullet Candidate

First useful vertical slice:

```txt
setup -> identity export -> identity import/list against in-memory core
```

Why:

- proves home state document v1.
- proves identity string v1.
- proves key generation/protection interface.
- proves CLI stdout/stderr split for identity export.
- avoids payload complexity too early.

Alternative first slice:

```txt
core-only artifact codecs + migration fixture harness
```

Use this as phase 0 if the PRD-to-plan wants stronger foundation before any user-visible CLI path.

## Implementation Planning Guidance

The PRD should describe:

```txt
new core package as the tested behavioral foundation
new CLI package as UX shell over core
legacy CLI parking
varlock adaptation through load protocol
persistence v1 and migrations
unit/integration/contract test strategy
```

The tracer-bullet plan should avoid large horizontal phases like:

```txt
build all core
then build all CLI
```

Instead, use foundation slices plus thin product slices:

```txt
artifact/migration foundation
identity setup/export/list slice
payload create/decrypt/load slice
payload edit slice
grant/revoke/update slice
identity rotation/passphrase slice
interactive/guided UX polish slice
varlock integration slice
```

## Risks To Watch

```txt
too much generic framework before first behavior
duplicating domain rules in CLI flows
making fake crypto diverge from age semantics
leaking human output into machine stdout
letting legacy package shape new core APIs
overfitting v1 schemas before fixtures exist
```

## Definition Of Ready For PRD

Ready:

- target package direction is decided.
- core deep modules are identified.
- persistence v1 is specified.
- migration/test strategy is specified.
- command/flow/error contracts are specified.

Therefore the next step can be PRD synthesis.
