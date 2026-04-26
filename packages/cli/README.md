# @better-age/cli

Main `better-age` CLI package. It exposes the `bage` command.

For project pitch and rationale:
- [../../README.md](../../README.md)
- [../../VISION.md](../../VISION.md)
- [../../UBIQUITOUS_LANGUAGE.md](../../UBIQUITOUS_LANGUAGE.md)

## What it does

`bage` is a local-first CLI for encrypted `.env` payloads.

Core jobs:
- create one encrypted env file
- edit it safely
- view secrets as a human through a secure viewer
- load secrets for machines through an explicit protocol
- grant and revoke recipients explicitly

## Mental model

There are 3 core things:
- one local identity
- one encrypted payload file
- two separate plaintext paths: `view` for humans, `load` for machines

Identity setup gives you:
- stable `ownerId`
- current keypair
- passphrase-protected private key
- display name
- key mode `pq-hybrid`

Payload truth lives in the payload itself:
- recipients
- payload metadata
- encrypted env text

## Command groups

```txt
# file related
bage create
bage edit
bage grant
bage inspect
bage load --protocol-version=1
bage revoke
bage update
bage view

# identity related
bage identity export
bage identity forget
bage identity import
bage identity list
bage identity passphrase # alias "pw" | "pass"
bage identity rotate

# first time setup
bage setup

# interractive mode
bage interactive # alias "i"
```

## Quick start

Examples assume `bage` is invokable in your shell.

```sh
bage setup
bage create .env.prod.enc
bage edit .env.prod.enc
bage add-identity 'better-age://identity/v1/<base64url-json>'
bage grant .env.prod.enc teammate#0123abcd
bage view .env.prod.enc
bage load --protocol-version=1 .env.prod.enc
```

## Command notes

`setup`
- creates local identity state
- requires a passphrase
- accepts optional `--alias`, which currently sets the display name

`interactive`
- guided keyboard-first entrypoint
- good default for human usage

`view`
- human-only plaintext path
- uses secure in-process viewer
- must not fall back to plaintext `stdout`

`load`
- machine-only plaintext path
- requires `--protocol-version=1`
- prints raw `.env` to `stdout`
- may warn on `stderr` when payload needs `update`

`update`
- explicit maintenance command
- refreshes a stale self recipient entry and future schema migrations
- should not hide mutation in non-interactive flows

## Resolution rules

Identity references resolve in this order:
1. full identity string
2. exact local alias
3. exact handle
4. exact display name if unique
5. otherwise fail with candidate handles

## Failure examples

Missing setup:

```txt
No local self identity found
Run: bage setup
```

Missing load protocol:

```txt
Missing required protocol version
Run with: --protocol-version=1
```

Payload needs maintenance:

```txt
Warning: payload should be updated
Run: bage update .env.prod.enc
```

Secure viewer unavailable:

```txt
Cannot open secure viewer in current environment
Use an interactive terminal
```

## Development

Repo-local commands:

```sh
pnpm -F @better-age/cli build
pnpm -F @better-age/cli check
pnpm -F @better-age/cli test
```

Longer specs and plans:
- [../../.llms/projects/0-cli-mvp/1-BETTER_AGE_V0_SPEC.md](../../.llms/projects/0-cli-mvp/1-BETTER_AGE_V0_SPEC.md)
- [test/README.md](test/README.md)
