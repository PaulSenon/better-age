# better-age

`better-age` is an opinionated, local-first workflow for encrypted `.env` files.

It is built around one narrow job:
- create one visible encrypted env file
- edit and read it locally
- grant or revoke teammates explicitly
- keep machine loading explicit

Project stance:
- `age` is the primitive
- `better-age` is the UX layer
- scope stays narrow on env files, not generic secret management

Why this repo exists:
- [VISION.md](VISION.md) explains the product bet and tradeoffs
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md) defines canonical terms
- [CONTRIBUTING.md](CONTRIBUTING.md) explains repo rules and reading order

## Packages

- [`@better-age/core`](packages/core/README.md): internal library for artifact codecs, identity lifecycle, payload lifecycle, migrations, crypto ports, and typed outcomes. It does not depend on CLI or varlock.
- [`@better-age/cli`](packages/cli/README.md): main release-facing `bage` CLI. It bundles core and owns terminal UX, command flows, prompts, editor/viewer adapters, and stdout/stderr policy.
- [`@better-age/varlock`](packages/varlock/README.md): thin varlock plugin adapter. It shells out to `bage load --protocol-version=1 <path>` and preserves the proven stdio contract.
- `@better-age/cli-legacy`: private reference package for the old proof of concept. It is not a releasable product and has no public `bage` bin.

## Repo setup

Requirements:
- Node.js
- pnpm

Install:

```sh
pnpm install
```

Repo checks:

```sh
pnpm check
pnpm test
```

## Usage shape

Typical flow:

```sh
bage setup
bage create .env.prod.enc
bage edit .env.prod.enc
bage identity import 'better-age://identity/v1/...' --alias teammate
bage grant .env.prod.enc teammate
bage identity keys --current --path
bage view .env.prod.enc
bage load --protocol-version=1 .env.prod.enc
```

Package-level usage, command docs, and integration details live in package READMEs:
- [packages/cli/README.md](packages/cli/README.md)
- [packages/varlock/README.md](packages/varlock/README.md)
- [docs/manual-qa.md](docs/manual-qa.md)

## Repo map

- product docs: [VISION.md](VISION.md), [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md), [CONTRIBUTING.md](CONTRIBUTING.md)
- longer planning/spec docs: [.llms/projects](.llms/projects/README.md)
- legal: [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
