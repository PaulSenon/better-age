# Better Secrets V0 Spec

Status:
- current source-of-truth spec for `better-age` v0
- derived from `0-GRILL_ME_V0_SPECS.md` + existing package docs
- this doc is for product/behavior contract, not implementation internals

## 1. Product shape

`better-age` v0 is:
- a local-first env payload CLI
- based on per-user local machine identity
- explicit about payload mutation
- optimized for non-expert developer UX

`better-age` v0 is not:
- a sync platform
- a delivery mechanism
- a cloud secret manager
- a generic file encryption tool
- a hidden home-state payload manager

Core v0 promise:
- user runs `setup` once
- user can share access by exchanging one copy-paste identity string
- payload file stays caller-owned and visible
- interactive flows guide user through maintenance when needed
- non-interactive flows stay explicit and script-safe

## 2. Command surface

### Home scope

- `setup`
- `me`
- `add-identity [identity-string]`
- `forget-identity [identity-ref]`
- `identities`
- `rotate`
- `change-passphrase`

### Payload scope

- `create [path]`
- `load --protocol-version=1 <path>`
- `read <path>`
- `edit <path>`
- `grant <path> [identity-ref]`
- `revoke <path> [identity-ref]`
- `inspect <path>`
- `update <path>`

## 3. Core terminology

This doc uses these terms exactly:

- `Identity`: long-lived identity rooted by stable `ownerId`
- `Owner Id`: stable identity id that survives rotation
- `Fingerprint`: id of one concrete key
- `Display Name`: owner-chosen human-readable name
- `Handle`: `<display-name>#<owner-id-prefix>`
- `Known Identity`: home-local address-book entry for external identity
- `Local Alias`: home-local nickname for one known identity
- `Payload`: encrypted env bag file
- `Recipient`: identity currently granted in one payload
- `Identity Updated At`: UTC timestamp for freshness of one identity snapshot

Important invariants:
- local aliases never leak into payload metadata
- payload authority is recipient snapshot data, not home-state overlays
- revoke/grant operate at identity continuity level (`ownerId`), not local alias level

## 4. Identity model

### 4.1 Self identity

`setup` creates one self identity containing:
- stable `ownerId`
- current public key
- current fingerprint
- display name
- `identityUpdatedAt`

Canonical v0 text formats:
- `ownerId` format: `bsid1_<16hex>`
- handle format: `<display-name>#<first-8-hex-of-owner-id-body>`
- example:
  - owner id: `bsid1_069f7576d2ab43ef`
  - handle: `toto#069f7576`

### 4.2 Rotation model

Rotation:
- keeps same `ownerId`
- replaces current public/private keypair
- changes fingerprint
- updates `identityUpdatedAt`
- retires previous local key

### 4.3 Shareable identity string

`me` outputs one single-line versioned identity string.

Current v0 canonical shape:

```txt
better-age://identity/v1/<base64url-json>
```

Deferred path-hint design:
- plaintext path hints like handle / owner-id-short / generation may be added later
- if ever added, parser/importer must treat them as cosmetic only
- decoded payload remains the only trusted source of identity truth
- any cosmetic fields should use obviously non-authoritative naming

Decoded JSON shape:

```json
{
  "version": "v1",
  "ownerId": "...",
  "displayName": "...",
  "handle": "...",
  "fingerprint": "...",
  "publicKey": "...",
  "identityUpdatedAt": "2026-04-12T00:00:00.000Z"
}
```

Decoded content must include:
- `version`
- `ownerId`
- `handle`
- `publicKey`
- `fingerprint`
- `displayName`
- `identityUpdatedAt`

Rules:
- `me` prints only this string to `stdout`
- `add-identity` accepts exactly this format
- `grant` interactive flow may also accept this pasted inline
- raw `ownerId` and raw `fingerprint` are not supported as user-facing refs in v0
- future path hints are not trusted authority unless duplicated and validated against payload

### 4.4 Known identities

Known identity entry stores:
- `ownerId`
- current `publicKey`
- current `fingerprint`
- current display snapshot
- `identityUpdatedAt`
- optional local alias

Update rules:
- same `ownerId`, newer `identityUpdatedAt` => update known identity snapshot
- same `ownerId`, same snapshot => no-op
- same `ownerId`, equal timestamp but different snapshot => conflict/error
- older snapshot never overwrites newer local snapshot

## 5. Identity resolution rules

Canonical user-facing resolution order:

1. full shared identity string
2. exact local alias
3. exact handle
4. exact display name if unique
5. otherwise fail with candidate handles

Rules:
- display-name ambiguity must never be guessed
- interactive flows may ask user to choose among candidate handles
- after ambiguity resolution, tool may suggest saving a local alias
- alias creation is optional in v0
- no dedicated alias-management command in v0

## 6. Home-state learning behavior

When payload commands decrypt/read payload metadata, tool may import recipient snapshots into local known identities.

Allowed home-state learning:
- import previously unknown payload recipients into known identities
- refresh known identity snapshot if payload snapshot is newer for same `ownerId`
- suggest optional local alias when imported identities collide by display name

Forbidden automatic behavior:
- never mutate payload only because home state learned something
- never auto-upgrade non-self payload recipients from home data

## 7. Interactive vs non-interactive rules

### 7.1 Base rule

Interactive TTY mode may prompt and guide.

Non-interactive mode must:
- never prompt
- never silently mutate payload or home state beyond the explicit command’s core contract
- fail with exact remediation when extra user decision is required

### 7.2 Update preflight rule

Interactive commands may detect payload needs update and prompt:

```txt
Payload needs update before continuing. Update now? [Y/n]
```

If accepted:
- run `update <path>` internally
- continue original command

Non-interactive mode:
- must not auto-run update
- must fail and direct user to `bage update <path>`

## 8. Home commands

### 8.1 `setup`

Purpose:
- initialize local identity and home state

Interactive prompts:
- display name, if not provided
- passphrase
- confirm passphrase
- rotation TTL choice:
  - `1w`
  - `1m`
  - `3m` default
  - `6m`
  - `9m`
  - `1y`

Creates:
- self `ownerId`
- active keypair
- encrypted private key
- home state
- empty known identities collection

Already configured behavior:
- must not overwrite existing setup silently
- should print current summary and direct user toward `rotate` or `change-passphrase`

### 8.2 `me`

Purpose:
- print shareable identity string

Output:
- identity string only

### 8.3 `add-identity [identity-string]`

Purpose:
- import one external identity into known identities

Behavior:
- if arg missing in TTY, prompt for pasted string
- if unknown `ownerId`: add
- if same `ownerId` with newer snapshot: update
- if same snapshot: no-op
- preserve local alias on update

User-facing result states:
- `added`
- `updated`
- `unchanged`

### 8.4 `identities`

Purpose:
- human-readable home-level inspection

Must show section `Me`:
- display name
- handle
- ownerId short form
- current fingerprint short form
- `identityUpdatedAt`
- active key status
- rotation TTL summary
- next rotation due or overdue state
- retired key count

Must show section `Known identities`:
- local alias if any
- display name
- handle
- fingerprint short form
- `identityUpdatedAt`

May show section `Retired local keys`:
- fingerprint short form
- retired at

Must not show:
- payload tracking
- usage stats
- stale/newer markers across payloads
- JSON output in v0

### 8.5 `forget-identity [identity-ref]`

Purpose:
- remove one known identity from local home state only

Behavior:
- resolves refs using normal v0 identity-ref order
- if arg missing in TTY, prompt for identity ref
- removes only from known identities
- payload files untouched
- if target is unknown in known identities: no-op with clear message
- if target resolves to self identity: fail

UX rule:
- command wording must make local-only scope clear
- it is not revocation

### 8.6 `rotate`

Purpose:
- rotate local current key only

Behavior:
- keeps same `ownerId`
- generates new keypair
- encrypts new private key with current passphrase
- marks previous key retired
- updates active key pointer
- updates `identityUpdatedAt`
- prints guidance to reshare new `me` output

Must not:
- crawl filesystem
- update payload files globally
- maintain payload index

### 8.7 `change-passphrase`

Purpose:
- re-encrypt all local private keys under new passphrase

Behavior:
- prompt current passphrase
- prompt new passphrase twice
- decrypt all local private keys with old passphrase
- re-encrypt all local private keys with new passphrase
- update no payloads
- update no known identities

Failure rule:
- operation must fail atomically if any local key cannot be rewritten safely

## 9. Payload commands

### 9.1 `create [path]`

Purpose:
- create new payload file

Behavior:
- creates payload with self as only recipient
- in TTY, if no self identity exists, prompt to run `setup` first, then continue
- in non-interactive mode with no self identity, fail with exact remediation

Path rules:
- if path omitted in TTY, prompt for filename in current directory
- if target path is directory in TTY, prompt for filename inside that directory
- default suggested filename family: `.env.*.enc`
- default simple suggestion may be `.env.enc`

Post-create interactive behavior:
- prompt to open editor immediately

Must not:
- prompt for extra recipients in v0

### 9.2 `load --protocol-version=1 <path>`

Purpose:
- decrypt payload and print plaintext `.env` to `stdout` for machine use only

Rules:
- requires explicit `--protocol-version=1`
- requires explicit payload path
- prints raw `.env` to `stdout` only
- prompts/warnings/errors must go to `stderr`
- may prompt for passphrase
- must never prompt into `update`
- must never mutate payload implicitly

Failure rules:
- if `--protocol-version` missing:
  - fail
  - print:

```txt
Missing required protocol version
Run with: --protocol-version=1
```

- if protocol version unsupported:
  - fail
  - print:

```txt
Unsupported protocol version: <received>
This better-age CLI supports protocol version 1.
Update the caller/plugin to a compatible version.
```

- if payload needs update:
  - fail
  - print:

```txt
Payload must be updated before load
Run: bage update <path>
```

- if decrypt fails:
  - fail
  - print:

```txt
Failed to decrypt payload with provided passphrase
```

### 9.3 `read <path>`

Purpose:
- educational/discoverability command only

Rules:
- must not print plaintext secrets
- must not prompt for passphrase
- must fail after printing guidance to `stderr`

Error/help text must explain:
- direct plaintext reading is discouraged
- use `inspect` for non-sensitive metadata
- use `edit` for human editing
- use `load --protocol-version=1 <path>` for machine loading

### 9.4 `edit <path>`

Purpose:
- interactive plaintext env editing

Flow:
1. detect whether payload needs update
2. in TTY, prompt into `update` if needed
3. decrypt payload
4. write temp plaintext file containing `.env` content only
5. open editor from `$VISUAL`, else `$EDITOR`
6. on editor exit:
   - parse env
   - if invalid, show error and offer return to editor
   - if unchanged, do not rewrite payload
   - if changed, re-encrypt payload using current payload recipient list
7. best-effort secure-delete temp plaintext file

Metadata rule:
- metadata must never appear in editor buffer

Editor fallback rule:
- if neither `$VISUAL` nor `$EDITOR` is set, fail
- error must include exact retry example, eg:
  - `EDITOR=vim bage edit <path>`

### 9.5 `grant <path> [identity-ref]`

Purpose:
- add or refresh one payload recipient

Identity source rules:
- if arg supplied, resolve using standard identity resolution rules
- if arg missing in TTY, let user pick from known identities
- TTY flow must also allow `Paste shared identity string`
- pasted string is first imported into known identities, then granted

Grant write rule:
- one recipient only per command in v0
- no multi-recipient grant in v0

Grant behaves as upsert by `ownerId`:
- if `ownerId` absent: add recipient
- if same `ownerId` present with older snapshot: replace recipient snapshot
- if identical snapshot present: no-op, `recipient already granted`
- if newer snapshot already present than supplied input: no-op warning that provided identity is outdated

Before payload mutation:
- command may import/refresh known identities from current payload recipient snapshots

### 9.6 `revoke <path> [identity-ref]`

Purpose:
- remove one granted identity from payload

Identity source rules:
- supports same user-facing ref forms as `grant`
- authority comes from payload recipients, not home known identities
- exception: local alias may resolve to `ownerId`, but revoke succeeds only if that `ownerId` is actually present in payload

Interactive behavior:
- if arg missing in TTY, let user pick from current payload recipients

Revoke match rule:
- revoke acts at `ownerId` level
- snapshot age does not matter

Self-revoke rule:
- revoking current self identity is forbidden in v0
- no `--force`

If recipient absent:
- no-op with clear message

### 9.7 `inspect <path>`

Purpose:
- human-readable non-secret payload metadata inspection

Must show:
- payload path
- payload schema version
- payload id
- created at
- last rewritten at
- secret count
- recipient count
- recipient list
- env key names

Per-recipient display:
- display name snapshot
- handle
- local alias if known locally
- fingerprint short form
- mark `me` if same `ownerId` as local self
- mark `stale-self` if self is granted but payload still references older self key

Env keys:
- print key names only
- preserve payload order
- never print values
- if empty payload, say `no keys`

Must show:
- `needs update: yes/no`

Must not show:
- secret values
- raw plaintext
- full raw public keys by default
- speculative freshness status for non-self recipients
- JSON output in v0

### 9.8 `update <path>`

Purpose:
- explicit payload maintenance command

Must be:
- documented
- visible in help
- safe to run manually

V0 scope:
- migrate payload schema if needed
- refresh self recipient to local current key if self is granted and stale

Must not:
- auto-upgrade non-self recipients from home data
- perform broad non-self recipient repair
- change ACL intent for external identities

Needs-update conditions in v0:
- payload schema version is older but migratable
- self `ownerId` is granted, but payload fingerprint/public key is not current local active key

Conditions that do not force update:
- stale non-self recipient display snapshot
- non-self fresher identity known only in home state

Failure rules:
- if no local self identity exists:
  - fail
  - print:

```txt
No local self identity found
Run: bage setup
```

- if payload decrypt fails:
  - fail
  - print the decrypt failure

- if payload file is invalid:
  - fail
  - print the payload parse/decode failure

## 10. Payload file format

### 10.1 Outer on-disk file

Payload file remains caller-owned and colocated where user wants it.

Suggested filenames:
- `.env.enc`
- `.env.prod.enc`
- `.env.staging.enc`

Do not use `.age`:
- v0 payload is not a raw plain age ciphertext file

### 10.1.1 Home-state layout

```txt
$BETTER_AGE_HOME/
  state.json
  keys/
    active.key.age
    retired/
      <fingerprint>.key.age
```

Rules:
- `state.json` stores metadata only
- key files store raw age passphrase-encrypted private key material
- key files do not use custom wrapper/envelope in v0

### 10.2 Plaintext preamble

Payload file starts with static or near-static instructional text only.

Preamble may include:
- what file this is
- do not edit manually guidance
- command hints:
  - `inspect`
  - `edit`
  - maybe `read`
- docs URL

Recommended v0 preamble:

```txt
# better-age encrypted env payload
# This file contains encrypted environment variables.
# Do not edit manually. Use: bage inspect <file>
# To change secrets, use: bage edit <file>
# Docs: https://<docs-url>
```

Preamble must not include:
- recipient list
- payload id
- timestamps
- env key names
- any sensitive metadata

### 10.3 Armored payload block

After preamble, file contains explicit armored block:

```txt
# better-age encrypted env payload
# Use: bage inspect <file>
# Use: bage edit <file>
# Docs: <url>
# Do not edit manually.

-----BEGIN BETTER-SECRETS PAYLOAD-----
<armored ciphertext lines>
-----END BETTER-SECRETS PAYLOAD-----
```

Parsing rule:
- parser looks only for first valid outer begin/end marker pair
- parser ignores any comment/preamble text before outer begin marker
- parser ignores any trailing text after outer end marker only if you explicitly choose to support it; v0 may reject trailing non-empty data
- parser must not require exact preamble comment lines
- file-format error only if outer markers are missing, empty, or malformed

Nested armored blocks:
- outer markers identify the better-age container
- inner armored `AGE ENCRYPTED FILE` block is expected ciphertext content
- both markers may appear in one file and that is valid

### 10.4 Inner decrypted envelope

Decrypted inner envelope fields:
- `version`
- `payloadId`
- `createdAt`
- `lastRewrittenAt`
- `recipients`
- `envText`

Recipient entry fields:
- `ownerId`
- `publicKey`
- `fingerprint`
- `displayNameSnapshot`
- `identityUpdatedAt`

Canonical v0 text formats:
- `payloadId` format: `bspld_<16hex>`

Explicitly out of v0:
- payload version id
- audit log
- payload path history
- usage tracking
- per-secret metadata
- retired-key auto-purge indexes

## 11. Env payload semantics

`envText` is plain `.env` content.

Accepted syntax:
- `KEY=value`
- optional empty values
- blank lines
- comment lines starting with `#`

Not promised in v0:
- shell expansion
- multiline heredoc semantics
- duplicate key preservation
- exact formatting round-trip fidelity

Serialization rules:
- parse to ordered key/value entries
- emit normalized `.env` on rewrite
- duplicate keys on parse are invalid and must send user back to editor

## 12. Passphrase behavior

Rules:
- user keys are passphrase-protected by default
- same passphrase protects all local keys
- passphrase is not per-key in UX contract

Caching rule:
- prompt once per CLI invocation when private key material is needed
- passphrase may be cached in memory for that process only
- allowed within same process for chained flow like `update -> edit`

Forbidden in v0:
- OS keychain integration
- cross-process passphrase daemon/cache
- on-disk passphrase cache

## 13. Error posture

Corruption/recovery rule:
- no best-effort partial recovery in v0

Hard fail if any stage fails:
- file format parse
- decryption
- inner envelope schema parse
- env parse during `inspect` or `read`

Errors should identify stage:
- file format
- decryption
- envelope schema
- env content

## 14. Forbidden hidden behavior

V0 must not do any of these silently:
- rewrite payload on read in non-interactive mode
- update non-self recipients in payload from home data
- crawl filesystem to find payloads
- maintain payload usage index
- purge retired keys automatically
- guess among ambiguous display names
- allow self revoke

## 15. Explicit v0 deferrals

Deferred to v1+:
- local alias management command
- self display-name rename
- retired-key purge
- payload usage tracking
- global payload index
- JSON output for `inspect` / `identities`
- multi-recipient grant/revoke
- raw ownerId/fingerprint user-facing refs
- partial repair/recovery
- OS keychain integration

## 16. Message style rules

User-facing output style in v0:
- concise
- factual
- remediation-oriented
- no long prose

Rules:
- errors say what failed and what to run next
- warnings say why no mutation happened
- success says exactly what changed

Exact final strings do not need to be locked in this spec.
