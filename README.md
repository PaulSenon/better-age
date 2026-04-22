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

- [`@better-age/cli`](packages/cli/README.md): main `bage` CLI
- [`@better-age/varlock`](packages/varlock/README.md): thin varlock plugin adapter

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
bage add-identity 'better-age://identity/v1/<base64url-json>'
bage grant .env.prod.enc teammate#0123abcd
bage view .env.prod.enc
bage load --protocol-version=1 .env.prod.enc
```

Package-level usage, command docs, and integration details live in package READMEs:
- [packages/cli/README.md](packages/cli/README.md)
- [packages/varlock/README.md](packages/varlock/README.md)

## Release model

Published packages:
- `@better-age/cli`
- `@better-age/varlock`

Release-worthy package PRs use `pnpm changeset` to declare semver intent.

Current release stance:
- one shared version for published packages
- stable releases flow through a manually prepared release PR
- prerelease/test publishes use npm dist-tag `next`

Contributor-facing release policy lives in [CONTRIBUTING.md](CONTRIBUTING.md).

## Repo map

- product docs: [VISION.md](VISION.md), [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md), [CONTRIBUTING.md](CONTRIBUTING.md)
- longer planning/spec docs: [.llms/projects](.llms/projects/README.md)
- legal: [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
