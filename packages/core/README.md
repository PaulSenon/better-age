# @better-age/core

Core package for the Better Age MVP.

Responsibilities:

- artifact codecs and migrations
- identity and key lifecycle
- payload lifecycle
- core ports/adapters contracts
- typed semantic errors, notices, and success outcomes

Payload files use a human-readable `BETTER AGE PAYLOAD` wrapper around untouched
age armor. Core owns formatting, extraction, validation, and the explicit
overwrite/update behavior used by the CLI.

## Artifact Model

- Home state is managed local state. Current runtime shape is v2.
- Payload plaintext, encrypted payload document, private key plaintext, and
  public identity string are v1.
- Prototype schemas are intentionally unsupported by the rebuilt MVP.
- Identity strings use `better-age://identity/v1/<base64url-json>`.
- Private key refs are restricted to `keys/<safe-name>.age`.

## Security And Durability

- Local private key blobs are age passphrase-encrypted.
- Node adapters create/repair private home/key permissions where supported.
- Passphrase changes decrypt all old keys, re-encrypt all replacements, verify
  them, then commit through a recoverable key transaction.
- Payload mutations encrypt and decrypt/parse the next state in memory before
  any write.
- Payload writes use same-directory encrypted `<payload>.tmp` plus rename over
  the target.
- Payload decrypt tries the current key first, then retired keys lazily.
  Corrupt retired keys warn; missing/corrupt current keys fail typed.

This package should not depend on the CLI or varlock packages.

Implementation plan source:

- `../../.llms/projects/4-cli-core-boundary-hardening/plans/better-age-mvp-reimplementation.md`
