# better-age

`better-age` is a local-first env-secret CLI.

One job:
- keep an env payload encrypted at rest
- let humans navigate it through a guided keyboard CLI
- let humans read secrets through a secure in-process viewer
- let humans edit it safely
- let programs load it explicitly
- let access be granted and revoked explicitly

Not trying to be:
- a generic file-encryption tool
- a cloud secret manager
- a team sync platform
- a hidden repo-side secret registry

Think:
- `ssh-keygen` for local identity
- `age` under the hood
- a keyboard-first human CLI
- one visible encrypted `.env` payload you move yourself

## Mental model

There are 3 things.

### 1. Your local identity

Create it once:

```sh
bage setup
```

This gives you:
- one stable `ownerId`
- one current local keypair
- one passphrase-protected private key
- one display name
- one home state

Related commands:
- `me`
- `add-identity`
- `forget-identity`
- `identities`
- `rotate`
- `change-passphrase`

### 2. A payload

A payload is a caller-owned encrypted env file.

Payload commands:
- `interactive`
- `create`
- `inspect`
- `view`
- `edit`
- `grant`
- `revoke`
- `update`
- `load --protocol-version=1`

Payload truth lives in the payload itself:
- recipients
- payload metadata
- secrets

### 3. Two different plaintext paths

Humans and machines do **not** use the same plaintext surface.

- humans use `view`
- machines use `load --protocol-version=1`

This split is intentional.

## Important behavior

### `load` is machine-oriented

- prints plaintext `.env` to `stdout` only
- requires `--protocol-version=1`
- never auto-runs `update`
- warns on `stderr` if payload should be updated, then still succeeds

### `view` is human-oriented

`view` is the human plaintext reading flow.

Rules:
- uses the in-process secure viewer
- never falls back to plaintext `stdout`
- fails if secure viewing is unavailable
- is meant for deliberate human reading, not piping

### `update` is explicit

`update <path>` is the only explicit payload maintenance command in v0.

It may rewrite:
- stale self recipient snapshot
- duplicate self recipient snapshot
- payload schema version when a migration exists

It does not rewrite:
- non-self recipients just because home state is fresher
- ACL intent for external identities

Interactive commands like `edit`, `grant`, and `revoke` may prompt into `update`.
Non-interactive flows must not hide mutation.

### `interactive` is the guided human entrypoint

`bage interactive` is the keyboard-first guided mode.

It exists to:
- make common human workflows obvious
- keep file and identity flows discoverable
- reuse one coherent interaction model across setup, inspect, view, edit, grant, revoke, and identity management

## Detailed usage example

End-to-end happy path:

```sh
# 1. create local identity
bage setup

# 2. create caller-owned encrypted payload
bage create ./.env.prod.enc

# 3. edit secrets as plaintext through your editor
bage edit ./.env.prod.enc

# 4. inspect metadata without printing values
bage inspect ./.env.prod.enc

# 5. read secrets as a human in the secure viewer
bage view ./.env.prod.enc

# 6. load plaintext for a machine caller
bage load --protocol-version=1 ./.env.prod.enc
```

Sharing flow:

```sh
# teammate sends you their shareable identity string
bage add-identity 'better-age://identity/v1/<base64url-json>'

# then grant them access on the payload
bage grant ./.env.prod.enc teammate#0123abcd
```

Update flow after local key rotation:

```sh
# rotate only changes local key state
bage rotate

# later, refresh payload self snapshot explicitly
bage update ./.env.prod.enc
```

Example output:

```txt
updated ./.env.prod.enc (self key is stale)
```

If already current:

```txt
payload already up to date: ./.env.prod.enc
```

## Explicit failure examples

`update` without local setup:

```txt
No local self identity found
Run: bage setup
```

`load` without protocol version:

```txt
Missing required protocol version
Run with: --protocol-version=1
```

`load` when payload needs maintenance:

```txt
Warning: payload should be updated
Run: bage update ./.env.prod.enc
```

Decrypt failure example:

```txt
Failed to decrypt payload with provided passphrase
```

`view` when secure viewing is unavailable:

```txt
Cannot open secure viewer in current environment
Use an interactive TTY session for `bage view`
```

## Identity terms

- `Identity`: long-lived identity rooted by stable `ownerId`
- `Owner Id`: stable id that survives rotation
- `Fingerprint`: one concrete public-key id
- `Display Name`: human-facing label, not unique
- `Handle`: `<display-name>#<owner-id-prefix>`
- `Identity String`: one-line export from `me`
- `Known Identity`: local address-book entry for an external identity
- `Local Alias`: local-only nickname, never stored in payload metadata
- `Recipient`: identity currently granted on a payload

Identity ref resolution order:

1. full shared identity string
2. exact local alias
3. exact handle
4. exact display name if unique
5. otherwise fail with candidate handles

## Human UX

Human UX is keyboard-first.

That means:
- `interactive` is the main guided entrypoint
- omitted-path human flows can open file pickers
- omitted-identity human flows can open identity pickers
- `view` uses a secure in-process scrollable readonly viewer
- human secret viewing must never degrade into plaintext stdout

The human viewer is expected to support:
- up/down movement
- page up/page down
- jump top/bottom
- quit/back

## Payload file shape

Payload files are text-friendly but not plaintext.

High-level shape:
- plaintext instructional preamble
- armored `BETTER-SECRETS PAYLOAD` block
- encrypted inner envelope containing metadata + `envText`

Suggested filenames:
- `.env.enc`
- `.env.prod.enc`
- `.env.staging.enc`

## References

- Product summary: [VISION.md](packages/cli/VISION.md)
- UX PRD: [BETTER_AGE_UX_PRD.md](BETTER_AGE_UX_PRD.md)
- V0 contract: [BETTER_AGE_V0_SPEC.md](BETTER_AGE_V0_SPEC.md)
- Domain terms: [UBIQUITOUS_LANGUAGE.md](UBIQUITOUS_LANGUAGE.md)
- Contribution guide: [CONTRIBUTING.md](packages/cli/CONTRIBUTING.md)
- Test layout: [test/README.md](packages/cli/test/README.md)
