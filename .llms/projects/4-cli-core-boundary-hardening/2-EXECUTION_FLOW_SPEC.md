# Execution Flow Spec

Status: active spec. Plain-text flow chunks are intentional source of truth.

## Flow Notation

- `exact`: every mandatory non-secret operand is supplied by argv.
- `guided`: one or more mandatory non-secret operands must be collected by CLI flow.
- `interactive`: passphrase prompts, menus, custom text inputs, editor, and viewer may run.
- `headless`: no passphrase prompt or human UI is available.
- `Payload Context`: command-local in-memory decrypted payload context.
- passphrase retry policy: 3 total attempts, inline prompt loop, no chooser menu.

Operand classes:

- `promptable`: CLI may collect it in guided interactive mode.
- `protocol`: CLI must receive it from argv/protocol; no human prompt.
- `secret`: passphrase/new passphrase; never argv and never exactness input.

## Command Exactness Table

Mandatory non-secret operands:

```txt
setup: --name for exact/headless; guided may prompt
create: path
edit: path
grant: path + identity-ref
inspect: path
load: path + --protocol-version
revoke: path + identity-ref
update: path
view: path

identity export: none
identity import: identity-string
identity forget: identity-ref
identity list: none
identity passphrase: none
identity rotate: none
interactive: none
```

Rules:

- complete mandatory operands => exact invocation.
- missing any mandatory operand => guided invocation.
- missing protocol operands fail immediately; they are not guided by prompt.
- passphrase is never a mandatory operand for exactness.
- commands with no mandatory operands are exact by default, though they may still prompt for credentials.

Protocol operands:

```txt
load: --protocol-version
```

## Headless Credential Rule

Credential-required commands:

```txt
setup
create
edit
grant
inspect
load
revoke
update
view
identity passphrase
identity rotate
```

Headless behavior for credential-required commands:

```txt
validate command shape and protocol operands
if protocol operand is missing/unsupported:
  fail protocol error
validate promptable operands enough to report specific missing-arg errors
if promptable operands are missing:
  fail missing-arg error
else:
  fail passphrase unavailable
do not prompt
do not decrypt
do not mutate
```

Headless-allowed commands:

```txt
identity export
identity import # if identity-string passed and --alias is valid if used
identity forget # if identity-ref passed
identity list
```

## Interactive Session Flow

Applies to:

- `bage interactive`
- `bage i`

```txt
if terminal is headless:
  fail INTERACTIVE_UNAVAILABLE

open session menu
route selections into same command flows used by direct commands
own session menu stack
```

Rules:

- interactive session is CLI-only.
- interactive session contains no separate business logic.
- session Back returns to previous menu.
- session Cancel exits the interactive session.
- command flows invoked from the session keep their own local back/cancel semantics.

## Top-Level Exit Mapping

```txt
success:
  exit 0

unchanged success:
  exit 0

Ctrl+C abort:
  exit 130

menu/editor/user cancel:
  exit 1
  quiet or non-scary cancellation message

Back out of standalone guided command:
  exit 1
  same behavior as user cancel

domain/user error:
  exit 1

internal defect:
  exit 1 for MVP
```

## Home State Preflight

Applies to:

- all commands except `setup`

Does not apply to:

- `setup`, because missing home state is the expected setup path.

Flow:

```txt
parse command shape enough to know selected command
validate static argv/protocol errors that do not need home state
if command is setup:
  skip global home preflight
else:
  run core.lifecycle.runHomeStatePreflight()

if HOME_STATE_NOT_FOUND:
  fail setup-required with remediation

if home migration succeeds:
  continue command
  emit INFO.HOME.STATE_MIGRATED

if home read/invalid/compatibility/write failure:
  fail mapped home error
```

Rules:

- preflight happens before passphrase prompts.
- preflight happens before payload reads.
- malformed command/protocol errors can fail before preflight.
- headless missing promptable operands can fail before preflight.
- guided interactive prompts happen after preflight.
- preflight notices for machine stdout commands go to stderr.
- core commands/queries still include home read errors because they must be safe without CLI preflight.

## Shared Failure Ordering

For credential-required commands:

```txt
1. validate command shape
2. validate protocol operands
3. if headless and promptable operands are missing, fail missing operand
4. run global home preflight except setup
5. resolve or validate promptable operands
6. fail missing promptable operands if still incomplete
7. run cheap non-secret path/file checks when available
8. if headless, fail PASSPHRASE_UNAVAILABLE
9. prompt passphrase in interactive mode
10. call core
```

Rules:

- do not prompt passphrase before known operand/protocol errors.
- do not prompt passphrase before cheap file existence checks.
- do not decrypt or mutate in headless credential-required flows.

## Payload-Content Command Flow

Applies to:

- `inspect`
- `view`
- `edit`
- `grant`
- `revoke`
- `update`
- `load`

Does not apply to:

- `create`, because it does not read an existing payload.

### Exact + Interactive

```txt
validate mandatory operands
read payload file
if file missing/invalid/unreadable:
  fail before passphrase prompt
ask passphrase
decrypt/open Payload Context
if passphrase/access/decrypt fails:
  retry passphrase inline up to 3 total attempts
  if attempts exhausted:
    fail with decrypt/passphrase error
continue command-specific flow
```

### Guided + Interactive

```txt
resolve missing payload path
read payload file
if file missing/invalid/unreadable:
  offer local retry/back/cancel where possible
ask passphrase
decrypt/open Payload Context
if passphrase/access/decrypt fails:
  retry passphrase inline up to 3 total attempts
  if attempts exhausted:
    fail with decrypt/passphrase error
continue command-specific flow with Payload Context
```

### Exact + Headless

```txt
validate mandatory operands
fail fast with passphrase-unavailable remediation
do not prompt
do not decrypt
```

### Guided + Headless

```txt
fail fast because missing operands cannot be collected
if operands are somehow complete, still fail fast because passphrase cannot be acquired
do not prompt
do not decrypt
```

### Passphrase Retry Copy Shape

```txt
Passphrase: ***
Invalid passphrase. Try again.
Passphrase: ***
Invalid passphrase. 1 attempt left.
Passphrase: ***
Failed to decrypt. Invalid passphrase.
```

Rules:

- exact + interactive retries passphrase only.
- guided + interactive retries passphrase only.
- wrong passphrase does not reopen operand choosers.
- wrong passphrase does not show an intermediate retry/back/cancel menu.
- user abort during prompt is still cancel.
- headless never reaches decrypt.

## Core Mutation Statelessness

CLI may open a `Payload Context` early for UX.

Core mutation commands remain stateless and canonical:

```txt
editPayload(path, passphrase, editedEnvText)
grantPayloadRecipient(path, passphrase, recipient)
revokePayloadRecipient(path, passphrase, recipientOwnerId)
updatePayload(path, passphrase)
```

Rules:

- opened payload context is CLI UX convenience only.
- core mutation commands do not accept an opened payload object.
- core mutation commands re-open/revalidate from path + passphrase.
- double decrypt in guided flows is acceptable for simplicity and safety.
- this avoids stale in-memory payload mutation after file changes.

## Guided Invalid Payload Path Recovery

Applies when a guided payload path was selected or entered, then payload file read/validation fails.

```txt
show path/file error
return to payload path picker
preserve previous suggestions
allow custom path entry again
Back/Cancel remain available from picker
```

Exact invocation does not use this recovery:

```txt
show path/file error
exit failure
```

## Guided Grant Recipient Picker

Applies after guided `grant` has opened a `Payload Context`.

```txt
load local self identity
load local known identities
read current payload recipients from Payload Context
merge by Owner Id:
  self identity
  payload recipients
  known identities
resolve local aliases for any matching known identity
render one identity line per merged identity
include custom identity string entry
```

Rendering rules:

```txt
self identity:
  disabled("<name-or-alias> <owner-id> [you]")

already granted identity:
  disabled("<alias > name> <owner-id> [granted]")

grantable identity:
  selectable("<alias > name> <owner-id>")

custom identity string:
  selectable("Enter identity string...")
```

Rules:

- one picker, not separate known/granted/custom steps.
- payload recipients and known identities are merged by `OwnerId`.
- local alias is a render overlay only.
- already-granted identities are visible but disabled.
- self identity is visible but disabled.
- custom identity string parses to `PublicIdentitySnapshot`.
- selecting a grantable known identity passes strict known identity target.
- selecting a custom identity string passes strict public identity target.

## Payload Recipient Discovery Policy

Applies when opening a `Payload Context` exposes recipient identity snapshots.

MVP policy:

```txt
for each payload recipient:
  if OwnerId is already a known identity:
    if payload recipient snapshot is newer:
      silently update known identity
    else:
      keep local known identity unchanged
  else:
    do not auto-import
    use recipient identity transiently for current command rendering/logic
```

Rules:

- known identity freshness update is silent.
- unknown payload recipients do not grow the address book in MVP.
- unknown payload recipients may still appear in current command UI.
- no alias prompt inside payload command flow in MVP.

Future needed flow:

```txt
detect unknown payload recipients
offer import flow in interactive context
loop through new identities
for each identity:
  import or skip
  if display-name collision:
    optionally prompt for local alias
persist selected known identities
```

Potential future bindings:

- triggered opportunistically after opening a payload in interactive flows
- dedicated command to import identities from payload
- both, if UX remains simple

## Grant Recipient Idempotence

Applies to exact and guided `grant` after recipient target is resolved.

```txt
open Payload Context
resolve recipient target
if recipient OwnerId is not in payload:
  add recipient snapshot
  persist payload
  success: added

if recipient OwnerId is already in payload:
  if provided recipient snapshot is newer than payload recipient snapshot:
    replace old payload recipient snapshot
    persist payload
    success: updated
  else:
    do not rewrite payload
    success: unchanged already granted
```

Rules:

- already-granted is not an error.
- exact and guided share the same core grant semantics.
- refresh means overwrite the previous older payload recipient snapshot.
- picker may disable already-granted identities, but exact command still handles already-granted idempotently.

## Grant Self Policy

Exact `grant`:

```txt
if resolved recipient OwnerId equals self OwnerId:
  fail CANNOT_GRANT_SELF
  exit non-zero
```

Guided `grant`:

```txt
render self identity in Grant Recipient Picker
mark disabled [you]
prevent selection
```

## Guided Revoke Recipient Picker

Applies after guided `revoke` has opened a `Payload Context`.

```txt
read current payload recipients from Payload Context
load local known identities for alias overlay
render payload recipients only
if recipient OwnerId equals self OwnerId:
  disabled("<alias > name> <owner-id> [you]")
else:
  selectable("<alias > name> <owner-id>")
```

Rules:

- do not show known identities that are not payload recipients.
- local alias is a render overlay only.
- self recipient is visible but disabled.

## Revoke Recipient Policy

Exact `revoke`:

```txt
resolve identity-ref to OwnerId
if OwnerId equals self OwnerId:
  fail CANNOT_REVOKE_SELF
  exit non-zero

if OwnerId is not granted:
  do not rewrite payload
  success: unchanged not granted

if OwnerId is granted:
  remove recipient
  persist payload
  success: removed
```

Guided `revoke`:

```txt
select recipient from Guided Revoke Recipient Picker
remove selected recipient
persist payload
success: removed
```

## Update Payload Policy

`update` is explicit maintenance only.

Allowed rewrite reasons:

- `payload-format-migration`
- `self-recipient-refresh`

Flow:

```txt
open Payload Context
compute update reasons
if no update reasons:
  do not rewrite payload
  success: unchanged

if update reasons exist:
  rewrite payload with current schema
  refresh current self recipient snapshot
  persist payload
  success: updated with reasons
```

Rules:

- no broader repair behavior in MVP.
- no hidden mutation outside listed reasons.
- `update` is idempotent.

Future hardening:

```txt
before replacing payload file:
  encrypt updated payload in memory
  decrypt/reopen updated payload in memory
  only persist if reopen succeeds
```

## Outdated Payload Write Gate

Applies to `edit`, `grant`, and `revoke` when `Payload Context` is readable but mutation requires a persisted update first.

### Exact + Interactive

```txt
fail with remediation:
  run bage update <path>
do not show gate
do not mutate
```

### Guided + Interactive

```txt
show gate:
  Update now
  Back
  Cancel

if Update now:
  run update
  resume original command with same path/passphrase where valid

if Back:
  return to previous local guided step

if Cancel:
  stop command
```

### Headless

```txt
fail fast with remediation:
  run bage update <path>
do not prompt
do not mutate
```

## Edit Payload Flow

Applies after `edit` has opened a `Payload Context` and passed any outdated write gate.

```txt
open editor with current envText

if editor cancel/no-save:
  cancel command

if edited text is identical:
  do not rewrite payload
  success: unchanged

if edited text is invalid .env:
  show validation error
  reopen editor with previous edited text
  allow user to fix or cancel

if edited text is valid and changed:
  rewrite payload with edited envText
  persist payload
  success: edited
```

Rules:

- editor cancel is cancel, not success.
- identical saved content is success unchanged.
- invalid `.env` does not discard user's edited text.

## Payload Read Output Flows

Applies after `view`, `inspect`, or `load` opens a `Payload Context`.

### View

```txt
open secure viewer with envText
never print plaintext to stdout
viewer close:
  success
```

### Inspect

```txt
render payload metadata
render env key names
render recipients
never render plaintext values
success
```

### Load

```txt
print raw envText to stdout only
print warnings/notices to stderr
success
```

### Readable-But-Outdated Payload

For `view`, `inspect`, and `load`:

```txt
open payload using in-memory migration
complete requested read behavior
emit update-recommended warning/remediation
do not persist payload
```

## Identity Import Flow

Applies to `bage identity import`.

### Exact

```txt
parse identity string
if identity is self:
  fail CANNOT_IMPORT_SELF

ask optional local alias when interactive

if OwnerId is unknown:
  add known identity with optional local alias
  success: added

if OwnerId is already known:
  if imported snapshot is newer:
    update known identity with imported snapshot
    update local alias if provided
    success: updated
  else:
    update local alias if provided
    success: unchanged or alias-updated
```

### Guided + Interactive

```txt
prompt/paste identity string
parse identity string
if identity is self:
  fail CANNOT_IMPORT_SELF
ask optional local alias
run same import semantics as exact
```

### Guided + Headless

```txt
fail fast because identity string cannot be collected
```

Rules:

- `identity import` is the MVP place to set or change a local alias.
- alias prompt does not happen inside payload-open flows.
- local alias is home-local display overlay only.
- import never mutates payloads.

### Alias Input

Interactive prompt shape:

```txt
Imported identity:
  <display-name> <owner-id>

Local alias? (optional, Enter to skip):
```

Validation:

```txt
empty on new identity:
  no alias

empty on existing identity:
  keep existing alias

invalid alias:
  show error
  retry alias prompt

duplicate alias:
  show error
  retry alias prompt
```

Exact/headless flag:

```txt
bage identity import <identity-string> --alias <alias>
```

Rules:

- `--alias` is optional.
- invalid `--alias` hard-fails.
- duplicate `--alias` hard-fails.
- explicit alias removal is not in MVP.

Future alias commands:

```txt
bage identity alias add [<identity-ref>] [<alias>]
bage identity alias remove [<identity-ref>] # possible alias: rm
```

## Identity Forget Flow

Applies to `bage identity forget`.

### Exact

```txt
resolve identity-ref among known identities
if identity-ref does not resolve:
  fail IDENTITY_REFERENCE_NOT_FOUND

if resolved identity is known:
  remove known identity
  remove local alias if any
  success: forgotten
```

### Guided + Interactive

```txt
show picker of known identities only
Back/Cancel available
select known identity
remove known identity
remove local alias if any
success: forgotten
```

Rules:

- forget never touches payloads.
- guided picker only shows known identities.
- exact not found is an error, not unchanged success.

## Identity List Flow

Applies to `bage identity list`.

Output sections:

```txt
Self
  display name
  owner id
  fingerprint
  key mode
  rotation status

Known identities
  alias overlay
  display name
  owner id
  fingerprint

Retired keys
  fingerprint
  retired at
```

Rules:

- no private key material.
- no passphrase.
- no payload access.
- works headless because no prompt is needed.
- if no setup, fail `HOME_STATE_NOT_FOUND` with `bage setup` remediation.

## Identity Export Flow

Applies to `bage identity export`.

```txt
load self identity
serialize current public identity snapshot as identity string
print identity string to stdout only
```

Rules:

- stdout is pipe-safe and unstyled.
- no surrounding copy on stdout.
- warnings/notices, if ever needed, go to stderr.
- works headless.
- no passphrase.
- if no setup, fail `HOME_STATE_NOT_FOUND` with `bage setup` remediation.
- exports current public identity only.
- never exports retired keys.

## Identity Rotate Flow

Applies to `bage identity rotate`.

```txt
ask passphrase
decrypt local private key material
create new current key for same OwnerId
move old key to retired keys
update self public identity snapshot:
  publicKey
  identityUpdatedAt
  derived fingerprint changes
persist home state
render success
render remediation:
  run bage update on payloads where self recipient is stale
```

Rules:

- no payloads are rewritten.
- same `OwnerId` is preserved.
- old key remains available for historical decryptability.
- command has no non-secret operands.
- interactive mode prompts passphrase with standard 3-attempt retry.
- headless fails passphrase unavailable.

## Identity Passphrase Flow

Applies to `bage identity passphrase`.

```txt
ask current passphrase
try decrypt current private key with current passphrase
if wrong:
  retry current passphrase inline up to 3 total attempts
  if attempts exhausted:
    fail passphrase incorrect

ask new passphrase
ask confirm new passphrase
if mismatch:
  retry new/confirm pair

decrypt all local private keys with current passphrase:
  current key
  retired keys
reencrypt all local private keys with new passphrase
persist home state
success
```

Rules:

- current key decrypt is the credential check.
- passphrase change covers all local private key material.
- current and retired keys must end encrypted with the new passphrase.
- headless fails passphrase unavailable.

## Setup Flow

Applies to `bage setup`.

Inputs:

- `--name <display-name>` for exact/headless.
- guided interactive may prompt display name when missing.

### Already Configured

```txt
if self identity already exists:
  fail SETUP_ALREADY_CONFIGURED
```

### Exact + Interactive

```txt
require --name
validate display name
ask passphrase
ask confirm passphrase
if mismatch:
  retry passphrase pair
create OwnerId
create keypair
encrypt current private key with passphrase
persist home state
success
```

### Guided + Interactive

```txt
if --name missing:
  prompt display name
validate display name
ask passphrase
ask confirm passphrase
if mismatch:
  retry passphrase pair
create OwnerId
create keypair
encrypt current private key with passphrase
persist home state
success
```

### Headless

```txt
require --name
fail passphrase unavailable
do not create identity
```

Rules:

- no positional display-name argument.
- exact/headless require `--name`.
- setup creates the self identity only once.

## Create Payload Flow

`create` has no existing payload to read, but still requires passphrase acquisition to encrypt with the passphrase-protected self key.

### Exact + Interactive

```txt
validate mandatory path operand
if target already exists:
  fail before passphrase prompt
ask passphrase
create/encrypt payload
persist payload file
render success
```

### Guided + Interactive

```txt
resolve missing target path
if target already exists:
  offer local retry/back/cancel where possible
ask passphrase
create/encrypt payload
persist payload file
render success
```

### Exact + Headless

```txt
validate mandatory path operand
fail fast with passphrase-unavailable remediation
do not prompt
do not create payload
```

### Guided + Headless

```txt
fail fast because missing target path cannot be collected
if path is somehow complete, still fail fast because passphrase cannot be acquired
do not prompt
do not create payload
```

### Core/CLI Split

Core `createPayload(path, passphrase)`:

```txt
load self identity
decrypt current private key with passphrase to prove credential
create empty payload for self recipient
encrypt payload
persist payload file
success
```

Rules:

- core create always creates an empty payload.
- core create does not open editor.
- core create does not decide next CLI action.

Optional future/CLI flow:

```txt
after successful interactive create:
  offer or automatically start edit flow for the new payload
```
