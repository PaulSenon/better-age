# Contributing To better-age

This package is in incubation.

Optimize for:
- clean mental model
- small real slices
- strict boundaries
- reproducible tests

If a change makes the model muddier, stop and clarify first.

## Read first

Before changing anything, read:
- [README.md](packages/cli/README.md)
- [VISION.md](packages/cli/VISION.md)
- [BETTER_AGE_V0_SPEC.md](BETTER_AGE_V0_SPEC.md)
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)
- [plans/better-age-effect-base.md](plans/better-age-effect-base.md)
- [plans/better-age-v0.md](plans/better-age-v0.md)

Meaning:
- README = user-facing summary
- VISION = package-level product direction
- V0 spec = current behavior contract
- Ubiquitous language = canonical terms
- Effect-base plan = scaffold rules for the minimal slice
- V0 plan = later product slicing once the base is sound

## Product direction summary

Current agreed v0 model:
- one local identity + self-contained payload files
- no `share`
- no `export`
- no `import` for payload files
- no `sync`
- no cloud
- no project-side authority sidecar
- no hidden home-managed payload registry

Home commands for v0:
- `setup`
- `me`
- `add-identity`
- `identities`
- `rotate`
- `change-passphrase`

Payload commands for v0:
- `interactive`
- `create`
- `view`
- `load --protocol-version=1`
- `edit`
- `grant`
- `revoke`
- `inspect`
- `update`

Important behavior:
- `update` is explicit and documented
- interactive commands may prompt into `update`
- non-interactive commands must never hide mutation
- humans use `view`
- machines use `load --protocol-version=1`
- local aliases are home-local only and never payload authority

## Current codebase reality

The codebase started with a setup-first vertical slice.

That means:
- package docs should match shipped behavior
- contributors should align new work to `BETTER_AGE_V0_SPEC.md`, not to older naming or superseded flows
- avoid preserving outdated naming like `init` if the v0 spec now says `create`

## Tech stack

- TypeScript 6
- Effect 3
- `@effect/cli`
- `@effect/language-service`
- `@effect/platform-node`
- `@effect/vitest`
- `age-encryption`
- esbuild
- `rivetkit`
- `rivetkit/agent-os`
- `@rivet-dev/agent-os-common`

Why:
- typed service graph
- schema-first runtime validation
- Effect-native test layers
- editor diagnostics for service/layer/error mistakes
- age-compatible crypto from SDK
- no system binary dependency
- agentOS VM-backed CLI tests with virtual FS

## Package commands

From package dir:

```sh
pnpm build
pnpm check
pnpm test
```

Meaning:

`pnpm build`
- bundles `src/cli/main.ts`
- writes `dist/cli.cjs`

`pnpm check`
- local Biome lint
- strict TS check
- Effect language-service diagnostics through patched local `tsc`

`pnpm test`
- runs unit + integration + e2e tiers
- e2e builds first because it validates the shipped CLI bundle

## Test philosophy

Tests are architecture constraints here.

We want 3 kinds:

### 1. Unit

Purpose:
- one use case
- one invariant
- fake ports

Rules:
- no real fs
- no sandbox
- no process
- real crypto only if truly required

Good unit test:
- fast
- deterministic
- minimal
- behavior-focused

### 2. Integration

Purpose:
- real adapter behavior
- real file/state transitions
- still isolated

Rules:
- no host-fs mutation
- temp/virtualized boundaries only
- real crypto allowed

### 3. Sandboxed CLI

Purpose:
- run real CLI
- assert stdout/stderr contract
- assert virtual FS mutations

Rules:
- must use the `rivetkit/agent-os` VM harness
- must not spawn CLI unsandboxed
- must assert state on sandbox FS
- must execute built `dist/cli.cjs`

## Architectural rules

Keep one package for v0.

Do not split into many workspace packages yet.

Preserve strong internal layering:
- domain = pure models and invariants
- app = orchestration/use cases
- port = service contracts and boundary-level error contracts
- infra = concrete adapters
- cli = argv/input/output translation
- program = live wiring

Scaffold rules are strict:
- runtime schemas are the source of truth for persisted state, value objects, and errors
- domain/app use `Option`, not `null`
- use cases are first-class `Effect.Service` services
- current boundaries are `Effect.Service` services too
- app remaps infra failures into use-case failures before CLI handles them
- CLI interaction stays outside domain/app
- command failures still exit non-zero after rendering user-facing messages
- use `Effect.fn("Service.method")` for named app-service methods

Preferred deep modules to keep growing:
- identity registry
- key lifecycle
- payload envelope
- payload access controller
- interactive flow controller

## Project structure

### `src/domain`

Pure domain layer.

Expected responsibilities:
- identity terms and invariants
- home-state shape
- payload envelope shape
- recipient snapshot model
- update-needed computation
- domain errors

Rules:
- no Node APIs
- no fs
- no prompt IO
- no CLI parsing
- no unchecked casts from unknown runtime data
- prefer branded schema-backed value objects for important strings

### `src/port`

Interfaces the app layer depends on.

Expected boundaries include:
- crypto
- home-state persistence
- payload persistence
- prompt/TTY
- editor launch

Rule:
- boundaries are service contracts, not ad hoc objects
- boundary errors must stay explicit and specific
- keep adapter implementation details out of app and CLI layers

### `src/app`

Use cases.

Expected responsibilities:
- setup identity
- import/export identity string
- rotate/change passphrase
- create/load/view/edit payload
- grant/revoke/update payload
- inspect payload

Rule:
- orchestration belongs here, not in CLI or infra
- each use case should have one canonical app-service boundary
- app owns remapping boundary failures into use-case failures
- use injected time/config, not hidden globals

### `src/infra`

Concrete adapters.

Expected responsibilities:
- `age-encryption` integration
- node home-state persistence
- payload file parsing/writing
- TTY prompting
- editor process launching

Rules:
- decode on read, encode on write
- never trust `JSON.parse(...) as ...`
- keep process env / stdio / fs details here

## Current scaffold baseline

The minimal reference slice is now the `setup` flow.

It should demonstrate:
- schema-backed identity value objects
- schema-backed home-state persistence
- explicit layered errors
- `Effect.Service` use-case orchestration
- CLI-only prompting/rendering
- `@effect/vitest` layer-based app tests
- sandboxed built-CLI contract tests

If a new feature does not look structurally similar to this slice, pause and clarify before adding more code.

Rule:
- third-party quirks live here or in test harnesses, not in app/domain

### `src/cli`

Command/controller layer.

Expected responsibilities:
- option parsing
- interactive branching
- output shaping
- error mapping

Rule:
- CLI layer should translate argv/input/output only

### `src/program`

Live service composition.

Expected responsibilities:
- runtime wiring
- command registration
- layer assembly

## Contributor guidance

- Prefer aligning names to the glossary rather than legacy code names.
- Do not invent hidden automation that the v0 spec explicitly rejected.
- Do not reintroduce raw ownerId/fingerprint as normal user-facing CLI refs.
- Do not leak local aliases into payload data.
- Do not let non-interactive commands mutate silently.
- Keep slices vertical: every meaningful step should be demoable end-to-end.
