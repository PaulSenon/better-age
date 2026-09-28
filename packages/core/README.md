# @better-age/core

Internal core package for Better Age.

This package is private to the monorepo. It owns persisted artifacts,
cryptographic ports, identity/payload lifecycle rules, migrations, and typed
outcomes. It must not depend on the CLI or Varlock adapter.

Responsibilities:

- artifact codecs and migrations
- identity and key lifecycle
- payload lifecycle
- typed semantic errors and notices

## Architecture (Effect v4)

```txt
src/artifacts/   Schema codecs for every persisted format (pure)
src/domain/      identity + payload rules as plain functions returning Result
src/services/    the only effectful boundaries:
                   HomeStore     ~/.better-age files, modes, key transaction
                   PayloadFiles  caller-owned payload files (temp + rename)
                   AgeCrypto     age-encryption (keys, passphrases, payloads)
src/Home.ts, Identities.ts, Payloads.ts   use cases (Effect.fn)
src/Errors.ts    tagged errors; `_tag` is the public error code
src/Notices.ts   warnings reported while succeeding (CLI renders them)
src/CoreLayer.ts live services for a home dir (needs FileSystem/Path/Crypto)
```

Use cases are plain functions; callers provide `CoreLayer.layer({ homeDir })`
plus a platform layer (`NodeServices.layer`). Tests swap in an in-memory
`FileSystem` and a fake `AgeCrypto` (`test/support`), and prove on-disk
compatibility against real pre-V2 artifacts (`test/fixtures/pre-v2`).

Payload files use a human-readable `BETTER AGE PAYLOAD` wrapper around untouched
age armor. Core owns formatting, extraction, validation, and the explicit
overwrite/update behavior used by the CLI.

## Artifact Model

- Home state is managed local state. Current runtime shape is v2.
- Payload plaintext, encrypted payload document, age-compatible private key
  plaintext, and public identity string are v1.
- Prototype schemas are intentionally unsupported by the rebuilt MVP.
- Identity strings use `better-age://identity/v1/<base64url-json>`.
- Private key refs are restricted to `keys/<safe-name>.age`.
- Private key plaintext uses an age identity-file format: Better Age metadata in
  a comment plus exactly one age identity line.

## Security And Durability

- Local private key blobs are age passphrase-encrypted age identity files.
- Node adapters create/repair private home/key permissions where supported.
- Passphrase changes decrypt all old keys, re-encrypt all replacements, verify
  them, then commit through a recoverable key transaction.
- Payload mutations encrypt and decrypt/parse the next state in memory before
  any write.
- Payload writes use same-directory encrypted `<payload>.tmp` plus rename over
  the target.
- Payload decrypt tries the current key first, then retired keys lazily.
  Corrupt retired keys warn; missing/corrupt current keys fail typed.

## Contributing

- Package check: `pnpm -F @better-age/core check`
- Package tests: `pnpm -F @better-age/core test`
