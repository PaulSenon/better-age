# Contributing To better-age

Repo is still incubating. Optimize for clarity, small slices, and low drift between docs, domain terms, and behavior.

If a change muddies the model, stop and clarify first.

## Read first

Start here:
- [README.md](README.md)
- [VISION.md](VISION.md)
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)

Then read the package you are touching:
- [packages/core/README.md](packages/core/README.md)
- [packages/cli/README.md](packages/cli/README.md)
- [packages/varlock/README.md](packages/varlock/README.md)

Longer design/spec material now lives under `.llms/projects`:
- [.llms/projects/README.md](.llms/projects/README.md)

## Doc split

Keep docs separated by job:
- root `README.md`: project pitch, repo setup, top-level links
- package `README.md`: package contract, usage, API shape
- `VISION.md`: why this project exists, not a tutorial
- `UBIQUITOUS_LANGUAGE.md`: canonical terms
- `.llms/projects/*`: specs, PRDs, plans, grill logs

Do not duplicate long command docs across root and package READMEs.

## Product direction

Current default stance:
- local-first
- env-file specific
- explicit ACL mutation
- explicit machine load contract
- visible caller-owned encrypted payloads
- no sync layer
- no cloud authority
- no hidden payload registry

Human and machine paths stay distinct:
- humans use `view`
- machines use `load --protocol-version=1`

Rotation is local state. Payload rewrites stay explicit.

## Package map

`@better-age/cli`
- source of truth for command UX, prompts, editor/viewer adapters, and
  stdout/stderr policy
- publishes the `bage` executable

`@better-age/core`
- source of truth for artifact codecs, identity lifecycle, payload lifecycle,
  migrations, crypto ports, and typed outcomes
- must not depend on CLI or varlock

`@better-age/varlock`
- thin adapter
- shells out to `bage load --protocol-version=1 <path>`
- should not grow a second secrets model

## Tech stack

- TypeScript
- Effect
- `@effect/cli`
- `@effect/platform`
- `@effect/platform-node`
- `@inquirer/prompts`
- `@effect/vitest`
- `age-encryption`
- esbuild
- varlock

## Commands

Repo root:

```sh
pnpm check
pnpm test
```

Per package:

```sh
pnpm -F @better-age/cli check
pnpm -F @better-age/cli test
pnpm -F @better-age/core check
pnpm -F @better-age/core test
pnpm -F @better-age/varlock check
pnpm -F @better-age/varlock test
```

## Architecture rules

- keep v0 simple
- prefer core primitives plus thin CLI orchestration over broad abstractions
- keep runtime schemas as persisted-state source of truth
- keep CLI interaction outside core
- keep docs aligned with shipped behavior, not stale naming

## Testing stance

Tests are contract protection.

Use:
- unit tests for invariants and use cases
- integration tests for adapter behavior and state transitions
- sandboxed CLI tests for real command contracts

Do not introduce features whose behavior is only “documented in prose”.
