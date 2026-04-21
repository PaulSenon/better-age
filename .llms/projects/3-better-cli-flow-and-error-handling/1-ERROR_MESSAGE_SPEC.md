# Better Secrets Error Message Spec

Target-state user-facing error and warning catalog for `packages/cli`.

Purpose:
- normalize all user-facing failures before implementation
- collapse low-level typed errors into stable UX contexts
- remove weird generic messages and raw exception leakage

This doc complements:
- [INTERACTION_FLOW_SPEC.md](./INTERACTION_FLOW_SPEC.md)
- [ERROR_HANDLING_SOURCE_OF_TRUTH.md](./ERROR_HANDLING_SOURCE_OF_TRUTH.md)

## 1. Coverage audit

The flow spec now covers all top-level decision branches of the app state tree:
- all top-level commands
- direct exact flows
- guided flows
- `interactive` navigation flows
- shared gates and retry loops
- back/cancel/error endings

Branches that should be treated as central cross-cutting failures instead of repeated in every flow:
- startup config invalid
- home state unreadable
- home state invalid/corrupt
- payload discovery failed
- prompt unavailable
- editor unavailable / launch failed / exit non-zero
- temp file create/read failed
- secure viewer unavailable / render failed
- uncaught internal defect

With those centralized, branch coverage is complete enough for target-state spec work.

## 2. Message contract

### 2.1 Error shape

Direct error/warning output uses this shape:

```txt
<summary line>
<optional context line>
<optional candidate block>
<optional remediation line>
```

Rules:
- no stack traces
- no raw `String(cause)`
- no internal type names
- summary line must stand alone
- one remediation line max unless truly needed
- end with newline

### 2.2 Tone

Rules:
- factual, short, non-dramatic
- say what is wrong, not how the code failed
- mention one concrete target when useful
- use ubiquitous language where possible
- avoid “unexpected error” unless truly internal defect

### 2.3 Sinks

- `stderr`
  - all errors
  - all warnings
  - remediation
- `stdout`
  - success/info outcomes only
- no error text inside secure viewer

### 2.4 Cancel rule

Intentional user cancel/back should not print error text by default.

Exceptions:
- none currently

### 2.5 Candidate lists

Ambiguity messages use this shape:

```txt
Identity ref is ambiguous: <input>

Candidates:
- <candidate-1>
- <candidate-2>
```

### 2.6 Warning shape

Warnings use explicit prefix:

```txt
Warning: <summary>
<optional remediation>
```

Needed because warnings go to `stderr` but are non-fatal.

## 3. Error families

### 3.1 Runtime / startup

These are command-agnostic.

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.RUNTIME.CONFIG_INVALID` | CLI config cannot load/parse | `Invalid better-age configuration` | `Fix config, then retry` |
| `ERR.RUNTIME.STATE_UNREADABLE` | home state cannot be read | `Failed to read local home state` | `Check file permissions and local state integrity, then retry` |
| `ERR.RUNTIME.STATE_INVALID` | home state exists but cannot decode | `Local home state is invalid` | `Repair or remove corrupted state, then retry` |
| `ERR.RUNTIME.PAYLOAD_DISCOVERY_FAILED` | cwd payload discovery failed | `Failed to discover payloads in current directory` | `Pass a payload path explicitly` |
| `ERR.RUNTIME.TEMPFILE_CREATE_FAILED` | temp file for edit cannot be created | `Failed to create temporary edit file` | `Check temp directory permissions and available space, then retry` |
| `ERR.RUNTIME.TEMPFILE_READ_FAILED` | edited temp file cannot be read back | `Failed to read edited temporary file` | `Retry edit` |
| `ERR.RUNTIME.INTERNAL` | uncaught defect | `Internal error` | `Retry. If the problem persists, report it with reproduction steps` |

### 3.2 Setup / local self identity

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.SETUP.REQUIRED` | command needs local self identity and none exists | `No local self identity found` | `Run: bage setup` |
| `ERR.SETUP.ALREADY_CONFIGURED` | setup attempted when self identity already exists | `Local self identity already exists` | `Use existing identity or rotate it` |
| `ERR.SETUP.ALIAS_REQUIRED` | exact setup missing explicit alias/display name | `Missing required display name` | `Run: bage setup --alias <display-name>` |
| `ERR.SETUP.ALIAS_INVALID` | provided display name invalid | `Invalid display name` | none in exact; guided flow offers edit/back/cancel |
| `ERR.SETUP.PASSPHRASE_MISMATCH` | setup/change-passphrase pair mismatch | `Passphrases do not match` | none |
| `ERR.SETUP.CREATE_FAILED` | identity creation crypto/persistence failure | `Failed to create local identity` | `Retry setup` |

### 3.3 Operand / target resolution

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.PAYLOAD.MISSING_PATH` | exact command missing required payload path | `Missing required payload path` | `Pass a payload path explicitly` |
| `ERR.PAYLOAD.PATH_NOT_FOUND` | explicit or guided-entered path missing | `Payload not found: <path>` | none |
| `ERR.PAYLOAD.PATH_ALREADY_EXISTS` | create exact target already exists | `Payload already exists: <path>` | `Pass a different path explicitly` |
| `ERR.IDENTITY_REF.MISSING` | exact command missing required identity ref | `Missing required identity ref` | `Pass an identity ref explicitly` |
| `ERR.IDENTITY_REF.NOT_FOUND` | entered identity input is not a full identity string and resolves to no local alias, display name, or handle | `Identity not found: <ref>` | none |
| `ERR.IDENTITY_REF.AMBIGUOUS` | entered identity input is not a full identity string and resolves to multiple local alias/display name/handle matches | `Identity ref is ambiguous: <ref>` + candidate block | none |
| `ERR.IDENTITY_REF.SELF_FORBIDDEN` | operation forbids self target | command-specific text, see section 4 | none |
| `ERR.IDENTITY_STRING.INVALID` | full identity string entered in any identity-intake flow is invalid | `Invalid identity string` | none |
| `ERR.IDENTITY_STRING.SELF_FORBIDDEN` | self-import/self-grant string path forbidden | command-specific text, see section 4 | none |
| `ERR.IDENTITY.ALIAS_INVALID` | guided local alias entered for imported identity collision resolution is invalid or not unique | `Invalid local alias` | none |

### 3.4 Prompt / interactivity surface

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.INTERACTIVE.UNAVAILABLE` | `interactive` called without interactive terminal | `Interactive session requires an interactive terminal` | none |
| `ERR.PROMPT.UNAVAILABLE` | command needs secure prompt/menu but terminal cannot support it | `Interactive input is unavailable in this environment` | `Use an interactive terminal or pass all required inputs explicitly when supported` |
| `ERR.PASSPHRASE.UNAVAILABLE` | secure passphrase prompt unavailable | `Secure passphrase input is unavailable in this environment` | `Use an interactive terminal` |

Intentional prompt abort:
- maps to cancel, not error
- no default error text

### 3.5 Payload read / decrypt / parse

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.PAYLOAD.INVALID_FORMAT` | payload outer file format, envelope, or env structure invalid | `Invalid payload format: <path>` | none |
| `ERR.PAYLOAD.DECRYPT_FAILED` | decrypt/auth failed, usually wrong passphrase or wrong key access | `Failed to decrypt payload with provided passphrase` | none |
| `ERR.PAYLOAD.UPDATE_REQUIRED` | human mutation command blocked on update | `Payload must be updated before <command>` | `Run: bage update <path>` |

### 3.6 Payload mutation / write

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.PAYLOAD.WRITE_FAILED` | payload write/rewrite fails | `Failed to write payload: <path>` | `Retry after fixing file permissions or disk issues` |
| `ERR.UPDATE.FAILED` | explicit update command fails beyond simple decrypt error | `Failed to update payload: <path>` | none |
| `ERR.CREATE.FAILED` | create payload fails beyond simple setup/path issues | `Failed to create payload: <path>` | none |

### 3.7 Identity import / export / maintenance

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.IDENTITY.EXPORT_FAILED` | `me` export fails unexpectedly | `Failed to export identity string` | `Retry` |
| `ERR.IDENTITY.INSPECT_FAILED` | `identities`/show summary load fails | `Failed to inspect local identities` | `Retry` |
| `ERR.IDENTITY.IMPORT_FAILED` | identity import persistence failure | `Failed to save imported identity` | `Retry` |
| `ERR.IDENTITY.CONFLICT` | import conflict cannot reconcile safely | `Imported identity conflicts with existing local state` | `Resolve conflict before retrying import` |
| `ERR.IDENTITY.FORGET_FAILED` | forget persistence failure | `Failed to forget local identity` | `Retry` |
| `ERR.IDENTITY.ROTATE_FAILED` | rotate crypto/persistence failure | `Failed to rotate local identity` | `Retry` |
| `ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED` | change-passphrase crypto/persistence failure | `Failed to change local passphrase` | `Retry` |

Identity-intake rule:
- one canonical identity-intake surface may accept:
  - local alias
  - display name
  - handle
  - full identity string
- full identity string intake may upsert known identity state before continuing the original command
- guided interactive flows may request a local alias when imported visible label would collide with self or another known identity visible label
- exact flows do not block on alias prompt

### 3.8 Editor / viewer

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `ERR.EDITOR.UNAVAILABLE` | no editor configured and guided picker unavailable | `No editor is configured` | `Set BETTER_AGE_EDITOR, save a default editor, or set VISUAL/EDITOR` |
| `ERR.EDITOR.LAUNCH_FAILED` | editor process cannot start | `Failed to launch editor` | `Check editor command and retry` |
| `ERR.EDITOR.EXIT_NON_ZERO` | editor exits with non-zero status | `Editor exited without saving successfully` | `Retry edit` |
| `ERR.EDIT.ENV_INVALID` | edited env invalid | `Edited env is invalid` | none |
| `ERR.EDIT.OPEN_FAILED` | edit open/decrypt/parse path fails beyond wrong passphrase | `Failed to open payload for editing` | none |
| `ERR.VIEWER.UNAVAILABLE` | secure viewer needs interactive tty | `Secure viewer requires an interactive terminal` | none |
| `ERR.VIEWER.RENDER_FAILED` | secure viewer launch/render fails | `Failed to open secure viewer` | `Retry view` |

### 3.9 Load-only warning

| Id | When | Pattern | Remediation |
| --- | --- | --- | --- |
| `WARN.LOAD.UPDATE_REQUIRED` | payload metadata says update recommended/needed but load still proceeds | `Warning: payload should be updated` | `Run: bage update <path>` |

## 4. Command-specific specialized messages

These need slightly different copy from the shared family template.

| Context | Id | Pattern |
| --- | --- | --- |
| revoke self exact/guided typed | `ERR.IDENTITY_REF.SELF_FORBIDDEN` | `Cannot revoke your own access` |
| add-identity self import | `ERR.IDENTITY_STRING.SELF_FORBIDDEN` | `Cannot import your own identity string` |
| forget self | `ERR.IDENTITY_REF.SELF_FORBIDDEN` | `Cannot forget your own local identity` |

## 5. Guided-flow inline error menus

Guided flows should reuse these action shapes after showing the error message.

### 5.1 Entered identity error

Use after:
- invalid identity string
- not found identity ref
- self-forbidden entered identity input
- invalid local alias during guided imported-identity collision resolution

Menu:

```txt
Edit input
Back
Cancel
```

### 5.2 Ambiguous identity error

Use after:
- ambiguous entered alias/display-name/handle input

Menu:

```txt
Choose candidate
Edit input
Back
Cancel
```

### 5.3 Decrypt/auth failure in guided human command

Use after:
- wrong passphrase in `inspect`, `view`, `edit`, `grant`, `revoke`, `update`

Menu:

```txt
Retry passphrase
Back
Cancel
```

### 5.4 Invalid edited env

Use after:
- edited env parse/validation failure

Menu:

```txt
Reopen editor
Discard changes and back
Cancel
```

## 6. Rendering examples

### 6.1 Missing setup

```txt
No local self identity found
Run: bage setup
```

### 6.2 Ambiguous identity

```txt
Identity ref is ambiguous: alex

Candidates:
- alex#1234abcd
- alex#89ef0123
```

### 6.3 Load warning

```txt
Warning: payload should be updated
Run: bage update ./.env.enc
```

### 6.4 Exact missing payload path

```txt
Missing required payload path
Pass a payload path explicitly
```

### 6.5 Viewer unavailable

```txt
Secure viewer requires an interactive terminal
```

## 7. Suppressed / non-user-facing failures

These should not replace the primary command outcome:
- temp file cleanup failure after command already finished
- best-effort rollback cleanup failure after a higher-priority user-visible failure already happened

Handling rule:
- log internally when possible
- do not surface to user unless they are the primary failure

## 8. Implementation rule

Before any command writes `stderr`, it should render from this catalog, not from raw `.message`, except:
- candidate lists assembled from runtime data
- exact path/ref interpolation
- editor/viewer command names when needed for actionable remediation
