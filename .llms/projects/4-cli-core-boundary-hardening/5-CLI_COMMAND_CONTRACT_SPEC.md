# CLI Command Contract Spec

Status: active spec. Goal: command-by-command contract between argv, CLI flow, core API, and output channels.

## Execution Context Contract

CLI execution is controlled by two axes only:

```txt
invocation mode:
  exact
  guided

terminal mode:
  interactive
  headless
```

Rules:

- exact means every mandatory non-secret operand is supplied.
- guided means at least one promptable mandatory non-secret operand is missing.
- passphrase never affects exactness.
- headless means no passphrase prompt, menu, text prompt, editor, or viewer.
- `bage interactive` is a routing surface, not a third execution axis.
- commands launched from `bage interactive` reuse the same command flows with interactive terminal mode.

## Operand Classes

```txt
promptable operand:
  CLI can ask for it in guided interactive mode.

protocol operand:
  CLI must receive it from argv/protocol; no guided human prompt.

secret operand:
  passphrase or new passphrase; never argv, never exactness input.
```

Rules:

- missing promptable operand + interactive => guided flow.
- missing promptable operand + headless => missing operand error.
- missing protocol operand => fail immediately, even when interactive.
- missing secret operand + interactive => prompt.
- missing secret operand + headless => passphrase unavailable.

## Output Channel Contract

```txt
stdout:
  primary command output when command contract says so
  identity export prints identity string only
  load prints raw env text only

stderr:
  human errors, warnings, notices, hints, prompts

viewer/editor/menu:
  interactive terminal only
```

Rules:

- prompts, warnings, errors, hints, and status messages do not appear on machine stdout.
- warnings/notices for machine-output commands go to stderr.
- command failures never print partial secret/plaintext output.
- styled output is rendered through the CLI presenter only.
- emoji/color/bold are allowed for human output when terminal-safe.
- machine stdout commands never include styling.

## Command Matrix

| Command | Promptable operands | Protocol operands | Secret prompt | Headless |
| --- | --- | --- | --- | --- |
| `setup` | `--name` | none | new passphrase + confirm | fails passphrase unavailable after name validation |
| `create` | `path` | none | passphrase | fails passphrase unavailable after path validation |
| `edit` | `path` | none | passphrase | fails passphrase unavailable after path validation |
| `grant` | `path`, `identity-ref` | none | passphrase | fails passphrase unavailable after operand validation |
| `inspect` | `path` | none | passphrase | fails passphrase unavailable after path validation |
| `load` | `path` | `--protocol-version` | passphrase | fails passphrase unavailable after protocol/path validation |
| `revoke` | `path`, `identity-ref` | none | passphrase | fails passphrase unavailable after operand validation |
| `update` | `path` | none | passphrase | fails passphrase unavailable after path validation |
| `view` | `path` | none | passphrase | fails passphrase unavailable after path validation |
| `identity export` | none | none | none | allowed |
| `identity forget` | `identity-ref` | none | none | allowed if exact |
| `identity import` | `identity-string`; optional `--alias` | none | none | allowed if exact |
| `identity list` | none | none | none | allowed |
| `identity passphrase` | none | none | current + new passphrase | fails passphrase unavailable |
| `identity rotate` | none | none | passphrase | fails passphrase unavailable |
| `interactive` | none | none | command-dependent | fails interactive unavailable |

## Shared Failure Ordering

For credential-required commands:

```txt
1. validate command shape and protocol operands
2. if headless and promptable operands are missing, fail missing operand
3. run global home preflight except setup
4. resolve/validate promptable operands if possible
5. fail missing operands if still incomplete
6. validate cheap non-secret file/path constraints when command-specific flow allows
7. if headless, fail PASSPHRASE_UNAVAILABLE
8. prompt passphrase in interactive mode
9. call core
```

Rules:

- do not ask passphrase before known missing operand errors.
- malformed command/protocol errors fail before home preflight.
- do not ask passphrase before cheap path existence/already-exists checks.
- do not mutate in headless credential-required flows.
- preflight notices for machine stdout commands go to stderr.
- wrong passphrase retries inline up to 3 attempts.

## Command Contracts

### `bage setup`

Core:

```txt
commands.createSelfIdentity({ displayName, passphrase })
```

Flow:

```txt
if home already configured:
  fail SETUP_ALREADY_CONFIGURED
if home does not exist:
  continue setup
if home exists but is invalid/incompatible/unreadable:
  fail home-state error
if --name missing and interactive:
  prompt display name
if --name missing and headless:
  fail SETUP_NAME_MISSING
validate display name
if headless:
  fail PASSPHRASE_UNAVAILABLE
prompt new passphrase + confirm
create self identity
success
```

Output:

```txt
stdout: none
stderr: success/error/hints
```

### `bage create`

Core:

```txt
commands.createPayload({ path, passphrase })
```

Flow:

```txt
resolve target path
if target exists:
  fail PAYLOAD_ALREADY_EXISTS before passphrase
if headless:
  fail PASSPHRASE_UNAVAILABLE
prompt passphrase
create empty payload for self recipient
success
```

Output:

```txt
stdout: none
stderr: success/error/hints
```

### `bage inspect`

Core:

```txt
queries.decryptPayload({ path, passphrase })
```

Flow:

```txt
open Payload Context
render metadata, env key names, recipients
emit update warning if readable-but-outdated
success
```

Output:

```txt
stdout: human inspect output
stderr: warnings/errors
plaintext values: never
```

### `bage view`

Core:

```txt
queries.decryptPayload({ path, passphrase })
```

Flow:

```txt
open Payload Context
open secure viewer with env text
viewer close => success
```

Output:

```txt
stdout: none
stderr: warnings/errors
viewer: plaintext env text
```

### `bage load --protocol-version=1`

Core:

```txt
queries.decryptPayload({ path, passphrase })
```

Flow:

```txt
if --protocol-version missing:
  fail LOAD_PROTOCOL_REQUIRED
if --protocol-version unsupported:
  fail LOAD_PROTOCOL_UNSUPPORTED
resolve path if missing and interactive
if headless:
  fail PASSPHRASE_UNAVAILABLE
open Payload Context
print envText to stdout
emit warnings/notices to stderr
success
```

Output:

```txt
stdout: raw envText only
stderr: prompts, warnings, errors
```

Rules:

- `--protocol-version` is not guided by prompt.
- `load` may be interactive because passphrase prompt uses inherited tty.

### `bage edit`

Core:

```txt
queries.decryptPayload({ path, passphrase }) # early CLI context
commands.editPayload({ path, passphrase, editedEnvText })
```

Flow:

```txt
open Payload Context
if payload update required before write:
  apply outdated write gate
open editor with envText
if editor cancel:
  cancel
if edited text identical:
  success unchanged
if invalid .env:
  show validation error and reopen editor with edited text
if valid changed:
  call editPayload
  success edited
```

Output:

```txt
stdout: none
stderr: editor/errors/success/warnings
```

### `bage grant`

Core:

```txt
queries.decryptPayload({ path, passphrase }) # early CLI context
queries.resolveGrantRecipient({ reference, payloadRecipients }) # exact identity-ref path
queries.parseIdentityString({ identityString }) # guided custom identity string path
commands.grantPayloadRecipient({ path, passphrase, recipient })
```

Exact flow:

```txt
open Payload Context
resolve identity-ref to exact PublicIdentitySnapshot
if recipient is self:
  fail CANNOT_GRANT_SELF
if payload update required before write:
  fail with run-update remediation
call grantPayloadRecipient
success added/updated/unchanged
```

Guided flow:

```txt
open Payload Context
show merged recipient picker:
  self disabled [you]
  already granted disabled [granted]
  known grantable identities selectable
  custom identity string selectable
if custom identity string:
  parse string
if payload update required before write:
  show Update now / Back / Cancel gate
call grantPayloadRecipient
success added/updated/unchanged
```

Output:

```txt
stdout: none
stderr: prompts/errors/success/warnings
```

### `bage revoke`

Core:

```txt
queries.decryptPayload({ path, passphrase }) # early CLI context
queries.resolvePayloadRecipient({ reference, recipients }) # exact identity-ref path
commands.revokePayloadRecipient({ path, passphrase, recipientOwnerId })
```

Exact flow:

```txt
open Payload Context
resolve identity-ref to OwnerId in payload-recipient scope
if recipient is self:
  fail CANNOT_REVOKE_SELF
if payload update required before write:
  fail with run-update remediation
call revokePayloadRecipient
success removed/unchanged
```

Guided flow:

```txt
open Payload Context
show payload-recipient picker:
  self disabled [you]
  revokable recipients selectable
if payload update required before write:
  show Update now / Back / Cancel gate
call revokePayloadRecipient
success removed
```

Output:

```txt
stdout: none
stderr: prompts/errors/success/warnings
```

### `bage update`

Core:

```txt
queries.decryptPayload({ path, passphrase }) # early CLI context
commands.updatePayload({ path, passphrase })
```

Flow:

```txt
open Payload Context
compute update reasons
if no reasons:
  success unchanged
if reasons:
  rewrite current schema and current self recipient
  success updated
```

Output:

```txt
stdout: none
stderr: success/errors/warnings
```

### `bage identity export`

Core:

```txt
queries.exportSelfIdentityString()
```

Flow:

```txt
load self identity
print current public identity string
success
```

Output:

```txt
stdout: identity string only
stderr: warnings/errors only
```

### `bage identity list`

Core:

```txt
queries.getSelfIdentity()
queries.listKnownIdentities()
queries.listRetiredKeys()
```

Flow:

```txt
load self, known identities, retired keys
render sections
success
```

Output:

```txt
stdout: human list output
stderr: warnings/errors
private key material: never
```

### `bage identity import`

Core:

```txt
commands.importKnownIdentity({ identityString, localAlias })
```

Flow:

```txt
resolve identity string
if interactive:
  prompt optional alias
if exact/headless and --alias supplied:
  validate alias or fail
import/update known identity
success added/updated/unchanged/alias-updated
```

Output:

```txt
stdout: none
stderr: prompts/errors/success
```

Rules:

- importing self fails.
- alias prompt exists only here in MVP.
- import never mutates payloads.

### `bage identity forget`

Core:

```txt
queries.resolveKnownIdentity({ reference })
commands.forgetKnownIdentity({ ownerId })
```

Flow:

```txt
resolve known identity
if not found:
  fail IDENTITY_REFERENCE_NOT_FOUND
forget known identity and alias
success
```

Output:

```txt
stdout: none
stderr: prompts/errors/success
```

Rules:

- forget never mutates payloads.
- guided picker only shows known identities.

### `bage identity rotate`

Core:

```txt
commands.rotateSelfIdentity({ passphrase })
```

Flow:

```txt
if headless:
  fail PASSPHRASE_UNAVAILABLE
prompt passphrase with standard retry
rotate current self key under same OwnerId
move old key to retired keys
success
warn/hint that existing payloads may need update
```

Output:

```txt
stdout: none
stderr: prompts/errors/success/remediation
```

### `bage identity passphrase`

Core:

```txt
commands.changeIdentityPassphrase({ currentPassphrase, nextPassphrase })
```

Flow:

```txt
if headless:
  fail PASSPHRASE_UNAVAILABLE
prompt current passphrase with standard retry
prompt new passphrase + confirm
if mismatch:
  retry pair
reencrypt current and retired private keys
success
```

Output:

```txt
stdout: none
stderr: prompts/errors/success
```

### `bage interactive`

Core:

```txt
none directly
```

Flow:

```txt
if headless:
  fail INTERACTIVE_UNAVAILABLE
open CLI session menu
route into same command flows as direct commands
Back returns to previous menu
Cancel exits session
```

Output:

```txt
stdout: none unless routed command has stdout contract
stderr: session UI, prompts, errors, success
```
