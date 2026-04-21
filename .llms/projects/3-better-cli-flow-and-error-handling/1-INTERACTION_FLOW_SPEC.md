# Better Secrets Full Interaction Flow Spec

Target-state interaction spec for `packages/cli`.

Purpose:
- one source of truth for final CLI UX
- one reusable language for branches, loops, ends, messages, and shared flows
- one document that can drive full manual and automated e2e coverage

Current-state audit lives in [ERROR_HANDLING_SOURCE_OF_TRUTH.md](./2-ERROR_HANDLING_SOURCE_OF_TRUTH.md).
Decision trace lives in [GRILL_ME_FLOW.md](./0-GRILL_ME_FLOW.md).
Error copy and rendering rules live in [ERROR_MESSAGE_SPEC.md](./1-ERROR_MESSAGE_SPEC.md).

## 1. Global rules

### 1.1 Invocation axes

- `exact`
  - user supplied all command operands explicitly
- `guided`
  - CLI must collect one or more missing operands

- `interactive-terminal`
  - prompts, menus, secure viewer available
- `headless-terminal`
  - prompts, menus, secure viewer unavailable

Rule:
- explicit args are authoritative
- explicit args must never be reinterpreted
- explicit args must never fall back to chooser flows

### 1.2 Global command outcomes

Every top-level command ends as exactly one of:

- `END.OK`
- `END.CANCEL`
- `END.ERROR`

Shared subflows may return:

- `RETURN.OK(...)`
- `RETURN.BACK`
- `RETURN.CANCEL`
- `RETURN.ERROR(<message-id>)`

Rule:
- standalone guided command final `BACK` maps to `END.CANCEL`
- inside `interactive`, `BACK` returns to previous menu/surface, not session end

### 1.3 Sink rules

- `stdout`
  - successful direct command output
  - machine payload output for `load`
- `stderr`
  - errors
  - warnings
  - remediation
  - prompt copy for line-oriented prompts
- `menu`
  - interactive select surface
- `viewer`
  - secure readonly payload surface

Rule:
- success/info must not use `stderr`, except `load` warnings which are explicitly non-fatal warnings

### 1.4 Canonical menu and viewer bindings

Menu bindings:

```txt
Up, k          -> move up
Down, j        -> move down
Enter          -> confirm current option
Esc            -> BACK if parent exists, else CANCEL
q              -> CANCEL
Ctrl+C         -> CANCEL
```

Viewer bindings:

```txt
q, Esc, Ctrl+C -> CANCEL if no parent; otherwise BACK to caller
j, Down        -> line down
k, Up          -> line up
Space, PgDn    -> page down
b, PgUp        -> page up
g              -> top
G              -> bottom
```

### 1.5 Output pause rules in `interactive`

Substantial text outputs pause before menu redraw:
- `inspect`
- `identities`
- `interactive > Show identity`
- `interactive > Share identity string`

Short status outputs do not pause:
- create/grant/revoke/update/edit status
- rotate/change-passphrase status
- add-identity/forget-identity status

### 1.6 Setup and update gate rules

`SETUP_GATE`:
- exact + headless => remediation error only
- exact + interactive => remediation error only
- guided + interactive => `Setup now` / `Back` / `Cancel`
- guided + headless => remediation error only

`UPDATE_GATE` for `edit` / `grant` / `revoke` only:
- exact => remediation error only
- guided + headless => remediation error only
- guided + interactive => `Update now` / `Back` / `Cancel`
- `Update now` resumes blocked command with cached resolved operands
- `Back` returns to the immediately previous local guided step chosen by the caller

### 1.7 Passphrase rules

Human commands:
- exact + interactive => secure prompt allowed
- exact + headless => fail
- guided + interactive => secure prompt allowed
- guided + headless => fail earlier

Retry policy:
- guided human decrypt/auth failures:
  - `Retry passphrase`
  - `Back`
  - `Cancel`
- retry loops only to passphrase step
- exact flows get one passphrase attempt only
- `load` gets one passphrase attempt only
- setup/change-passphrase guided mismatch retries passphrase-pair step

### 1.8 Idempotence rules

Unchanged-but-satisfied mutation results are `END.OK`:
- `grant` already granted
- `grant` provided identity older than already granted snapshot
- `revoke` target not currently granted
- `forget-identity` unknown identity
- `update` already up to date

### 1.9 Implicit cross-cutting failure branches

These branches apply anywhere the relevant infrastructure is used, even when not repeated inline in each flow:

- startup/config invalid
- home state unreadable
- home state invalid/corrupt
- payload discovery failed
- prompt unavailable in required interactive step
- prompt aborted by user
- editor unavailable
- editor launch failed
- editor exited non-zero
- temp file create/read failed
- secure viewer unavailable
- secure viewer render/launch failed
- uncaught internal defect

Rule:
- all such branches must map through the central error catalog in [ERROR_MESSAGE_SPEC.md](./1-ERROR_MESSAGE_SPEC.md)
- intentional user abort should prefer `CANCEL` over `ERROR`
- temp file cleanup failure after successful command should not overwrite the primary command outcome

## 2. Message ids

Message ids are stable semantic names, not final copy.

Format:

```txt
ERR.<scope>.<reason>
WARN.<scope>.<reason>
INFO.<scope>.<event>
SUCCESS.<scope>.<event>
PROMPT.<scope>.<intent>
VIEW.<scope>.<surface>
```

Core ids used below:

- `ERR.SETUP.REQUIRED`
- `ERR.SETUP.ALREADY_CONFIGURED`
- `ERR.SETUP.ALIAS_REQUIRED`
- `ERR.SETUP.ALIAS_INVALID`
- `ERR.SETUP.PASSPHRASE_MISMATCH`
- `ERR.SETUP.CREATE_FAILED`
- `ERR.PASSPHRASE.UNAVAILABLE`
- `ERR.PAYLOAD.MISSING_PATH`
- `ERR.PAYLOAD.PATH_NOT_FOUND`
- `ERR.PAYLOAD.PATH_ALREADY_EXISTS`
- `ERR.PAYLOAD.INVALID_FORMAT`
- `ERR.PAYLOAD.DECRYPT_FAILED`
- `ERR.PAYLOAD.WRITE_FAILED`
- `ERR.PAYLOAD.UPDATE_REQUIRED`
- `ERR.VIEWER.UNAVAILABLE`
- `ERR.IDENTITY_REF.MISSING`
- `ERR.IDENTITY_REF.AMBIGUOUS`
- `ERR.IDENTITY_REF.NOT_FOUND`
- `ERR.IDENTITY_REF.SELF_FORBIDDEN`
- `ERR.IDENTITY_STRING.INVALID`
- `ERR.IDENTITY_STRING.SELF_FORBIDDEN`
- `ERR.IDENTITY.EXPORT_FAILED`
- `ERR.IDENTITY.INSPECT_FAILED`
- `ERR.IDENTITY.CONFLICT`
- `ERR.IDENTITY.IMPORT_FAILED`
- `ERR.IDENTITY.FORGET_FAILED`
- `ERR.IDENTITY.ROTATE_FAILED`
- `ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED`
- `ERR.EDITOR.UNAVAILABLE`
- `ERR.EDITOR.LAUNCH_FAILED`
- `ERR.EDIT.ENV_INVALID`
- `ERR.EDIT.OPEN_FAILED`
- `ERR.UPDATE.FAILED`
- `ERR.CREATE.FAILED`
- `ERR.LOAD.PROTOCOL_REQUIRED`
- `ERR.LOAD.PROTOCOL_UNSUPPORTED`
- `ERR.INTERACTIVE.UNAVAILABLE`
- `ERR.RUNTIME.CONFIG_INVALID`
- `ERR.RUNTIME.STATE_UNREADABLE`
- `ERR.RUNTIME.STATE_INVALID`
- `ERR.RUNTIME.PAYLOAD_DISCOVERY_FAILED`
- `ERR.RUNTIME.TEMPFILE_CREATE_FAILED`
- `ERR.RUNTIME.TEMPFILE_READ_FAILED`
- `ERR.RUNTIME.INTERNAL`
- `ERR.PROMPT.UNAVAILABLE`
- `WARN.LOAD.UPDATE_REQUIRED`
- `ERR.EDITOR.EXIT_NON_ZERO`
- `ERR.VIEWER.RENDER_FAILED`
- `INFO.MUTATION.UNCHANGED`
- `SUCCESS.SETUP.CREATED`
- `SUCCESS.CREATE.CREATED`
- `SUCCESS.INSPECT.SUMMARY`
- `SUCCESS.EDIT.REWRITTEN`
- `SUCCESS.GRANT.ADDED`
- `SUCCESS.GRANT.REFRESHED`
- `SUCCESS.REVOKE.REMOVED`
- `SUCCESS.UPDATE.UPDATED`
- `SUCCESS.ME.IDENTITY_STRING`
- `SUCCESS.IDENTITIES.SUMMARY`
- `SUCCESS.LOAD.ENV_TEXT`
- `SUCCESS.IDENTITY.ADDED`
- `SUCCESS.IDENTITY.REFRESHED`
- `SUCCESS.IDENTITY.FORGOTTEN`
- `SUCCESS.IDENTITY.ROTATED`
- `SUCCESS.IDENTITY.PASSPHRASE_CHANGED`
- `PROMPT.GENERIC.ACKNOWLEDGE`
- `PROMPT.SETUP.GATE`
- `PROMPT.SETUP.ENTER_ALIAS`
- `PROMPT.UPDATE.GATE`
- `PROMPT.PAYLOAD.SELECT_EXISTING`
- `PROMPT.PAYLOAD.ENTER_EXISTING_PATH`
- `PROMPT.PAYLOAD.ENTER_NEW_PATH`
- `PROMPT.PAYLOAD.EXISTS_ACTION`
- `PROMPT.IDENTITY.SELECT_GRANT_TARGET`
- `PROMPT.IDENTITY.SELECT_REVOKE_TARGET`
- `PROMPT.IDENTITY.SELECT_FORGET_TARGET`
- `PROMPT.IDENTITY.ENTER_REF`
- `PROMPT.IDENTITY.ENTER_IDENTITY`
- `PROMPT.IDENTITY.ENTER_IDENTITY_STRING`
- `PROMPT.IDENTITY.ENTER_LOCAL_ALIAS`
- `PROMPT.IDENTITY.AMBIGUITY_ACTION`
- `PROMPT.IDENTITY.ERROR_ACTION`
- `PROMPT.PASSPHRASE.ENTER`
- `PROMPT.PASSPHRASE.RETRY_ACTION`
- `PROMPT.PASSPHRASE_PAIR.ENTER`
- `PROMPT.EDITOR.SELECT`
- `PROMPT.EDITOR.SAVE_MODE`
- `PROMPT.EDIT.INVALID_ENV_ACTION`
- `PROMPT.INTERACTIVE.ROOT`
- `PROMPT.INTERACTIVE.FILES`
- `PROMPT.INTERACTIVE.IDENTITY`
- `VIEW.PAYLOAD.SECURE_READONLY`

## 3. DSL

Notation:

```txt
FLOW <id>
intent:
inputs:
outputs:
entry:
steps:
terminal outcomes:

STEP <id> <name>
  OPEN <surface>
  CALL <flow>
  EMIT <sink> <message-id>
  SET <name> = <value>
  WHEN <condition> -> <target>
  LOOP <step-id>
  RETURN.<OUTCOME>(...)
  END.<OUTCOME>
```

## 4. Shared flows

### FLOW.SHARED.SETUP_GATE

```txt
FLOW FLOW.SHARED.SETUP_GATE
intent:
  Ensure local self identity exists before a command that requires it.

inputs:
  invocation-shape
  terminal-capability
  caller-resume-target

outputs:
  self-identity-ready

STEP S1 CHECK_CAPABILITY
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.SETUP.REQUIRED)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.SETUP.REQUIRED)
  ELSE -> S2

STEP S2 GATE_MENU
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.SETUP.GATE
    options:
      - SETUP_NOW
      - BACK
      - CANCEL
  WHEN selection = SETUP_NOW -> S3
  WHEN selection = BACK -> RETURN.BACK
  WHEN selection = CANCEL -> RETURN.CANCEL

STEP S3 RUN_SETUP
  CALL CMD.SETUP.GUIDED_INNER
  WHEN RETURN.OK -> RETURN.OK(self-identity-ready)
  WHEN RETURN.BACK -> RETURN.BACK
  WHEN RETURN.CANCEL -> RETURN.CANCEL
  WHEN RETURN.ERROR(message-id) -> RETURN.ERROR(message-id)
```

### FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET

```txt
FLOW FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
intent:
  Resolve one existing payload path.

inputs:
  arg.path?
  invocation-shape
  terminal-capability
  cwd-discovered-payloads

outputs:
  payload-path

STEP S1 EXPLICIT_ARG
  WHEN arg.path present and file exists -> RETURN.OK(arg.path)
  WHEN arg.path present and file missing -> RETURN.ERROR(ERR.PAYLOAD.PATH_NOT_FOUND)
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.PAYLOAD.MISSING_PATH)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.PAYLOAD.MISSING_PATH)
  ELSE -> S2

STEP S2 DISCOVER
  WHEN cwd-discovered-payloads.count = 1 -> RETURN.OK(only-path)
  WHEN cwd-discovered-payloads.count > 1 -> S3
  WHEN cwd-discovered-payloads.count = 0 -> S4

STEP S3 SELECT_DISCOVERED
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.PAYLOAD.SELECT_EXISTING
    options:
      - each discovered path
      - BACK
      - CANCEL
  WHEN selected path -> RETURN.OK(path)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S4 ENTER_PATH
  OPEN PROMPT.TEXT
    message-id: PROMPT.PAYLOAD.ENTER_EXISTING_PATH
  WHEN entered path exists -> RETURN.OK(path)
  WHEN entered path missing -> EMIT stderr ERR.PAYLOAD.PATH_NOT_FOUND -> LOOP S4
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.RESOLVE_NEW_PAYLOAD_TARGET

```txt
FLOW FLOW.SHARED.RESOLVE_NEW_PAYLOAD_TARGET
intent:
  Resolve one new payload path for create.

inputs:
  arg.path?
  invocation-shape
  terminal-capability

outputs:
  payload-path
  overwrite-approved: boolean

STEP S1 EXPLICIT_ARG
  WHEN arg.path present and path free -> RETURN.OK(arg.path, overwrite-approved=false)
  WHEN arg.path present and path exists -> RETURN.ERROR(ERR.PAYLOAD.PATH_ALREADY_EXISTS)
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.PAYLOAD.MISSING_PATH)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.PAYLOAD.MISSING_PATH)
  ELSE -> S2

STEP S2 ENTER_NEW_PATH
  OPEN PROMPT.TEXT
    message-id: PROMPT.PAYLOAD.ENTER_NEW_PATH
    default-value: .env.enc
  WHEN entered path free -> RETURN.OK(path, overwrite-approved=false)
  WHEN entered path exists -> S3
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S3 EXISTS_ACTION
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.PAYLOAD.EXISTS_ACTION
    default-option: ENTER_DIFFERENT_PATH
    options:
      - ENTER_DIFFERENT_PATH
      - OVERWRITE
      - BACK
      - CANCEL
  WHEN ENTER_DIFFERENT_PATH -> LOOP S2
  WHEN OVERWRITE -> RETURN.OK(last-entered-path, overwrite-approved=true)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.REQUEST_PASSPHRASE_ONCE

```txt
FLOW FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
intent:
  Collect one passphrase with no retry branch.

inputs:
  terminal-capability

outputs:
  passphrase

STEP S1 CAPABILITY
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.PASSPHRASE.UNAVAILABLE)
  ELSE -> S2

STEP S2 INPUT
  OPEN PROMPT.SECRET
    message-id: PROMPT.PASSPHRASE.ENTER
  WHEN value entered -> RETURN.OK(passphrase)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY

```txt
FLOW FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
intent:
  Collect a passphrase, with guided retry loop on decrypt/auth failure.

inputs:
  terminal-capability

outputs:
  passphrase

STEP S1 INPUT
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  WHEN RETURN.OK(passphrase) -> RETURN.OK(passphrase)
  WHEN RETURN.BACK -> RETURN.BACK
  WHEN RETURN.CANCEL -> RETURN.CANCEL
  WHEN RETURN.ERROR(message-id) -> RETURN.ERROR(message-id)
```

Caller contract:
- if decrypt/auth fails after this flow returns, guided caller opens `PROMPT.PASSPHRASE.RETRY_ACTION`
- choices:
  - `Retry passphrase`
  - `Back`
  - `Cancel`
- retry loops to this flow

### FLOW.SHARED.REQUEST_PASSPHRASE_PAIR

```txt
FLOW FLOW.SHARED.REQUEST_PASSPHRASE_PAIR
intent:
  Collect and confirm a new passphrase.

inputs:
  terminal-capability
  invocation-shape

outputs:
  passphrase

STEP S1 CAPABILITY
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.PASSPHRASE.UNAVAILABLE)
  ELSE -> S2

STEP S2 INPUT_PAIR
  OPEN PROMPT.SECRET
    message-id: PROMPT.PASSPHRASE_PAIR.ENTER
  WHEN pair matches -> RETURN.OK(passphrase)
  WHEN pair mismatches and invocation-shape = guided -> EMIT stderr ERR.SETUP.PASSPHRASE_MISMATCH -> LOOP S2
  WHEN pair mismatches and invocation-shape = exact -> RETURN.ERROR(ERR.SETUP.PASSPHRASE_MISMATCH)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.RESOLVE_GRANT_IDENTITY_TARGET

```txt
FLOW FLOW.SHARED.RESOLVE_GRANT_IDENTITY_TARGET
intent:
  Resolve one identity operand for grant through one canonical intake flow.
  Accepted user inputs:
    - local alias
    - display name
    - handle
    - full identity string

inputs:
  arg.identity-ref?
  invocation-shape
  terminal-capability
  known-identities
  self-identity

outputs:
  canonical identity-ref
  intake-outcome:
    - selected-known
    - entered-ref
    - imported-added
    - imported-updated
    - imported-unchanged

notes:
  - There is no separate `Paste/import identity string` branch.
  - One free-text identity intake accepts ref-like values and full identity strings.
  - Visible-label collision means:
    - self display name
    - any known identity local alias
    - any known identity display name when no local alias exists
  - Guided interactive flow may prompt for local alias only when a newly added or updated imported identity would otherwise collide by visible label.
  - Exact flow never blocks on alias prompt; it proceeds without creating a new local alias.

STEP S1 EXPLICIT_ARG
  WHEN arg.identity-ref present -> SET raw-identity-input = arg.identity-ref -> S3
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  ELSE -> S2

STEP S2 SELECT_OR_ENTER
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.IDENTITY.SELECT_GRANT_TARGET
    options:
      - each known identity
      - ENTER_IDENTITY
      - BACK
      - CANCEL
  WHEN known identity selected -> RETURN.OK(handle, selected-known)
  WHEN ENTER_IDENTITY -> S3
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S3 ENTER_IDENTITY
  OPEN PROMPT.TEXT
    message-id: PROMPT.IDENTITY.ENTER_IDENTITY
  WHEN valid non-empty input -> SET raw-identity-input = value -> S4
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S4 CLASSIFY_INPUT
  WHEN raw-identity-input is full identity string -> S5
  ELSE -> S8

STEP S5 DECODE_AND_COMPARE_IDENTITY_STRING
  WHEN identity string invalid and invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_STRING.INVALID)
  WHEN identity string invalid and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_STRING.INVALID -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN edit-input -> LOOP S3
    WHEN RETURN.BACK -> RETURN.BACK
    WHEN RETURN.CANCEL -> RETURN.CANCEL
  WHEN identity string resolves to self and invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_STRING.SELF_FORBIDDEN)
  WHEN identity string resolves to self and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_STRING.SELF_FORBIDDEN -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN edit-input -> LOOP S3
    WHEN RETURN.BACK -> RETURN.BACK
    WHEN RETURN.CANCEL -> RETURN.CANCEL
  WHEN same owner already known and imported snapshot older or identical -> RETURN.OK(existing handle, imported-unchanged)
  WHEN same owner already known and imported snapshot newer -> S6
  WHEN owner unknown locally -> S6

STEP S6 OPTIONAL_LOCAL_ALIAS_COLLISION_RESOLUTION
  WHEN invocation-shape = exact -> S7
  WHEN invocation-shape = guided AND resulting visible label has no collision -> S7
  WHEN invocation-shape = guided AND resulting visible label collides -> OPEN PROMPT.TEXT
    message-id: PROMPT.IDENTITY.ENTER_LOCAL_ALIAS
    rules:
      - alias must be valid
      - alias must be unique against self display name and known visible labels
  WHEN alias entered and valid unique -> SET local-alias = value -> S7
  WHEN alias invalid -> EMIT stderr ERR.IDENTITY.ALIAS_INVALID -> LOOP S6
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S7 UPSERT_KNOWN_IDENTITY
  WHEN owner unknown locally -> save known identity with optional local-alias -> RETURN.OK(imported handle, imported-added)
  WHEN imported snapshot newer -> update known identity preserving existing local alias unless guided collision step supplied a new one -> RETURN.OK(imported handle, imported-updated)

STEP S8 RESOLVE_REF_LIKE_INPUT
  Attempt resolution against self + known identities using:
    - local alias
    - display name
    - handle
  WHEN exactly one match -> RETURN.OK(handle, entered-ref)
  WHEN ambiguous and invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_REF.AMBIGUOUS)
  WHEN ambiguous and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN choose-candidate -> RETURN.OK(chosen handle, selected-known)
    WHEN edit-input -> LOOP S3
    WHEN RETURN.BACK -> RETURN.BACK
    WHEN RETURN.CANCEL -> RETURN.CANCEL
  WHEN not found and invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_REF.NOT_FOUND)
  WHEN not found and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_REF.NOT_FOUND -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN edit-input -> LOOP S3
    WHEN RETURN.BACK -> RETURN.BACK
    WHEN RETURN.CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED

```txt
FLOW FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
intent:
  Handle guided identity entry errors after typed/pasted input.

inputs:
  error-kind: ambiguous | not-found | self-forbidden | invalid-identity-string
  candidates?

outputs:
  action

STEP S1 ACTION
  OPEN MENU.SELECT_ONE
    message-id: error-kind = ambiguous ? PROMPT.IDENTITY.AMBIGUITY_ACTION : PROMPT.IDENTITY.ERROR_ACTION
    options:
      - if ambiguous: CHOOSE_CANDIDATE
      - EDIT_INPUT
      - BACK
      - CANCEL
  WHEN CHOOSE_CANDIDATE -> RETURN.OK(choose-candidate)
  WHEN EDIT_INPUT -> RETURN.OK(edit-input)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.RESOLVE_REVOKE_IDENTITY_REF

```txt
FLOW FLOW.SHARED.RESOLVE_REVOKE_IDENTITY_REF
intent:
  Resolve one recipient target for revoke.

inputs:
  arg.identity-ref?
  invocation-shape
  terminal-capability
  current-recipients-with-self-flag

outputs:
  identity-ref

STEP S1 EXPLICIT_ARG
  WHEN arg.identity-ref present -> RETURN.OK(arg.identity-ref)
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  ELSE -> S2

STEP S2 SELECT_RECIPIENT
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.IDENTITY.SELECT_REVOKE_TARGET
    options:
      - each non-self recipient
      - ENTER_REF
      - BACK
      - CANCEL
  WHEN recipient selected -> RETURN.OK(handle)
  WHEN ENTER_REF -> S3
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S3 ENTER_REF
  OPEN PROMPT.TEXT
    message-id: PROMPT.IDENTITY.ENTER_REF
  WHEN valid non-empty input -> RETURN.OK(value)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.RESOLVE_FORGET_IDENTITY_REF

```txt
FLOW FLOW.SHARED.RESOLVE_FORGET_IDENTITY_REF
intent:
  Resolve one known-identity target for forget.

inputs:
  arg.identity-ref?
  invocation-shape
  terminal-capability
  known-identities

outputs:
  identity-ref

STEP S1 EXPLICIT_ARG
  WHEN arg.identity-ref present -> RETURN.OK(arg.identity-ref)
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.IDENTITY_REF.MISSING)
  ELSE -> S2

STEP S2 SELECT_TARGET
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.IDENTITY.SELECT_FORGET_TARGET
    options:
      - each known identity
      - ENTER_REF
      - BACK
      - CANCEL
  WHEN identity selected -> RETURN.OK(handle)
  WHEN ENTER_REF -> S3
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S3 ENTER_REF
  OPEN PROMPT.TEXT
    message-id: PROMPT.IDENTITY.ENTER_REF
  WHEN valid non-empty input -> RETURN.OK(value)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.UPDATE_GATE

```txt
FLOW FLOW.SHARED.UPDATE_GATE
intent:
  Offer explicit update before continuing a guided human mutation flow.

inputs:
  invocation-shape
  terminal-capability

outputs:
  action

STEP S1 CHECK
  WHEN invocation-shape = exact -> RETURN.ERROR(ERR.PAYLOAD.UPDATE_REQUIRED)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.PAYLOAD.UPDATE_REQUIRED)
  ELSE -> S2

STEP S2 MENU
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.UPDATE.GATE
    options:
      - UPDATE_NOW
      - BACK
      - CANCEL
  WHEN UPDATE_NOW -> RETURN.OK(update-now)
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.RESOLVE_EDITOR

```txt
FLOW FLOW.SHARED.RESOLVE_EDITOR
intent:
  Resolve editor command for edit flow.

inputs:
  invocation-shape
  terminal-capability
  env-config
  saved-default-editor

outputs:
  editor-command

STEP S1 FROM_CONFIG
  WHEN BETTER_AGE_EDITOR configured -> RETURN.OK(editor)
  WHEN saved default editor exists -> RETURN.OK(editor)
  WHEN VISUAL or EDITOR exists -> RETURN.OK(editor)
  WHEN terminal-capability = headless-terminal -> RETURN.ERROR(ERR.EDITOR.UNAVAILABLE)
  ELSE -> S2

STEP S2 GUIDED_PICKER
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.EDITOR.SELECT
    options:
      - known editor candidates
      - BACK
      - CANCEL
  WHEN editor selected -> S3
  WHEN BACK -> RETURN.BACK
  WHEN CANCEL -> RETURN.CANCEL

STEP S3 SAVE_MODE
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.EDITOR.SAVE_MODE
    options:
      - USE_ONCE
      - SAVE_AS_DEFAULT
      - BACK
      - CANCEL
  WHEN USE_ONCE -> RETURN.OK(editor)
  WHEN SAVE_AS_DEFAULT -> persist default -> RETURN.OK(editor)
  WHEN BACK -> LOOP S2
  WHEN CANCEL -> RETURN.CANCEL
```

### FLOW.SHARED.ACKNOWLEDGE_TEXT

```txt
FLOW FLOW.SHARED.ACKNOWLEDGE_TEXT
intent:
  Pause after substantial text output in interactive session.

inputs:
  none

outputs:
  acknowledged

STEP S1 ACK
  OPEN PROMPT.TEXT
    message-id: PROMPT.GENERIC.ACKNOWLEDGE
    bindings:
      - Enter => continue
      - Esc => continue
      - q => cancel
      - Ctrl+C => cancel
  WHEN continue -> RETURN.OK(acknowledged)
  WHEN cancel -> RETURN.CANCEL
```

## 5. Command flows

### CMD.SETUP

```txt
FLOW CMD.SETUP
intent:
  Create local self identity.

inputs:
  arg.alias?
  terminal-capability
  invocation-shape

outputs:
  created identity summary

STEP S1 CLASSIFY
  WHEN arg.alias present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 RESOLVE_ALIAS
  WHEN invocation-shape = exact and arg.alias missing -> EMIT stderr ERR.SETUP.ALIAS_REQUIRED -> END.ERROR
  WHEN invocation-shape = exact and arg.alias invalid -> EMIT stderr ERR.SETUP.ALIAS_INVALID -> END.ERROR
  WHEN invocation-shape = exact -> SET alias = arg.alias -> S4
  ELSE -> S3

STEP S3 GUIDED_ALIAS
  OPEN PROMPT.TEXT
    message-id: PROMPT.SETUP.ENTER_ALIAS
    default-value: deterministic default alias
  WHEN alias valid -> SET alias = value -> S4
  WHEN alias invalid -> EMIT stderr ERR.SETUP.ALIAS_INVALID -> OPEN MENU.SELECT_ONE(Edit alias / Back / Cancel)
    WHEN Edit alias -> LOOP S3
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL

STEP S4 CHECK_ALREADY_CONFIGURED
  WHEN active self identity exists -> EMIT stderr ERR.SETUP.ALREADY_CONFIGURED -> END.ERROR
  ELSE -> S5

STEP S5 REQUEST_PASSPHRASE_PAIR
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_PAIR
  WHEN RETURN.OK(passphrase) -> S6
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S6 CREATE_IDENTITY
  WHEN create succeeds -> EMIT stdout SUCCESS.SETUP.CREATED -> END.OK
  WHEN crypto/persistence failure -> EMIT stderr ERR.SETUP.CREATE_FAILED -> END.ERROR
```

`CMD.SETUP.GUIDED_INNER` is `CMD.SETUP` without top-level end handling, returning `RETURN.*`.

### CMD.ME

```txt
FLOW CMD.ME
intent:
  Output shareable identity string only.

inputs:
  none

outputs:
  identity-string

STEP S1 CHECK_SELF
  WHEN no self identity -> EMIT stderr ERR.SETUP.REQUIRED -> END.ERROR
  ELSE -> S2

STEP S2 EXPORT
  WHEN export succeeds -> EMIT stdout SUCCESS.ME.IDENTITY_STRING -> END.OK
  WHEN persistence failure -> EMIT stderr ERR.IDENTITY.EXPORT_FAILED -> END.ERROR
```

### CMD.IDENTITIES

```txt
FLOW CMD.IDENTITIES
intent:
  Output rich home identity summary.

inputs:
  none

outputs:
  home identity summary

STEP S1 INSPECT_HOME
  WHEN inspection succeeds -> EMIT stdout SUCCESS.IDENTITIES.SUMMARY -> END.OK
  WHEN persistence failure -> EMIT stderr ERR.IDENTITY.INSPECT_FAILED -> END.ERROR
```

### CMD.ADD_IDENTITY

```txt
FLOW CMD.ADD_IDENTITY
intent:
  Import one identity string into known identities.

inputs:
  arg.identity-string?
  terminal-capability

outputs:
  add/refresh/unchanged summary

STEP S1 CLASSIFY
  WHEN arg.identity-string present -> SET invocation-shape = exact -> SET identity-string = arg.identity-string -> S3
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 GUIDED_INPUT
  OPEN PROMPT.TEXT
    message-id: PROMPT.IDENTITY.ENTER_IDENTITY_STRING
  WHEN non-empty input -> SET identity-string = value -> S3
  WHEN BACK -> END.CANCEL
  WHEN CANCEL -> END.CANCEL

STEP S3 IMPORT
  WHEN identity-string invalid and invocation-shape = exact -> EMIT stderr ERR.IDENTITY_STRING.INVALID -> END.ERROR
  WHEN identity-string invalid and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_STRING.INVALID -> OPEN MENU.SELECT_ONE(Edit input / Back / Cancel)
    WHEN Edit input -> LOOP S2
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN identity-string resolves to self and invocation-shape = exact -> EMIT stderr ERR.IDENTITY_STRING.SELF_FORBIDDEN -> END.ERROR
  WHEN identity-string resolves to self and invocation-shape = guided -> EMIT stderr ERR.IDENTITY_STRING.SELF_FORBIDDEN -> OPEN MENU.SELECT_ONE(Edit input / Back / Cancel)
    WHEN Edit input -> LOOP S2
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN import adds identity -> EMIT stdout SUCCESS.IDENTITY.ADDED -> END.OK
  WHEN import refreshes identity -> EMIT stdout SUCCESS.IDENTITY.REFRESHED -> END.OK
  WHEN import unchanged -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN unreconcilable conflict -> EMIT stderr ERR.IDENTITY.CONFLICT -> END.ERROR
  WHEN persistence failure -> EMIT stderr ERR.IDENTITY.IMPORT_FAILED -> END.ERROR
```

### CMD.FORGET_IDENTITY

```txt
FLOW CMD.FORGET_IDENTITY
intent:
  Remove one known identity from local home state.

inputs:
  arg.identity-ref?
  terminal-capability

outputs:
  removed/unchanged summary

STEP S1 RESOLVE_REF
  CALL FLOW.SHARED.RESOLVE_FORGET_IDENTITY_REF
  WHEN RETURN.OK(identity-ref) -> S2
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S2 FORGET
  WHEN ref ambiguous and exact -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> END.ERROR
  WHEN ref ambiguous and guided typed -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN choose-candidate -> choose candidate -> LOOP S2
    WHEN edit-input -> LOOP S1
    WHEN BACK -> END.CANCEL
    WHEN CANCEL -> END.CANCEL
  WHEN ref resolves to self and exact -> EMIT stderr ERR.IDENTITY_REF.SELF_FORBIDDEN -> END.ERROR
  WHEN ref resolves to self and guided typed -> EMIT stderr ERR.IDENTITY_REF.SELF_FORBIDDEN -> OPEN MENU.SELECT_ONE(Edit input / Back / Cancel)
    WHEN Edit input -> LOOP S1
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN identity unknown -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN remove succeeds -> EMIT stdout SUCCESS.IDENTITY.FORGOTTEN -> END.OK
  WHEN persistence failure -> EMIT stderr ERR.IDENTITY.FORGET_FAILED -> END.ERROR
```

### CMD.ROTATE

```txt
FLOW CMD.ROTATE
intent:
  Rotate current local identity key material.

inputs:
  terminal-capability
  invocation-shape = exact

outputs:
  rotation summary

STEP S1 CHECK_SELF
  WHEN no self identity -> EMIT stderr ERR.SETUP.REQUIRED -> END.ERROR
  ELSE -> S2

STEP S2 REQUEST_PASSPHRASE
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  WHEN RETURN.OK(passphrase) -> S3
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 ROTATE
  WHEN decrypt/auth failure -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN rotate succeeds -> EMIT stdout SUCCESS.IDENTITY.ROTATED -> END.OK
  WHEN persistence/crypto failure -> EMIT stderr ERR.IDENTITY.ROTATE_FAILED -> END.ERROR
```

### CMD.CHANGE_PASSPHRASE

```txt
FLOW CMD.CHANGE_PASSPHRASE
intent:
  Change passphrase for local key material.

inputs:
  terminal-capability
  invocation-shape = exact

outputs:
  passphrase change summary

STEP S1 CHECK_SELF
  WHEN no self identity -> EMIT stderr ERR.SETUP.REQUIRED -> END.ERROR
  ELSE -> S2

STEP S2 CURRENT_PASSPHRASE
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  WHEN RETURN.OK(current-passphrase) -> S3
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 NEW_PASSPHRASE_PAIR
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_PAIR
  WHEN RETURN.OK(next-passphrase) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 CHANGE
  WHEN current passphrase invalid -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN change succeeds -> EMIT stdout SUCCESS.IDENTITY.PASSPHRASE_CHANGED -> END.OK
  WHEN persistence/crypto failure -> EMIT stderr ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED -> END.ERROR
```

### CMD.CREATE

```txt
FLOW CMD.CREATE
intent:
  Create new encrypted payload.

inputs:
  arg.path?
  terminal-capability

outputs:
  created payload summary

STEP S1 CLASSIFY
  WHEN arg.path present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_TARGET
  CALL FLOW.SHARED.RESOLVE_NEW_PAYLOAD_TARGET
  WHEN RETURN.OK(path, overwrite-approved) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 CREATE
  WHEN create succeeds -> EMIT stdout SUCCESS.CREATE.CREATED -> END.OK
  WHEN persistence/crypto failure -> EMIT stderr ERR.CREATE.FAILED -> END.ERROR
```

### CMD.INSPECT

```txt
FLOW CMD.INSPECT
intent:
  Inspect payload metadata without modifying it.

inputs:
  arg.path?
  terminal-capability

outputs:
  payload summary

STEP S1 CLASSIFY
  WHEN arg.path present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 INSPECT
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S4
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN invalid format/envelope/env -> EMIT stderr ERR.PAYLOAD.INVALID_FORMAT -> END.ERROR
  WHEN inspect succeeds -> EMIT stdout SUCCESS.INSPECT.SUMMARY -> END.OK
```

### CMD.VIEW

```txt
FLOW CMD.VIEW
intent:
  Open payload secrets in secure readonly viewer.

inputs:
  arg.path?
  terminal-capability

outputs:
  viewer session

STEP S1 CLASSIFY
  WHEN arg.path present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 OPEN_VIEWER
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S4
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN secure viewer unavailable -> EMIT stderr ERR.VIEWER.UNAVAILABLE -> END.ERROR
  WHEN secure viewer opens -> OPEN VIEWER(VIEW.PAYLOAD.SECURE_READONLY)
    WHEN viewer exits -> END.OK
```

### CMD.EDIT

```txt
FLOW CMD.EDIT
intent:
  Edit env text through editor and rewrite payload.

inputs:
  arg.path?
  terminal-capability

outputs:
  rewritten/unchanged summary

STEP S1 CLASSIFY
  WHEN arg.path present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 RESOLVE_EDITOR
  CALL FLOW.SHARED.RESOLVE_EDITOR
  WHEN RETURN.OK(editor) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S6
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S6 OPEN_FOR_EDIT
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S5
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN payload needs update -> S7
  WHEN open succeeds -> S8
  WHEN format/env/persistence failure -> EMIT stderr ERR.EDIT.OPEN_FAILED -> END.ERROR

STEP S7 UPDATE_GATE
  CALL FLOW.SHARED.UPDATE_GATE
  WHEN RETURN.OK(update-now) -> run update with cached path/passphrase
    WHEN update succeeds -> LOOP S6
    WHEN update fails -> EMIT stderr ERR.UPDATE.FAILED -> END.ERROR
  WHEN RETURN.BACK -> LOOP S3
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S8 EDIT_LOOP
  OPEN editor on temp file
  WHEN editor unavailable/launch failure -> EMIT stderr ERR.EDITOR.LAUNCH_FAILED -> END.ERROR
  WHEN editor closes -> validate env
    WHEN env invalid -> EMIT stderr ERR.EDIT.ENV_INVALID -> OPEN MENU.SELECT_ONE(Reopen editor / Discard changes and back / Cancel)
      WHEN Reopen editor -> LOOP S8
      WHEN Discard changes and back -> END.CANCEL
      WHEN Cancel -> END.CANCEL
    WHEN env unchanged -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
    WHEN save succeeds -> EMIT stdout SUCCESS.EDIT.REWRITTEN -> END.OK
    WHEN write failure -> EMIT stderr ERR.PAYLOAD.WRITE_FAILED -> END.ERROR
```

### CMD.GRANT

```txt
FLOW CMD.GRANT
intent:
  Add or refresh one recipient on one payload.

inputs:
  arg.path?
  arg.identity-ref?
  terminal-capability

outputs:
  grant summary

STEP S1 CLASSIFY
  WHEN arg.path present AND arg.identity-ref present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 RESOLVE_IDENTITY_REF
  CALL FLOW.SHARED.RESOLVE_GRANT_IDENTITY_TARGET
  WHEN RETURN.OK(identity-ref, intake-outcome) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 IDENTITY_READY
  intake-outcome meanings:
    - selected-known: user chose a known identity directly
    - entered-ref: user entered alias/display name/handle and it resolved
    - imported-added: full identity string added a new known identity
    - imported-updated: full identity string refreshed an existing known identity
    - imported-unchanged: full identity string matched current known state
  THEN -> S6

STEP S6 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S7
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S7 GRANT
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S6
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN payload needs update -> S8
  WHEN identity ambiguous and exact -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> END.ERROR
  WHEN identity ambiguous and guided typed -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN choose-candidate -> apply candidate -> LOOP S7
    WHEN edit-input -> LOOP S4
    WHEN BACK -> END.CANCEL
    WHEN CANCEL -> END.CANCEL
  WHEN identity not found and exact -> EMIT stderr ERR.IDENTITY_REF.NOT_FOUND -> END.ERROR
  WHEN identity not found and guided typed -> EMIT stderr ERR.IDENTITY_REF.NOT_FOUND -> OPEN MENU.SELECT_ONE(Edit input / Back / Cancel)
    WHEN Edit input -> LOOP S4
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN added -> EMIT stdout SUCCESS.GRANT.ADDED -> END.OK
  WHEN refreshed -> EMIT stdout SUCCESS.GRANT.REFRESHED -> END.OK
  WHEN unchanged already-granted -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN unchanged payload-already-newer -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN write failure -> EMIT stderr ERR.PAYLOAD.WRITE_FAILED -> END.ERROR

STEP S8 UPDATE_GATE
  CALL FLOW.SHARED.UPDATE_GATE
  WHEN RETURN.OK(update-now) -> run update with cached path/passphrase -> LOOP S7
  WHEN RETURN.BACK and arg.identity-ref omitted -> LOOP S4
  WHEN RETURN.BACK and arg.identity-ref present -> LOOP S3
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR
```

### CMD.REVOKE

```txt
FLOW CMD.REVOKE
intent:
  Remove one recipient from one payload.

inputs:
  arg.path?
  arg.identity-ref?
  terminal-capability

outputs:
  revoke summary

STEP S1 CLASSIFY
  WHEN arg.path present AND arg.identity-ref present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 RESOLVE_IDENTITY_REF
  CALL FLOW.SHARED.RESOLVE_REVOKE_IDENTITY_REF
  WHEN RETURN.OK(identity-ref) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S6
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S6 REVOKE
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S5
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN payload needs update -> S7
  WHEN typed ref resolves to self and exact -> EMIT stderr ERR.IDENTITY_REF.SELF_FORBIDDEN -> END.ERROR
  WHEN typed ref resolves to self and guided -> EMIT stderr ERR.IDENTITY_REF.SELF_FORBIDDEN -> OPEN MENU.SELECT_ONE(Edit input / Back / Cancel)
    WHEN Edit input -> LOOP S4
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN identity ambiguous and exact -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> END.ERROR
  WHEN identity ambiguous and guided typed -> EMIT stderr ERR.IDENTITY_REF.AMBIGUOUS -> CALL FLOW.SHARED.HANDLE_IDENTITY_ERROR_GUIDED
    WHEN choose-candidate -> apply candidate -> LOOP S6
    WHEN edit-input -> LOOP S4
    WHEN BACK -> END.CANCEL
    WHEN CANCEL -> END.CANCEL
  WHEN removed -> EMIT stdout SUCCESS.REVOKE.REMOVED -> END.OK
  WHEN target not currently granted -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN write failure -> EMIT stderr ERR.PAYLOAD.WRITE_FAILED -> END.ERROR

STEP S7 UPDATE_GATE
  CALL FLOW.SHARED.UPDATE_GATE
  WHEN RETURN.OK(update-now) -> run update with cached path/passphrase -> LOOP S6
  WHEN RETURN.BACK and arg.identity-ref omitted -> LOOP S4
  WHEN RETURN.BACK and arg.identity-ref present -> LOOP S3
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR
```

### CMD.UPDATE

```txt
FLOW CMD.UPDATE
intent:
  Explicitly rewrite payload for maintenance only.

inputs:
  arg.path?
  terminal-capability

outputs:
  update summary

STEP S1 CLASSIFY
  WHEN arg.path present -> SET invocation-shape = exact -> S2
  ELSE -> SET invocation-shape = guided -> S2

STEP S2 SETUP_REQUIREMENT
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 RESOLVE_PATH
  CALL FLOW.SHARED.RESOLVE_EXISTING_PAYLOAD_TARGET
  WHEN RETURN.OK(path) -> S4
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S4 REQUEST_PASSPHRASE
  WHEN invocation-shape = exact -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  ELSE -> CALL FLOW.SHARED.REQUEST_PASSPHRASE_WITH_RETRY
  WHEN RETURN.OK(passphrase) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 UPDATE
  WHEN decrypt/auth failure and invocation-shape = guided -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> OPEN MENU.SELECT_ONE(Retry passphrase / Back / Cancel)
    WHEN Retry passphrase -> LOOP S4
    WHEN Back -> END.CANCEL
    WHEN Cancel -> END.CANCEL
  WHEN decrypt/auth failure and invocation-shape = exact -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN updated with reasons -> EMIT stdout SUCCESS.UPDATE.UPDATED -> END.OK
  WHEN already current -> EMIT stdout INFO.MUTATION.UNCHANGED -> END.OK
  WHEN format/env/write failure -> EMIT stderr ERR.UPDATE.FAILED -> END.ERROR
```

### CMD.LOAD

```txt
FLOW CMD.LOAD
intent:
  Output raw env text to stdout for machine consumption.

inputs:
  arg.path (required)
  arg.protocol-version (required)
  terminal-capability
  invocation-shape = exact

outputs:
  raw env text

STEP S1 VALIDATE_PROTOCOL
  WHEN protocol missing -> EMIT stderr ERR.LOAD.PROTOCOL_REQUIRED -> END.ERROR
  WHEN protocol unsupported -> EMIT stderr ERR.LOAD.PROTOCOL_UNSUPPORTED -> END.ERROR
  ELSE -> S2

STEP S2 CHECK_SELF
  WHEN no self identity -> EMIT stderr ERR.SETUP.REQUIRED -> END.ERROR
  ELSE -> S3

STEP S3 CHECK_TERMINAL
  WHEN terminal-capability = headless-terminal -> EMIT stderr ERR.PASSPHRASE.UNAVAILABLE -> END.ERROR
  ELSE -> S4

STEP S4 REQUEST_PASSPHRASE
  CALL FLOW.SHARED.REQUEST_PASSPHRASE_ONCE
  WHEN RETURN.OK(passphrase) -> S5
  WHEN RETURN.BACK -> END.CANCEL
  WHEN RETURN.CANCEL -> END.CANCEL
  WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S5 READ
  WHEN explicit path missing/not found -> EMIT stderr ERR.PAYLOAD.PATH_NOT_FOUND -> END.ERROR
  WHEN decrypt/auth failure -> EMIT stderr ERR.PAYLOAD.DECRYPT_FAILED -> END.ERROR
  WHEN invalid format/env -> EMIT stderr ERR.PAYLOAD.INVALID_FORMAT -> END.ERROR
  WHEN payload needs update -> EMIT stderr WARN.LOAD.UPDATE_REQUIRED -> S6
  WHEN payload current -> S6

STEP S6 OUTPUT
  EMIT stdout SUCCESS.LOAD.ENV_TEXT
  END.OK
```

## 6. Interactive session flows

### CMD.INTERACTIVE

```txt
FLOW CMD.INTERACTIVE
intent:
  Guided hub for all human flows.

inputs:
  terminal-capability = interactive-terminal

outputs:
  session

STEP S1 CAPABILITY
  WHEN terminal-capability = headless-terminal -> EMIT stderr ERR.INTERACTIVE.UNAVAILABLE -> END.ERROR
  ELSE -> S2

STEP S2 INITIAL_SETUP
  WHEN self identity exists -> S3
  WHEN self identity missing -> CALL FLOW.SHARED.SETUP_GATE
    WHEN RETURN.OK -> S3
    WHEN RETURN.BACK -> END.CANCEL
    WHEN RETURN.CANCEL -> END.CANCEL
    WHEN RETURN.ERROR(message-id) -> EMIT stderr message-id -> END.ERROR

STEP S3 ROOT
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.INTERACTIVE.ROOT
    options:
      - FILES
      - MY_IDENTITY
      - QUIT
  WHEN FILES -> S4
  WHEN MY_IDENTITY -> S5
  WHEN QUIT -> END.CANCEL
  WHEN CANCEL -> END.CANCEL

STEP S4 FILES_MENU
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.INTERACTIVE.FILES
    options:
      - CREATE_PAYLOAD
      - INSPECT_PAYLOAD
      - VIEW_SECRETS
      - EDIT_SECRETS
      - GRANT_ACCESS
      - REVOKE_ACCESS
      - UPDATE_PAYLOAD
      - BACK
  WHEN CREATE_PAYLOAD -> run CMD.CREATE as guided session call -> RETURN to S4 after outcome handling
  WHEN INSPECT_PAYLOAD -> run CMD.INSPECT as guided session call -> ack -> RETURN to S4
  WHEN VIEW_SECRETS -> run CMD.VIEW as guided session call -> RETURN to S4
  WHEN EDIT_SECRETS -> run CMD.EDIT as guided session call -> RETURN to S4
  WHEN GRANT_ACCESS -> run CMD.GRANT as guided session call -> RETURN to S4
  WHEN REVOKE_ACCESS -> run CMD.REVOKE as guided session call -> RETURN to S4
  WHEN UPDATE_PAYLOAD -> run CMD.UPDATE as guided session call -> RETURN to S4
  WHEN BACK -> S3
  WHEN CANCEL -> S3

STEP S5 IDENTITY_MENU
  OPEN MENU.SELECT_ONE
    message-id: PROMPT.INTERACTIVE.IDENTITY
    options:
      - SHOW_IDENTITY
      - SHARE_IDENTITY_STRING
      - IMPORT_IDENTITY
      - FORGET_KNOWN_IDENTITY
      - ROTATE_IDENTITY
      - CHANGE_PASSPHRASE
      - BACK
  WHEN SHOW_IDENTITY -> emit rich identities summary -> ack -> RETURN to S5
  WHEN SHARE_IDENTITY_STRING -> emit me string -> ack -> RETURN to S5
  WHEN IMPORT_IDENTITY -> run CMD.ADD_IDENTITY as guided session call -> RETURN to S5
  WHEN FORGET_KNOWN_IDENTITY -> run CMD.FORGET_IDENTITY as guided session call -> RETURN to S5
  WHEN ROTATE_IDENTITY -> run CMD.ROTATE as direct interactive call -> RETURN to S5
  WHEN CHANGE_PASSPHRASE -> run CMD.CHANGE_PASSPHRASE as direct interactive call -> RETURN to S5
  WHEN BACK -> S3
  WHEN CANCEL -> S3
```

Session-return rules:
- subflow `END.OK` => return to current menu
- subflow `END.CANCEL` => return to current menu
- subflow `END.ERROR` => show error/status, return to current menu unless fatal unrecoverable infrastructure error

## 7. Coverage checklist

A full e2e suite derived from this document must cover:

- each command `END.OK`
- each command `END.CANCEL` where reachable
- each command `END.ERROR`
- each shared-flow `RETURN.BACK`
- each shared-flow `RETURN.CANCEL`
- each shared-flow `RETURN.ERROR`
- exact vs guided split for every human command
- interactive-terminal vs headless-terminal split where relevant
- explicit-path not-found
- explicit-ref ambiguous/not-found/self-forbidden
- decrypt/auth failure one-shot vs guided retry
- update gate yes/back/cancel
- setup gate yes/back/cancel
- editor invalid env reopen/discard/cancel
- interactive ack vs no-ack outputs
- `load` warning-on-update but exit `0`

## 8. Notes

- This is target-state. Current implementation may drift.
- If implementation disagrees with this file, this file wins for future UX work unless superseded by a newer decision in [GRILL_ME_FLOW.md](./GRILL_ME_FLOW.md).
