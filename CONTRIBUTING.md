# Contributing To better-age

Repo is still incubating. Optimize for clarity, small slices, and low drift between docs, domain terms, and behavior.

If a change muddies the model, stop and clarify first.

## Read first

Start here:
- [README.md](README.md)
- [VISION.md](VISION.md)
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)

Then read the package you are touching:
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
- source of truth for identities, payloads, and command UX
- publishes the `bage` executable

`@better-age/varlock`
- thin adapter
- shells out to `bage load --protocol-version=1 <path>`
- should not grow a second secrets model

## Tech stack

- TypeScript
- Effect
- `@effect/cli`
- `@effect/platform-node`
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
pnpm -F @better-age/varlock check
pnpm -F @better-age/varlock test
```

## Release intent

Release-worthy package PRs must add a changeset.

Use:

```sh
pnpm changeset
```

Add a changeset when a PR changes released behavior for:
- `@better-age/cli`
- `@better-age/varlock`

This includes:
- CLI flags, commands, prompts, output, or compatibility
- varlock plugin runtime behavior or integration contract
- install/runtime requirements users must know about

Do not add a changeset for:
- docs-only changes
- CI or repo-maintenance changes
- internal refactors with no released behavior change
- future private app/site work

Current release model:
- published packages share one version line
- stable releases are prepared manually through a release PR
- prerelease/test publishes use npm dist-tag `next`

Repo-owned release boundaries live in:
- [.changeset/config.json](.changeset/config.json)
- [tools/release/release-config.mjs](tools/release/release-config.mjs)

## Architecture rules

- keep v0 simple
- prefer deep modules over premature package splits
- preserve layering: domain, app, port, infra, cli, program
- keep runtime schemas as persisted-state source of truth
- keep CLI interaction outside domain/app
- keep docs aligned with shipped behavior, not stale naming

## Testing stance

Tests are contract protection.

Use:
- unit tests for invariants and use cases
- integration tests for adapter behavior and state transitions
- sandboxed CLI tests for real command contracts

Do not introduce features whose behavior is only “documented in prose”.
