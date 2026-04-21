# Better Secrets Error Handling Source Of Truth

Current scope: `packages/cli` only.

Purpose:
- map current success + failure paths before any overhaul
- show TTY vs non-TTY behavior
- show command + interactive branching
- flag current raw-error leak points and inconsistency

Desired-state flow notation:
- [INTERACTION_FLOW_SPEC.md](./1-INTERACTION_FLOW_SPEC.md)

Non-goals:
- no proposed redesign yet
- no desired-state API yet

## Root Execution Model

Entrypoint:
- `src/cli/main.ts` -> `runCliMain(process.argv)`
- `src/cli/program.ts` builds root command tree and provides `BetterAgeLive`

Root exit behavior:
- command success -> returns exit code `0`
- known command failure class -> root maps to exit code `1`
- each command is expected to print its own stderr before failing
- uncaught typed errors, defects, thrown exceptions, layer init failures -> not normalized here; Effect/Node runtime handles them

Current runtime composition:
- `BetterAgeLive` is grouped into coarse bundles in `src/program/layer.ts`
  - `InfraLive`
  - `IdentityAppLive`
  - `PayloadAppLive`
  - `CliFlowLive`
- `ResolveNewPayloadTarget` is provided inside the grouped runtime; CLI bootstrap no longer special-cases it

Root command set:
- `setup`
- `interactive`
- `me`
- `add-identity`
- `forget-identity`
- `identities`
- `rotate`
- `change-passphrase`
- `create`
- `edit`
- `grant`
- `revoke`
- `inspect`
- `view`
- `load`
- `update`

## Current Output Rules

Current user-facing sinks:
- success mostly writes to `stdout` via `Prompt.writeStdout`
- failure mostly writes to `stderr` via `Prompt.writeStderr`
- some non-failure status also writes to `stderr`

Known success/info-on-stderr cases:
- `ResolvePayloadTarget.resolveExistingPath` writes `Using <path>` to `stderr` when exactly one payload is auto-selected
- update-remediation prompts are written to `stderr` even when they are actionable guidance, not stack traces

Current logging inside app layer:
- `CreateUserIdentity` emits `Effect.logInfo("Created user identity")`
- `CreateUserIdentity` emits `Effect.logWarning("Private-key rollback failed")` on rollback failure
- other app flows do not emit matching structured failure logs

Current failure formatting:
- mixed
- central renderer + warning writer exist in `src/cli/shared/userFacingMessage.ts`
- migrated branches such as `setup`, `me`, `identities`, `add-identity`, `rotate`, `change-passphrase`, `inspect`, `load`, and `update` use renderer ids
- mutation-heavy branches such as `edit`, `grant`, `revoke`, `view`, and parts of `interactive` still write raw adapter/app messages directly
- no centralized failure icon / red X
- no shared error code taxonomy

## TTY / Non-TTY Matrix

| Surface | Needs TTY | Current failure when unavailable |
| --- | --- | --- |
| `Prompt.inputSecret` | yes (`stdin` + `stderr`) | `Interactive secret input is unavailable` |
| `Prompt.inputText` | yes (`stdin` + `stderr`) | `Interactive text input is unavailable` |
| `InteractivePrompt.select` | yes (`stdin` + `stderr`) | `Interactive selection is unavailable` |
| `SecureViewer.view` | yes (`stdin` + `stderr`) | `Secure viewer is unavailable in this environment. Use an interactive TTY.` |

TTY-sensitive commands:
- always interactive: `interactive`, `view`
- interactive unless all required args are passed and no chooser is needed: `setup`, `add-identity`, `create`, `edit`, `grant`, `revoke`, `inspect`, `update`, `load`, `rotate`, `change-passphrase`

Non-TTY helpers that still fail later:
- omitted payload path with 0 discovered payloads -> falls back to text prompt -> fails on non-TTY
- omitted payload path with many discovered payloads -> falls back to select prompt -> fails on non-TTY
- overwrite prompt in `create` -> fails on non-TTY with explicit remediation
- identity chooser in `grant` / `revoke` / `forget-identity` -> fails on non-TTY if arg omitted and chooser needed
- update-required exact-mode `edit` / `grant` / `revoke` -> command prints remediation and fails without entering interactive gate

## Shared Flow Primitives

### Payload path resolution

Source: `src/app/shared/ResolvePayloadTarget.ts`

```
input path present?
  yes -> use it directly
  no -> discover .env*.enc in cwd
    0 found
      TTY -> prompt "Payload path"
      non-TTY -> fail ResolvePayloadTargetError:
        "No payload path provided and no .env*.enc payloads were found in the current directory.
        Pass a path explicitly."
    1 found
      -> stderr "Using <path>"
      -> use discovered path
    >1 found
      TTY -> select prompt "Select payload"
      non-TTY -> fail ResolvePayloadTargetError:
        "Multiple .env*.enc payloads were found in the current directory.
        Pass one path explicitly:
        ..."
```

### Identity ref resolution

Shared prompt helper: `src/cli/shared/identityRefPrompt.ts`

```
explicit identity ref present?
  yes -> use it
  no ->
    choices empty and no identity-string option
      -> prompt freeform text "Identity ref"
    otherwise
      -> interactive select
      -> optional branch "Paste/import identity string"
         -> prompt freeform text "Identity string"
```

Command-specific data sources:
- `grant` chooser uses `knownIdentities`
- `revoke` chooser uses current payload recipients and disables `[you]`
- `forget-identity` chooser uses `knownIdentities`

### Passphrase session cache

Source: `src/cli/shared/passphraseSession.ts`

Used by:
- `edit`
- `grant`
- `revoke`

Behavior:
- first `Prompt.inputSecret("Passphrase: ")` value is cached
- later retries in same command reuse cached passphrase
- consequence: after an update/retry branch, same passphrase is reused unless command creates a fresh session

### Payload update gate

Source: `src/cli/shared/updateGate.ts`

Behavior:
- guided interactive mutation flows use a real three-way gate
  - `Update now`
  - `Back`
  - `Cancel`
- exact-mode commands do not enter the gate; they render remediation and fail
- flow callers translate:
  - `updated` -> resume blocked mutation
  - `back` -> return to previous local guided step
  - `cancel` -> quiet cancel

Rendered remediation for exact-mode/update-required failures:
- `Payload must be updated before <edit|grant|revoke>`
- `Run: bage update <path>`

### Editor resolution

Source: `src/app/shared/ResolveEditorCommand.ts`

Priority:
1. `BETTER_AGE_EDITOR`
2. saved default editor in home state
3. `$VISUAL`
4. `$EDITOR`
5. interactive chooser

Chooser branch:
```
no configured editor
  TTY -> select editor -> select use mode
    "Use once" -> return command
    "Save as default" -> persist + return command
    "Back" -> restart chooser
  non-TTY -> ResolveEditorCommandUnavailableError:
    "No editor configured.
    Set BETTER_AGE_EDITOR, use a saved default, or set $VISUAL/$EDITOR, then retry."
```

## Command Trees

## `setup`

Source: `src/cli/command/setupUserKey.ts`

```
resolve alias
  --alias provided -> use it
  else -> prompt "Alias" with default "<username>@<hostname>"

resolve passphrase
  prompt secret + confirm secret

passphrases equal?
  no -> retry pair prompt
  yes -> CreateUserIdentity.execute
```

Success:
- stdout:
  - `Created user key <fingerprint> (<displayName>)`
  - public key on next line
  - `Home: <rootDirectory>`

Handled failures -> stderr + exit `1`:
- active key exists
- create-user crypto error
- create-user persistence error
- invalid alias
- prompt aborted
- prompt unavailable
- passphrase mismatch

Raw/leaky edges:
- `CreateUserIdentity` has internal `Effect.orDie` on display name decoding invariant
- config/layer failures bypass command catch

## `me`

Source: `src/cli/command/meCommand.ts`

```
ExportIdentityString.execute
  self exists -> stdout identity string
  self missing -> stderr message -> fail -> exit 1
  persistence error -> stderr message -> fail -> exit 1
```

Success:
- stdout identity string only

Raw/leaky edges:
- `ExportIdentityString` uses `Effect.orDie` for schema invariant when encoding identity string

## `add-identity`

Source: `src/cli/command/addIdentityCommand.ts`

```
identity-string arg present?
  yes -> use it
  no -> prompt "Identity string"

ImportIdentityString.execute
  malformed -> stderr -> exit 1
  conflict -> stderr -> exit 1
  persistence error -> stderr -> exit 1
  success added|updated|unchanged -> stdout "<outcome> <displayName> (<handle>)"
```

## `forget-identity`

Source: `src/cli/command/forgetIdentityCommand.ts`

```
identity-ref arg present?
  yes -> use it
  no -> load home state -> select known identity

ForgetIdentity.execute
  ambiguous -> stderr rendered candidate list -> exit 1
  self target -> stderr "Forgetting current self identity is forbidden in v0" -> exit 1
  persistence error -> stderr -> exit 1
  unchanged -> stdout "identity not known locally: <ref>"
  removed -> stdout "forgot local identity <handle>"
```

Special notes:
- ambiguous candidate rendering tries to reload home state; if reload fails it falls back to plain handles

## `identities`

Source: `src/cli/command/identitiesCommand.ts`

```
InspectHomeIdentities.execute
  success -> stdout sections:
    Me
    Known identities
    Retired local keys
  persistence error -> stderr -> exit 1
```

Success output includes:
- me display name, handle, shortened owner id, shortened fingerprint
- rotation ttl + due date + overdue marker
- known identities with optional local alias
- retired key list

## `rotate`

Source: `src/cli/command/rotateUserIdentity.ts`

```
prompt secret "Passphrase: "
RotateUserIdentity.execute
  no active identity -> stderr -> exit 1
  persistence error -> stderr -> exit 1
  crypto error -> stderr -> exit 1
  prompt aborted/unavailable -> stderr -> exit 1
  success -> stdout:
    "rotated identity <old> -> <new>"
    "Share updated identity: bage me"
```

Raw/leaky edges:
- domain helper `buildRotatedHomeState` throws plain `Error` if invariant breaks

## `change-passphrase`

Source: `src/cli/command/changePassphraseCommand.ts`

```
prompt current passphrase
prompt new passphrase
prompt confirm new passphrase
match?
  no -> stderr "Passphrases do not match" -> exit 1
  yes -> ChangePassphrase.execute
    no active identity -> stderr -> exit 1
    persistence error -> stderr -> exit 1
    crypto error -> stderr -> exit 1
    success -> stdout "updated passphrase for all local keys"
```

Rollback note:
- app rolls back already-written key files on partial write failure
- rollback failure is swallowed, not logged to user

## `create`

Source: `src/cli/command/createPayloadCommand.ts`

```
path arg present?
  yes -> use it
  no -> prompt "Payload path" default ".env.enc"

PathAccess.exists(path)?
  no -> create directly
  yes ->
    TTY -> select:
      Overwrite -> continue
      Back -> return success/no output
    non-TTY -> PromptUnavailableError:
      "Payload already exists: <path>
      Pass a different path explicitly."

CreatePayload.execute
  no local identity -> stderr -> exit 1
  persistence error -> stderr -> exit 1
  crypto error -> stderr -> exit 1
  prompt aborted/unavailable -> stderr -> exit 1
  success -> stdout "Created encrypted payload at <path>"
```

## `inspect`

Source: `src/cli/command/inspectPayloadCommand.ts`

```
resolve payload path
prompt secret "Passphrase: "
InspectPayload.execute
  persistence/file-format/crypto/envelope/env error -> stderr -> exit 1
  success -> stdout payload report
```

Success report sections:
- payload metadata
- recipients
- env keys

Recipient annotations:
- `[you]` for current self
- `stale-self` if payload grants an older self key
- local alias prefix when available

## `load`

Source: `src/cli/command/loadPayloadCommand.ts`

```
--protocol-version provided?
  no -> stderr missing-protocol message -> exit 1
  yes but unsupported -> stderr unsupported-version message -> exit 1
  yes and supported -> continue

prompt secret "Passphrase: "
ReadPayload.execute
  crypto error -> stderr "Failed to decrypt payload with provided passphrase" -> exit 1
  persistence/file-format/envelope/env error -> stderr -> exit 1
  needs update -> stderr remediation -> exit 1
  success -> stdout raw env text
```

Protocol messages:
- missing:
  - `Missing required protocol version`
  - `Run with: --protocol-version=1`
- unsupported:
  - `Unsupported protocol version: <received>`
  - `This better-age CLI supports protocol version 1.`
  - `Update the caller/plugin to a compatible version.`

## `update`

Source: `src/cli/command/updatePayloadCommand.ts`

```
resolve payload path
prompt secret "Passphrase: "
UpdatePayload.execute
  unchanged -> stdout "payload already up to date: <path>"
  updated -> stdout "updated <path>" or "updated <path> (<reasons...>)"
  persistence/file-format/crypto/envelope/env/no-self/resolve-target/prompt error -> stderr -> exit 1
```

No-self remediation:
- app message is multi-line:
  - `No local self identity found`
  - `Run: bage setup`

## `edit`

Source: `src/cli/command/editPayloadCommand.ts`

```
resolve payload path
resolve editor command
create passphrase session
open payload for edit
  payload needs update?
    yes ->
      guided + interactive?
        yes -> prompt "Update now" / "Back" / "Cancel"
          "Update now" -> UpdatePayload.execute -> reopen payload
          "Back" -> return to payload selection
          "Cancel" -> quiet stop
        no -> stderr remediation -> exit 1
  other open errors -> stderr -> exit 1

create temp file with env text
loop:
  launch editor
  read temp file
  get cached passphrase
  EditPayload.save
    env parse invalid -> stderr message -> restart editor loop
    unchanged -> stdout "No secret changes in <path>" -> success
    rewritten -> stdout "Updated encrypted payload at <path>" -> success
    payload now needs update -> handled outside loop
    other errors -> stderr -> exit 1
cleanup temp file always; delete failure swallowed
```

Handled failures -> stderr + exit `1`:
- update persistence/crypto/env
- edit persistence/crypto/env/update-required
- temp file create/read
- resolve payload target
- editor launch/exit/unavailable
- resolve editor persistence/unavailable
- prompt aborted/unavailable

Formatting inconsistency:
- `ResolveEditorCommandUnavailableError` is written without appending `\n`
- its message already contains trailing blank line, unlike most other paths

## `grant`

Source: `src/cli/command/grantPayloadCommand.ts`

```
resolve payload path
resolve identity ref
  arg present -> use it
  arg omitted -> load home state -> interactive chooser
  chooser may offer "Paste/import identity string"

identity ref starts with "better-age://identity/v1/"?
  yes -> import identity string first
  no -> skip import

create passphrase session
grantRecipient()
  payload needs update?
    yes ->
      guided + interactive?
        yes -> prompt "Update now" / "Back" / "Cancel"
          "Update now" -> UpdatePayload.execute -> retry grant
          "Back" -> return to previous guided chooser
          "Cancel" -> quiet stop
        no -> stderr remediation -> exit 1
  ambiguous identity -> stderr rendered candidate list -> exit 1
  identity not found -> stderr -> exit 1
  persistence/crypto/env -> stderr -> exit 1
  added|updated|unchanged -> continue

InspectPayload.execute with cached passphrase
  success -> print recipient summary
  inspect failure -> stderr -> exit 1
```

Success variants:
- added:
  - `granted <handle> in <path>`
  - `recipients: <count>`
- updated:
  - `updated recipient <handle> in <path>`
  - `recipients: <count>`
- unchanged already granted:
  - `recipient already granted: <handle>`
  - `recipients: <count>`
- unchanged outdated input:
  - `provided identity is outdated; recipient already has newer access: <handle>`
  - `recipients: <count>`

## `revoke`

Source: `src/cli/command/revokePayloadCommand.ts`

```
resolve payload path
create passphrase session
get cached passphrase
resolve identity ref
  arg present -> use it
  arg omitted -> InspectPayload.execute -> choose recipient
    current self is shown disabled

revokeRecipient()
  payload needs update?
    yes ->
      guided + interactive?
        yes -> prompt "Update now" / "Back" / "Cancel"
          "Update now" -> UpdatePayload.execute -> retry revoke
          "Back" -> return to previous guided chooser
          "Cancel" -> quiet stop
        no -> stderr remediation -> exit 1
  ambiguous identity -> stderr rendered candidate list -> exit 1
  self revoke forbidden -> stderr -> exit 1
  persistence/crypto/env -> stderr -> exit 1
  removed|unchanged -> continue

InspectPayload.execute with cached passphrase
  success -> print recipient summary
  inspect failure -> stderr -> exit 1
```

Success variants:
- removed:
  - `revoked recipient from <path>`
  - `recipients: <count>`
- unchanged absent:
  - `recipient not granted in <path>`
  - `recipients: <count>`

## `view`

Sources:
- CLI wrapper: `src/cli/command/viewPayloadCommand.ts`
- app flow: `src/app/view-payload/ViewPayload.ts`

```
resolve payload path
interactive select:
  "Reveal secrets"
  "Back"

"Back" -> return success, no output
"Reveal secrets" ->
  prompt secret "Passphrase: "
  ReadPayload.execute
  SecureViewer.view
```

Handled failures inside app:
- resolve payload target
- prompt aborted/unavailable
- read persistence/file-format/envelope/env error
- read crypto error -> normalized to `Failed to decrypt payload with provided passphrase`
- secure viewer unavailable/display error

App behavior on handled failure:
- writes stderr message
- fails with `ViewPayloadFailedError`

CLI wrapper behavior:
- maps `ViewPayloadFailedError` to command failure -> exit `1`

## `interactive`

Source: `src/cli/command/interactiveCommand.ts`

Top-level caught failures:
- `HomeStateLoadError`
- `HomeStateDecodeError`
- `PromptReadAbortedError`
- `PromptUnavailableError`

Anything else can escape raw.

### Interactive root tree

Source: `src/cli/flow/InteractiveSession.ts`

```
load home state
self configured?
  no -> run setup gate
    select:
      Setup now
      Back
      Cancel
    Back / Cancel -> return success, no output
    Setup now ->
      prompt alias
      prompt passphrase
      prompt confirm passphrase
      mismatch -> retry pair prompt inside setup flow
      createUserIdentity.execute
      success -> stdout created key + public key + Home path
      then enter root menu
  yes -> enter root menu

root menu:
  Files
  My identity
  Quit
```

### Interactive `Files` subtree

```
Files menu:
  Create payload
  Inspect payload
  View secrets
  Edit secrets
  Grant access
  Revoke access
  Update payload
  Back
```

Branch behavior:
- `create` -> calls `runCreatePayload({ path: none })`; failures swallowed after command already wrote stderr
- `inspect` -> calls `runInspectPayload({ path: none })`; failures swallowed
- `edit` -> calls `runEditPayload({ path: none })`; failures swallowed
- `grant` -> calls `runGrantPayload({ identityRef: none, path: none })`; failures swallowed
- `revoke` -> calls `runRevokePayload({ identityRef: none, path: none })`; failures swallowed
- `update` -> calls `runUpdatePayload({ path: none })`; failures swallowed
- `back` -> returns to root menu
- `view` -> calls `ViewPayload.execute({ path: none })`; failures swallowed like other file actions

### Interactive `My identity` subtree

```
My identity menu:
  Show identity
  Share identity string
  Import identity
  Forget known identity
  Rotate identity
  Change passphrase
  Back
```

Per-action behavior:
- every action runs through `runIdentityAction`
- `runIdentityAction` catches any typed failure with `message` and writes `stderr`
- after failure, menu continues

Sub-branches:

`Show identity`
- calls `InspectHomeIdentities.execute`
- stdout:
  - `Me`
  - either `not configured` or me details

`Share identity string`
- calls `ExportIdentityString.execute`
- stdout:
  - `Share this identity string with collaborators:`
  - identity string

`Import identity`
- prompt `Identity string`
- calls `ImportIdentityString.execute`
- stdout `<outcome> <displayName> (<handle>)`

`Forget known identity`
- load home state
- if no known identities -> stdout `No known identities`
- else choose identity -> call `ForgetIdentity.execute`
- removed -> stdout `forgot local identity <handle>`
- unchanged -> stdout `identity not known locally: <ref>`

`Rotate identity`
- prompt secret
- call `RotateUserIdentity.execute`
- stdout rotated message + reshare hint

`Change passphrase`
- prompt current / new / confirm
- mismatch -> stderr `Passphrases do not match`, menu continues
- success -> stdout `updated passphrase for all local keys`

Important inconsistency:
- setup phase does not use `runIdentityAction`
- setup-time `CreateUserIdentity` failures are not caught by `interactiveCommand`
- result: setup app failures can still surface raw

## Current Message Inventory By Theme

Friendly/actionable messages already present:
- `Missing required protocol version`
- `Unsupported protocol version: <version>`
- `Payload must be updated before <load|edit|grant|revoke>`
- `Run: bage update <path>`
- `No local self identity found`
- `Run: bage setup`
- `No editor configured...`

Normalized crypto messages already present:
- `Failed to decrypt payload with provided passphrase`
- `Failed to decrypt private key with provided passphrase`
- `Failed to encrypt private key with new passphrase`
- `Failed to decrypt payload envelope`
- `Failed to encrypt payload envelope`

Messages still synthesized from raw causes:
- `Failed to read passphrase from stdin: ${String(cause)}`
- `Failed to read input: ${String(cause)}`
- `Failed to discover payloads in <cwd>: ${String(cause)}`
- `Failed to render secure viewer: ${String(cause)}`
- `Failed to launch secure viewer: ${String(cause)}`

## Raw / Unnormalized Leak Points

These are the main current blockers to the stated goal "never raw error output".

1. Uncaught interactive view failure
- `InteractiveSession.runFilesScope`
- `view` path directly yields `ViewPayload.execute`
- `ViewPayloadFailedError` can escape and bypass command-style normalization

2. Uncaught interactive setup app failure
- `InteractiveSession.runSetupGate`
- `CreateUserIdentity.execute` failures are not wrapped
- `interactiveCommand` only catches home-state + prompt errors

3. Root-level uncaught layer/config/init failure
- `runCli` only catches command failure wrapper classes
- `BetterAgeConfigError` and similar layer init errors can bypass friendly stderr handling

4. Defects / thrown exceptions
- `Effect.orDie` in:
  - `CreateUserIdentity`
  - `CreatePayload`
  - `ExportIdentityString`
- explicit `throw new Error(...)` in:
  - `buildRotatedHomeState`
  - env parsing helpers
- `Effect.dieMessage(...)` placeholders in service defaults

5. Raw cause interpolation in messages
- `String(cause)` appears in prompt/discovery/viewer infra
- these can leak OS/runtime-specific text directly to user-facing stderr

6. Inconsistent success/info channel usage
- some successful guidance uses `stderr`
- makes it harder to define a strict "stderr means failure/red X" rule

7. No centralized error renderer
- every command manually catches many error classes
- same `Prompt.writeStderr(`${error.message}\n`)` pattern repeated everywhere
- formatting drift already visible

## Current Branch Summary By Command

| Command | Needs TTY sometimes | Success returns quietly? | Success stdout | Success stderr | Failure normalized? |
| --- | --- | --- | --- | --- | --- |
| `setup` | yes unless `--alias` + `--passphrase-stdin` | no | yes | yes | mostly |
| `me` | no | no | yes | no | yes |
| `add-identity` | yes if arg omitted | no | yes | no | yes |
| `forget-identity` | yes if arg omitted | no | yes | no | yes |
| `identities` | no | no | yes | no | yes |
| `rotate` | yes | no | yes | no | yes |
| `change-passphrase` | yes | no | yes | no | yes |
| `create` | yes if path omitted or overwrite chooser needed | yes (`Back`) | yes | no | yes |
| `inspect` | yes for passphrase and maybe path resolution | no | yes | maybe (`Using <path>`) | yes |
| `load` | yes for passphrase | no | yes | no | yes |
| `update` | yes for passphrase and maybe path resolution | no | yes | maybe (`Using <path>`) | yes |
| `edit` | yes | no | yes | maybe (`Using <path>`) | yes |
| `grant` | yes | no | yes | maybe (`Using <path>`) | yes |
| `revoke` | yes | no | yes | maybe (`Using <path>`) | yes |
| `view` | yes | yes (`Back`) | no | maybe (`Using <path>`) | command path yes; interactive path no |
| `interactive` | yes | yes (`Quit`) | yes | yes | partial only |

## Refactor-Relevant Observations

What current code shape implies:
- most business errors already have typed wrappers with `message`
- command layer is the real duplication hotspot
- interactive flow reuses command runners inconsistently
- stderr text is currently the de facto user-facing error API
- log events and stderr rendering are separate systems today
- there is no single place to enforce:
  - red X prefix
  - message style
  - action/remediation footer
  - raw-cause suppression
  - exit-code mapping

This file should be treated as current behavior baseline before redesign.
