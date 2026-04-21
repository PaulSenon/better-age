# better-age Vision

This file is the package-level product summary.

For the full current v0 contract, see:
- [BETTER_AGE_V0_SPEC.md](BETTER_AGE_V0_SPEC.md)
- [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)

Use this file to keep package docs and implementation direction aligned.

## Core thesis

`better-age` is not a generic encryption product.

It is an env-payload CLI:
- local-first
- explicit
- minimal
- machine-identity based

It should feel obvious for:
- one user
- many machines

It stays honest about what it does **not** solve:
- sync
- delivery
- cloud access control
- hidden project state managers

## V0 scope

V0 is:
- one local identity with rotating keys
- one shareable identity string
- one caller-owned encrypted payload file
- explicit payload ACL mutation
- keyboard-first guided human navigation
- secure human plaintext viewing through an in-process viewer
- interactive guidance for maintenance when needed

V0 is not:
- a team platform
- a canonical remote authority
- a hidden payload registry
- a generic file-encryption workflow

## Command model

### Home scope

- `setup`
- `me`
- `add-identity`
- `forget-identity`
- `identities`
- `rotate`
- `change-passphrase`

### Payload scope

- `interactive`
- `create`
- `load --protocol-version=1`
- `view`
- `edit`
- `grant`
- `revoke`
- `inspect`
- `update`

Important:
- `update` is user-facing and documented
- interactive commands may prompt into `update`
- non-interactive commands must never hide mutation
- human plaintext and machine plaintext are intentionally separate UX paths

## Core terms

### Identity

Long-lived cryptographic identity rooted by stable `ownerId`.

Contains:
- `ownerId`
- current public key
- current fingerprint
- display name
- `identityUpdatedAt`

### Identity String

The one-line shareable identity export produced by `me` and consumed by `add-identity` and interactive `grant`.

### Owner Id

Stable identity continuity id that survives key rotation.

### Fingerprint

Identifier of one concrete public key.

It changes on rotation.

### Display Name

Owner-chosen human-readable identity name.

It is:
- not unique
- not trust-bearing
- allowed to collide

### Handle

Portable ergonomic identity reference:

```txt
<display-name>#<owner-id-prefix>
```

### Known Identity

Home-local address-book entry for an external identity.

It is:
- local only
- convenience only
- not payload authority

### Local Alias

Optional local nickname for one known identity.

It must never leak into payload metadata.

### Payload

Caller-owned encrypted env file containing:
- env data
- recipient snapshots
- payload metadata

### Recipient

Identity currently granted in one payload.

### Update

Explicit payload maintenance operation used in v0 for:
- schema migration
- stale self-recipient refresh

### Interactive Session

The keyboard-navigable guided CLI entered through `bage interactive`.

It is the primary human UX path.

### View

The human plaintext-reading command.

It uses the secure in-process viewer and must never fall back to plaintext `stdout`.

## Identity resolution

V0 user-facing resolution order:

1. full shared identity string
2. exact local alias
3. exact handle
4. exact display name if unique
5. otherwise fail with candidate handles

Rules:
- do not guess on ambiguous display names
- interactive flows may ask user to choose handle
- optional local alias may be suggested after ambiguity resolution

## Payload truth

Payload authority lives in the payload itself.

That means the payload stores:
- recipients
- payload metadata
- encrypted env content

It does not depend on:
- repo-side sidecars
- local alias overlays
- external sync state

## Payload file shape

V0 payload files are:
- caller-owned
- text-friendly
- not raw `.age` files

High-level shape:
- small plaintext instructional preamble
- explicit armored `BETTER-SECRETS PAYLOAD` block
- encrypted inner envelope containing metadata + `envText`

Parsing rule:
- only outer better-age begin/end markers are authoritative
- preamble text is advisory and must not be strictly validated
- nested inner `AGE ENCRYPTED FILE` armor is valid and expected

Suggested filename family:
- `.env.enc`
- `.env.prod.enc`
- `.env.staging.enc`

## Important product decisions

### No `share`

`share` is too ambiguous.

It conflates:
- ACL mutation
- delivery
- synchronization

So v0 uses:
- `grant`
- `revoke`
- `inspect`
- `update`

### Load is machine-only

`load` exists in v0 for machine env injection.

Rules:
- requires explicit `--protocol-version=1`
- requires explicit payload path
- prints raw `.env` to `stdout` only
- sends prompts and diagnostics to `stderr`
- may prompt for passphrase
- never prompts into `update`
- fails with remediation if payload must be updated

### View is human-only

`view` exists in v0 for human plaintext reading.

Rules:
- uses an in-process secure viewer
- is scrollable and readonly
- stays inside the product’s keyboard interaction model
- never falls back to plaintext `stdout`
- fails with remediation if secure viewing is unavailable

### Interactive is core UX

`interactive` is not a sidecar convenience.

It is the primary guided human entrypoint and should own:
- setup gating
- keyboard-select navigation
- file workflow routing
- identity workflow routing
- return/back behavior between actions

### Rotation is local

`rotate` changes local key state only.

It does **not**:
- scan payloads
- rewrite payloads globally
- maintain a payload index

Payload refresh happens later through `update` or another explicit mutating flow.
