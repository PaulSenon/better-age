# Grill Me V0 Specs

Purpose:
- append-only working log for v0 spec grilling
- preserve resolved decisions + rationale if chat context gets compacted
- source is this interview flow, not earlier brainstorming docs

Scope context:
- package under focus: `packages/cli`
- monorepo placement is temporary convenience only
- goal: define fully working v0 with clear spec/api/usage before broader implementation

Current source docs mentioned by user:
- `SECRET_ENV_CLI_DISCOVERY.md` = early brainstorming only
- `BETTER_AGE_INIT_PLAN.md` = initial bootstrap/vertical slice plan
- `packages/cli/README.md`
- `packages/cli/CONTRIBUTING.md`
- `packages/cli/VISION.md`
- `UBIQUITOUS_LANGUAGE.md`

User's current desired v0 direction, before grilling:
- home scope ideas:
  - `setup`
  - `rotate`
  - list known identities command, wording TBD
  - self-share/export identity command, wording TBD
  - add identity command, wording TBD
  - change passphrase command
- payload scope ideas:
  - `create <path>`
  - `grant <path> <identity>`
  - `revoke <path> <identity>`
  - `read <path>`
  - `edit <path>`
  - `inspect <path>`
- strong product intent:
  - extremely low-friction UX
  - security hygiene defaults automated
  - lazy users should not need deep mental model
  - passphrase prompts on key use
  - one passphrase for all local keys
  - auto key rotation desired
  - auto payload migration desired

## Append-only decision log

### 2026-04-11 - Initialization

Q1. Should any read-like command ever mutate state automatically?

Discussion:
- assistant warned hidden rewrite-on-read is risky:
  - breaks shell expectations
  - awkward in git repos
  - harder for SSH/headless/non-interactive use
  - forces locking/recovery semantics everywhere
- user pushed back because core value is lazy-user UX and auto-hygiene
- compromise proposed: semantic `update` flow, but interactive commands auto-prompt and invoke it

Resolved:
- v0 will have explicit `update <path>` command
- interactive commands may detect needed migration/update and prompt:
  - `Payload needs update before continuing. Update now? [Y/n]`
  - default yes
  - then run internal update flow before original action continues
- non-interactive commands:
  - never prompt
  - never silently mutate
  - must fail with exact remediation (`update` command and/or explicit flag)
- `stdout` for payload-outputting commands must stay clean payload output only
- prompts/warnings/errors go to `stderr`

Design consequence:
- preserves lazy-user DX in TTY
- preserves scriptability + shell sanity in non-interactive mode

Q2. Canonical payload-on-disk format for v0?

Discussion:
- assistant first suggested encrypted JSON envelope with `envText`
- user preferred more self-explanatory/human-guiding on-disk format, inspired by SOPS comments/header
- user is open to JSON/blob internally if comments can explain usage

Partial resolution:
- payload may include a small human-readable plaintext preamble/header
- header is for explanation only:
  - what this file is
  - do not edit manually
  - doc link
  - suggested commands like `inspect`
- actual payload data + actual metadata remain encoded/encrypted as one blob after preamble

Q3. Should v0 include explicit `update <path>` command?

Resolved: yes

Contract:
- `update <path>` exists as first-class command
- interactive commands auto-prompt into it when needed
- non-interactive mode requires explicit update path/flag
- silent mutation with no prompt is forbidden

Q4. Should payload metadata be visible in plaintext on disk before decrypt?

Resolved: no

Contract:
- plaintext preamble/header may exist, but only static instructional text
- no plaintext sensitive metadata on disk outside encrypted blob
- encrypted body contains both metadata and secret content

Rationale:
- avoid leaking recipient list / names / project topology
- simplify integrity model
- keep closer to age mental model

Resolved v0 direction so far:
- payload stays caller-owned, colocated, visible file
- do not move payload into home-state-managed hidden storage for v0
- do not solve git-repo/worktree linkage in v0
- automation belongs in explicit mutating flows or interactive preflight update prompts
- plaintext file surface may teach user how to operate tool
- real metadata remains encrypted

Still unresolved:
- exact command set + final naming
- exact update triggers
- exact payload wire format after header
- exact identity exchange format for `me` / `add identity`
- exact home-state schema
- exact rotate/passphrase commands behavior
- exact `read` vs `open` vs `load` semantics
- exact inspect output contract

Q5. Should v0 expose a plaintext-to-stdout command at all?

Resolved: yes

Contract:
- keep `read <path>`
- `read` decrypts and prints plaintext `.env` to `stdout`
- if `stdout` is a TTY, command refuses by default
- user may override with explicit `--force-tty`
- error/help text must explain:
  - `read` is for pipes/redirection
  - use `edit` for human interaction
- prompts/warnings/errors must go to `stderr`
- interactive update prompt may still occur before `read`
- no separate `open` / `load` command in v0 unless future real integration pressure appears

Rationale:
- preserves unix composability
- supports varlock loader and other env-processing tools
- reduces accidental plaintext leaks to terminal

Q6. What exactly does `me` output?

Resolved:
- `me` outputs one opaque, versioned, copy-paste identity string
- default shape:
  - `better-age://identity/v1/<base64url-json>`
- decoded content includes:
  - `version`
  - `ownerId`
  - `publicKey`
  - `fingerprint`
  - `displayName`
  - optional `createdAt`
  - optional `keyMode`

Contract:
- single-line by default for clipboard/terminal/share ergonomics
- `me` prints only this identity payload to `stdout`
- `add-identity <string>` accepts exactly this format
- optional interactive `add-identity` may prompt user to paste this string
- no field-by-field manual identity construction in v0
- no QR/export/import/file forms in v0

Rationale:
- simplest support and validation story
- avoids partial/ambiguous identity input
- versionable/extensible without breaking UX

Q7. When `add-identity` receives a `me` string for an existing `ownerId` but newer fingerprint, should it auto-update that known identity entry?

Resolved: yes

Contract:
- match known identities by `ownerId`
- if `ownerId` unknown: create new known identity entry
- if known and fingerprint differs:
  - replace current public key and current fingerprint snapshot
  - refresh display snapshot
  - preserve local alias
- if known and same fingerprint:
  - no-op except optional display snapshot refresh
- interactive output should clearly say one of:
  - `added`
  - `updated`
  - `unchanged`
- no required key history retention in known identities for v0

Rationale:
- matches stable owner-id identity model
- makes recipient rotation sharing ergonomic
- avoids address-book duplication on every key rotation

Q8. What exactly is stored per recipient inside a payload?

Resolved: full recipient snapshot, not just bare age recipient.

Contract:
- each payload recipient entry stores:
  - `ownerId`
  - `publicKey`
  - `fingerprint`
  - optional `displayNameSnapshot`
- payload must not store:
  - local alias
  - other home-local mutable metadata

Rationale:
- `inspect` stays useful offline
- `update` can detect stale/retired recipient fingerprints
- payload remains self-contained authority
- file understanding must not depend on local address book state

Q9. What should the minimal home-scope command set be for v0?

Resolved command set:
- `setup`
- `me`
- `add-identity`
- `identities`
- `rotate`
- `change-passphrase`

Contract:
- `me` prints machine-shareable one-line identity export only
- `add-identity` imports someone else's `me` output
- `identities` lists all identities in human-readable form
- `identities` includes own identity too, clearly flagged as `me`
- `rotate` rotates local current key
- `change-passphrase` re-encrypts all local private keys under new passphrase

Naming rationale:
- `identities` is the single human-readable listing/inspection command
- avoids splitting listing across multiple vague words like `known`, `who`, `ls`

Q10. For payload creation, should the command be `create <path>` or `init <path>`?

Resolved: `create <path>`

Contract:
- `create <path>` creates a new payload file at explicit path
- in TTY, after create succeeds, prompt to open editor immediately
- if no local self identity exists:
  - in TTY: prompt user to run `setup` first, then continue
  - in non-interactive mode: fail with exact remediation
- if path arg is omitted in TTY:
  - prompt for filename
  - create in current working directory
- if target path is a directory in TTY:
  - prompt for filename
  - create inside that directory
- filename prompt should suggest a default filename
- initial recipients:
  - self current identity required
  - optional extra recipients may be prompted later if desired
- non-interactive mode:
  - no prompts
  - creates payload from explicit args only

Open decision left by this question:
- final default payload filename is still unresolved

Q11. Default payload filename / extension.

Discussion update:
- concern raised: `.age` suggests direct interoperability with plain `age`
- current v0 direction includes:
  - small plaintext instructional preamble/header
  - custom container/envelope
  - encrypted blob containing both metadata and env content
- therefore file is not a plain raw age ciphertext file
- conclusion from discussion so far: avoid `.age` if raw `age -d` would not directly yield the useful plaintext env payload

Verified external references:
- official `age` docs describe age as a file encryption format/tool and show direct `*.age` whole-file encryption/decryption flows
- official `sops` docs show a separate structured file format that can use age recipients without pretending the file is a raw `.age` payload

Status:
- final default filename still unresolved
- constraint added: extension/name must not falsely imply raw age interoperability

Q11. Default payload filename / extension.

Resolved:
- default filename family should be `.env.*.enc`
- default suggested simple filename may be `.env.enc`
- variants should fit naturally, eg:
  - `.env.prod.enc`
  - `.env.staging.enc`

Constraint:
- do not use `.age` because v0 payload is not a plain raw age ciphertext file
- extension/name must not falsely imply direct raw-age interoperability

Rationale:
- conveys env + encrypted intent clearly
- stays familiar to users scanning a repo
- avoids product-branded or misleading extension choices

Q12. During `create` in TTY, should tool ask to grant known identities immediately?

Resolved: no for v0

Contract:
- `create` creates payload with self recipient only
- `create` may then prompt to open editor
- any sharing/access expansion is done explicitly later with `grant`

Rationale:
- keeps create path minimal
- avoids mixing creation with ACL design
- reduces prompt tree and documentation complexity
- simplifies tests and recovery flows

Q13. Should `grant` and `revoke` accept multiple identities in one command?

Resolved: no for v0

Contract:
- `grant <path> <identity-ref>` handles one recipient only
- `revoke <path> <identity-ref>` handles one recipient only
- interactive mode may prompt for missing identity arg
- output must say exactly what changed

Additional identity-resolution requirements raised by user:
- supported identity ref forms must include:
  - local alias
  - display name
  - handle
  - full shared identity string (`me` output)
- if duplicate display names map to different `ownerId`s:
  - tool should prompt user to assign/use local alias for disambiguation

Status:
- exact canonical precedence/order across all supported identity ref forms is still unresolved after this update

Q14. What is the canonical identity-ref resolution order for v0?

Resolved order:
1. full shared identity string (`better-age://identity/...`)
2. exact local alias
3. exact handle
4. exact display name if unique
5. otherwise fail with candidates and suggest local alias

Additional decisions:
- do not support raw ownerId as user-facing CLI ref in v0
- do not support raw fingerprint as user-facing CLI ref in v0
- no undocumented power-user ref forms in v0

Rationale:
- centers the refs normal humans actually copy/use
- keeps `me` output first-class
- avoids dragging low-level crypto ids into everyday UX
- duplicate display names are handled by local alias disambiguation

Glossary note:
- concept of shareable identity string/ref should be added to `UBIQUITOUS_LANGUAGE.md`
- final term/name still to be chosen

Q15. Should `revoke` ever allow removing your own current identity from a payload?

Resolved: no for v0

Contract:
- if revoke target resolves to current self identity, reject
- error must clearly say self-revoke is forbidden in v0
- no `--force` escape hatch in v0

Rationale:
- prevents accidental lockout
- avoids handoff/recovery edge cases
- keeps v0 behavior conservative and predictable

Q16. What exactly does `rotate` do in v0?

Resolved:
- `rotate` rotates local current key only
- keeps same `ownerId`
- generates new keypair
- encrypts new private key with current passphrase
- marks previous key retired
- updates home-state active-key pointer
- prints guidance to reshare new `me` output
- does not scan or rewrite payload files globally

Payload repair path after rotation:
- payloads get updated later via explicit/interactive `update <path>` flow
- `update <path>` swaps old self recipient snapshot to current one when needed

Rationale:
- rotation stays local and predictable
- no global payload index required
- no hidden filesystem crawl or mass mutation in v0

Q17. What exact conditions make a payload `needs update` in v0?

Resolved conditions:
- local current `ownerId` exists in payload recipients, but fingerprint/public key is not current local active key
- one or more payload recipient entries are duplicates by same `ownerId`
- payload metadata schema version is older but migratable
- stale recipient display snapshot alone does not force update
- stale non-self recipient keys do not force payload update automatically

Resolved `update <path>` scope:
- migrate payload schema if needed
- normalize recipient list
- refresh self recipient to local current key if self is granted and stale
- may update local known-identity data from fresher payload recipient data
- must never auto-update non-self recipients in payload from local address book data
- non-self payload recipient changes remain explicit via `grant` / `revoke`

Additional requirement raised by user:
- identity records should likely carry a UTC timestamp for freshness comparison
- timestamp should exist in:
  - shareable identity string
  - payload recipient entries
- freshness comparison may be used to decide when local known identity can be updated from a fresher payload/shared identity source

Rationale:
- avoids surprising ACL changes for other people
- keeps `update` deterministic and local-self-focused
- allows home address book to learn newer non-self identity snapshots without mutating payload authority implicitly

Q18. What exactly should the identity freshness timestamp mean?

Resolved field: `identityUpdatedAt`

Meaning:
- UTC instant when this identity snapshot became current
- changes when current public key/fingerprint changes
- also changes when display name changes, because display name is part of shared identity snapshot
- does not change on every export/serialization

Presence:
- included in `me` output
- stored in known identity entries
- stored in payload recipient entries

Comparison rules:
- newer `identityUpdatedAt` wins when updating local known identity snapshot
- equal timestamp plus different content => conflict/corruption, fail
- older snapshot never overwrites newer local known identity data
- payload `update` may import fresher non-self snapshot into home state only

Rationale:
- gives one clear freshness signal across identity-sharing surfaces
- separates identity freshness from payload rewrite timestamps

Q19. Duplicate recipient normalization / grant semantics clarification.

User correction:
- duplicate recipient entries for same `ownerId` should not be a normal v0 state
- payload recipients are not user-editable directly
- mutations go through `grant` / `revoke`
- therefore main protection belongs in write-time validation, especially `grant`

Refined v0 decision:
- `grant` must detect same `ownerId` already present in payload
- if same `ownerId` already granted with older snapshot:
  - update that recipient entry in place to newer snapshot
- if same `ownerId` already granted with newer snapshot than provided input:
  - do not mutate payload
  - warn that recipient already has access and provided identity snapshot is outdated
- `update <path>` should not attempt broad non-self recipient normalization/repair logic
- `update <path>` remains focused on:
  - schema migration
  - self recipient refresh when stale
- any parse-time impossible/corrupt duplicate state can still be treated as invalid/corrupt input rather than silently normalized
- re-encryption after `edit` or self-refresh simply encrypts to the payload's current recipient public keys as stored, without extra non-self recipient freshness logic

Rationale:
- keeps v0 honest and small
- puts freshness decisions at explicit ACL mutation points
- avoids over-designing repair paths for states the CLI itself should not create

Q20. When `grant <path> <identity-ref>` targets an `ownerId` already present, should `grant` behave as upsert?

Resolved: yes

Exact behavior:
- if `ownerId` not present: add recipient
- if `ownerId` present with older snapshot: replace recipient snapshot, re-encrypt, print `updated recipient`
- if `ownerId` present with identical snapshot: no-op, print `recipient already granted`
- if `ownerId` present with newer snapshot than provided input: no-op, warn that provided identity is outdated and recipient already has newer access

Rationale:
- matches identity freshness model
- avoids duplicate recipient states
- keeps sharing simple and forgiving

Q21. `revoke` identity resolution scope and missing-arg interactive behavior.

Resolved:
- `revoke` should support same user-facing ref forms as `grant`:
  - local alias
  - display name
  - handle
  - full shared identity string
- but revoke matching truth comes from payload recipient list, not home known-identities data
- exception:
  - local alias may be resolved via home data to an `ownerId`
  - revoke then proceeds only if that `ownerId` is actually present in payload recipients
- fingerprint freshness is irrelevant for revoke intent
- revoke acts at identity (`ownerId`) level

Interactive behavior:
- `grant` without identity-ref should be interactive in TTY and let user pick from known identities
- `revoke` without identity-ref should be interactive in TTY and let user pick from current payload recipients

Rationale:
- grant is driven by what you know locally
- revoke is driven by who currently has access in this payload
- keeps revoke payload-authoritative while preserving ergonomic ref forms

Q22. During interactive `grant` with no identity arg, should user be able to paste a fresh `me` string inline if target isn’t already in known identities?

Resolved: yes

Flow:
- `grant <path>` in TTY may show known identities list
- interactive flow must include option to paste a shared identity string
- if pasted:
  - validate it
  - import/update known identity first
  - continue grant using that identity
- non-interactive mode still requires explicit identity arg

Rationale:
- avoids forcing separate `add-identity` command first
- still keeps one canonical import path under the hood
- improves first-time sharing UX

Q23. What should `identities` show in v0?

Resolved:
- section `Me`
  - display name
  - handle
  - ownerId short form
  - current fingerprint short form
  - `identityUpdatedAt`
  - key status: active
  - rotation TTL summary
  - next rotation due / overdue
  - count of retired keys
- section `Known identities`
  - local alias if any
  - display name
  - handle
  - fingerprint short form
  - `identityUpdatedAt`
- optional collapsed section `Retired local keys`
  - fingerprint short form
  - retired at
  - maybe count only if lower-noise output is preferred

Explicit exclusion:
- no stale/newer markers in `identities` output for v0
- no payload tracking
- no usage stats
- no global payload indexes

Rationale:
- enough for human audit
- supports home-level inspection without dragging payload concerns into it
- avoids feature creep

Q24. Should v0 cache decrypted private-key passphrase in memory for the current process/session, or prompt every operation with no cache?

Resolved: cache in memory for current process only

Contract:
- prompt once per CLI invocation when private key material is needed
- reuse only inside the same process for subsequent internal steps
- no cross-process daemon/session cache
- no OS keychain integration in v0
- no on-disk cache ever

Examples where same-process reuse is allowed:
- `update` then `edit`
- `create` then immediate edit
- `rotate`
- `change-passphrase`

Rationale:
- preserves secure default while avoiding repeated prompts inside one command flow
- stays small and headless-safe

Q25. What exactly does `change-passphrase` touch in v0?

Resolved:
- prompt current passphrase
- prompt new passphrase twice
- decrypt every local private key using old passphrase
- re-encrypt every local private key with new passphrase
- update no payload files
- update no known identities
- operation should fail atomically if any key cannot be re-encrypted/written safely

Rationale:
- matches one-passphrase-for-all-local-keys rule
- keeps operation purely local and predictable

Q26. What should `setup` prompt for, exactly, in v0?

Resolved prompt flow:
- if no display name arg, prompt for display name
- prompt for passphrase
- prompt to confirm passphrase
- prompt for rotation TTL with fixed choices:
  - `1w`
  - `1m`
  - `3m` default
  - `6m`
  - `9m`
  - `1y`

Resolved minimum home-state fields after setup:
- tool home schema/version
- self `ownerId`
- self `displayName`
- active key record containing:
  - fingerprint
  - public key
  - encrypted private key path/ref
  - `identityUpdatedAt`
  - created/activated timestamps
- retired key records list
- rotation TTL config
- known identities map, initially empty

Already-set-up behavior:
- `setup` must not silently overwrite existing local identity
- should print current summary and direct user toward relevant commands like `rotate` or `change-passphrase`

Q27. What exact editor flow should `edit <path>` use in v0?

Resolved:
- decrypt payload to temp plaintext file containing `.env` content only
- launch editor from `$VISUAL`, else `$EDITOR`, else safe fallback
- user edits plain `.env`
- after editor exits:
  - parse env text
  - if invalid, show error and offer return to editor
  - if unchanged, do not rewrite payload
  - if changed, re-encrypt payload with current payload recipient list, after interactive preflight `update` if needed
- best-effort secure delete temp plaintext file after exit
- metadata must never appear in editor buffer

Rationale:
- closest to SOPS editing mental model
- keeps edited content as normal `.env`
- avoids exposing custom container internals to users

Q28. What `.env` syntax should v0 accept?

Resolved: keep simple dotenv semantics only

Accept:
- `KEY=value`
- optional empty value
- blank lines
- comment lines starting with `#`

Do not promise in v0:
- shell expansion
- multiline heredoc semantics
- duplicate key preservation
- comments/formatting round-trip fidelity

Serialization rule:
- parse to ordered key/value entries
- on write, emit normalized `.env`
- if duplicate keys exist on parse, fail and send user back to editor

Rationale:
- predictable and integration-friendly
- avoids pretending to be a shell parser

Q29. What exactly should `inspect <path>` print in v0?

Mostly resolved:
- payload path
- payload schema version
- payload id
- created at
- last rewritten at
- secret count
- recipient count
- recipients list:
  - display name snapshot
  - handle
  - local alias if known locally and resolvable
  - fingerprint short form
  - mark `me` if same `ownerId` as local self
  - mark `stale-self` if self is granted but not current local key
- maybe `needs update: yes/no` summary line

Explicit exclusions:
- no secret values
- no raw secret plaintext
- no full raw public keys by default
- no speculative freshness status for non-self recipients

New requirement raised by user:
- `inspect` should likely expose env key names without values in a safe way
- exact placement/flag still unresolved at this point

Q30. Should `inspect` print env key names by default?

Resolved: yes

Contract:
- `inspect` includes an `env keys` section
- print only variable names, never values
- preserve payload order
- also print secret count
- if payload is empty, say `no keys`
- no separate extra command needed for this in v0

Rationale:
- highly useful
- low leakage relative to plaintext values
- helps confirm correct payload/file
- keeps command surface smaller

Q31. Should v0 include `--json` for `inspect` and `identities`?

Resolved: no for v0

Contract:
- v0 `inspect` output is human-readable only
- v0 `identities` output is human-readable only
- no machine-readable `--json` contract in v0

Rationale:
- current goal is human-first CLI UX
- machine integration path already exists through `read`
- avoids expanding output-contract surface too early

Q32. Should `update <path>` be user-facing in docs/help, or semi-hidden behind interactive prompts?

Resolved: user-facing and documented

Contract:
- `update` appears in CLI help
- `update` appears in README/VISION/spec docs
- positioned as maintenance/repair command
- most users should rarely need to call it manually because interactive flows can prompt into it
- non-interactive failures must point to it explicitly when relevant

Rationale:
- hidden commands create support/documentation debt
- if the command exists semantically, it should be documented honestly

Q33. Should payload files include a static plaintext instructional preamble/header before the encrypted blob?

Resolved: yes

Contract:
- payload files include a plaintext instructional preamble/header before encrypted content
- preamble must remain static or near-static instructional text only
- preamble must not include sensitive metadata, including:
  - recipient list
  - payload id
  - timestamps
  - env key names
- preamble should include:
  - what this file is
  - do not edit manually guidance
  - commands to use such as `inspect`, `edit`, maybe `read`
  - docs URL
- encrypted blob follows after a clear delimiter

Rationale:
- aligns with self-explanatory UX goal
- avoids metadata leakage while keeping file understandable on first open

Q34. What should the encrypted blob representation be inside the payload file?

Resolved: ASCII-armored block with explicit markers

Example shape:
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

Contract:
- parser can split on explicit begin/end markers
- file remains text-friendly
- format must not pretend to be raw `.age`
- decrypted content inside armored ciphertext is the structured v0 envelope

Rationale:
- simple parsing
- good UX when user opens file manually
- easier support/debuggability than mixed inline metadata approaches

Q35. Inner payload envelope fields.

Clarification:
- `payloadId` is included in v0
- excluded field was `payload version id`, not `payloadId`

Current recommended v0 inner envelope fields:
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

Open concern raised by user:
- whether `payloadId` should also support future retired-key auto-purge / payload tracking
- exact retired-key GC strategy remains unresolved

Q36. Should v0 implement automatic retired-key garbage collection based on payload tracking?

Resolved: no, defer to v1+

Contract:
- keep retired local keys indefinitely in v0
- `identities` may show retired key count/details
- no payload usage index in home state
- no auto-purge
- no manual purge command in v0

Rationale:
- safest simple behavior
- avoids silently dropping keys still needed for old payloads
- avoids payload tracking/database complexity in v0

Q37. Should v0 support changing your self display name after `setup`?

Resolved: no, defer to v1+

Contract:
- self display name is chosen at `setup`
- no rename command in v0
- rotation does not rename identity

Rationale:
- avoids extra identity lifecycle churn and resharing semantics in v0
- keeps identityUpdatedAt changes simpler

Q38. Local alias creation/editing scope in v0.

Resolved:
- local alias creation in v0 is implicit/prompted only when needed for duplicate-name disambiguation
- no manual alias-management command in v0
- explicit alias-management command can be added in v1+

Rationale:
- solves the ambiguity problem without expanding command surface too early

Q39. When duplicate display names are detected, should alias assignment be mandatory before continuing?

Resolved: no

Contract:
- if display name is ambiguous, tool should not guess
- interactive flow should show conflicting identities and ask user to choose the specific handle
- after resolving the target, tool may prompt user to save a local alias for future convenience
- saving alias is optional in v0
- non-interactive mode fails with exact ambiguity error and candidate handles

Rationale:
- avoids forcing alias management during the primary task
- still keeps ambiguous name resolution safe and explicit

Q40. Clarified homonym / local-alias flow.

User clarification:
- local aliases are purely home-local overlays for identity-resolution convenience
- local aliases must never leak into payload metadata
- payload may legitimately contain multiple recipients with same display name but different handles/ownerIds

Desired grant/import behavior clarified:
- before mutating payload, command may update home known-identities from payload recipient snapshots when those identities are unknown or fresher locally-relevant imports
- when adding a new identity whose display name collides with an existing known identity of different `ownerId`:
  - add/update the new known identity entry
  - prompt user that another identity already has same display name
  - suggest adding a local alias for convenience
  - alias remains optional
- if no alias is saved, later ambiguous display-name resolution should prompt user to choose among conflicting handles
- after local home-state ambiguity handling, payload mutation proceeds using canonical identity snapshot
- on another machine opening the payload later:
  - unknown payload recipient identities may be imported into local known identities
  - if imported identities create display-name collisions locally, tool may similarly suggest optional local alias

Key invariant restated:
- local alias affects only local UX/resolution
- canonical payload identity remains ownerId + key snapshot

Q40 revised. When opening/inspecting/updating a payload, should unknown recipient identities be auto-imported into home known-identities?

Resolved: yes

Contract:
- on payload decrypt/inspect/edit/grant/revoke/update, tool may import unknown recipient snapshots into home known-identities
- if imported snapshot is fresher than local known snapshot for same `ownerId`, update local known snapshot
- if imported snapshot creates local display-name collision, tool may suggest optional local alias
- home import must never mutate payload by itself

Rationale:
- makes payload a practical identity-discovery source
- improves low-friction UX
- keeps ACL mutation separate from local home-state learning

Q41. When payload file is malformed/corrupt, should v0 ever try best-effort partial recovery?

Resolved: no

Contract:
- if preamble/delimiter/blob parse fails: hard fail
- if decryption fails: hard fail
- if inner envelope parse fails: hard fail
- if env parse fails during `inspect` / `read`: hard fail
- error should clearly identify failing stage:
  - file format
  - decryption
  - envelope schema
  - env content
- no partial repair/recovery logic in v0

Rationale:
- safer and simpler
- avoids fake recovery guarantees

Q42. Plaintext payload preamble style.

Resolved: minimal fixed 5-line block

Example target shape:
```txt
# better-age encrypted env payload
# This file contains encrypted environment variables.
# Do not edit manually. Use: bage inspect <file>
# To change secrets, use: bage edit <file>
# Docs: https://<docs-url>

-----BEGIN BETTER-SECRETS PAYLOAD-----
...
-----END BETTER-SECRETS PAYLOAD-----
```

Rationale:
- enough context on first open
- low churn
- easier snapshot tests
- avoids turning file into a mini tutorial page

Q43. Exact JSON keys inside `me` shared identity string.

Resolved decoded JSON shape:
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

Decisions:
- this is the JSON encoded inside the `me` output string
- use `ownerId`, not `identityId`
- include everything expected in known identity snapshot except local alias
- no local alias in shared string
- no `createdAt` in v0
- no `keyMode` in v0

Rationale:
- aligns shareable identity snapshot with known-identity needs
- keeps v0 format minimal and explicit

Q44. Home directory file layout.

Resolved base layout:
```txt
$BETTER_AGE_HOME/
  state.json
  keys/
    active.key.<ext>
    retired/
      <fingerprint>.key.<ext>
```

Resolved structure rules:
- `state.json` contains:
  - schema version
  - self identity summary
  - active fingerprint
  - retired key metadata list
  - rotation TTL
  - known identities map
- private key files contain encrypted private key material only, not duplicated full metadata

User nuance added:
- if private key files are plain raw age passphrase-encrypted key files, extension should likely be `.age`
- if private key files have custom wrapper/container, extension should stay `.enc`

Status:
- exact key-file extension depends on whether v0 stores raw age-encrypted key payloads or custom-wrapped encrypted key payloads

Q45. Should local private key files be stored as raw age passphrase-encrypted payloads?

Resolved: yes

Resulting key layout:
```txt
$BETTER_AGE_HOME/
  state.json
  keys/
    active.key.age
    retired/
      <fingerprint>.key.age
```

Contract:
- key files must contain raw age passphrase-encrypted private key material
- key files must not use custom wrapper/envelope in v0
- metadata remains in `state.json`

Rationale:
- honest extension
- lower custom format surface
- easier to reason about and potentially interoperate with manually if ever needed

Q46. Fallback editor when `$VISUAL` and `$EDITOR` are absent.

Resolved: fail with exact remediation

Error contract:
- fail if neither `$VISUAL` nor `$EDITOR` is set
- error should state no editor is configured
- error should include corrected retry example with injected editor env, eg:
  - `EDITOR=vim bage edit <path>`

Rationale:
- safest headless behavior
- avoids guessing editor availability
- keeps behavior explicit and portable

Q47. Prompt/error wording specificity for v0.

Resolved: lock style rules + must-have content only, not every exact string

Style contract:
- concise
- factual
- remediation-oriented
- no long prose
- errors say what failed and what to run next
- warnings say why no mutation happened
- success says exactly what changed

Rationale:
- enough for implementation and tests
- avoids premature string bikeshedding

Q48. Should `inspect` always print a `needs update` line, or only when true?

Resolved: always print it

Example shape:
- `needs update: no`
- `needs update: yes (self key is stale)`

Rationale:
- stable output shape
- easier support/debugging
- maintenance state stays explicit

Implementation progress note:
- date: 2026-04-14
- slice-1 command status:
  - done: `setup`
  - done: `me`
  - done: `add-identity`
  - remaining: `identities`
- package status:
  - focused identity export/import tests green
  - `pnpm --dir packages/cli check` green

Implementation progress note:
- date: 2026-04-14
- slice-1 command status:
  - done: `setup`
  - done: `me`
  - done: `add-identity`
  - done: `identities`
  - slice-1 complete
- package status:
  - focused home-scope tests green
  - `pnpm --dir packages/cli check` green

Open design decision:
- current implementation artifact:
  - `ownerId` format is `owner_<16-hex>`
  - handle prefix currently derives from raw `ownerId`, producing awkward values like `name#owner83f`
  - identity string URL currently exposes only opaque payload after `/v1/`
- to revisit before payload-heavy slices:
  - canonical textual `ownerId` format
  - canonical handle suffix source/length
  - whether identity string URL should expose plaintext routing hints like handle / owner short id / generation

Resolved follow-up:
- canonical `ownerId` format: `bsid1_<16hex>`
- canonical handle format: `<display-name>#<first-8-hex-of-owner-id-body>`
- example:
  - owner id: `bsid1_069f7576d2ab43ef`
  - handle: `toto#069f7576`
- identity string payload remains authoritative
- current URL path stays opaque in v0
- future plaintext URL path hints are allowed only as cosmetic fields, never as trusted authority
- implementation note:
  - current code still uses old temporary `owner_<hex>` artifact
  - fix before payload-heavy next slices so identity text contracts do not drift further

Resolved phase-2 identifier decision:
- canonical `payloadId` format: `bspld_<16hex>`
