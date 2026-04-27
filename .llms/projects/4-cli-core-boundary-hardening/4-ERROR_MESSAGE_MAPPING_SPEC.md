# Error Message Mapping Spec

Status: active mapping between semantic errors, message ids, exit behavior, and safe details.

## Rules

- Message ids follow `ERR.<SCOPE>.<REASON>`.
- Domain/core errors map to user-facing ids at CLI boundary.
- CLI-only errors map directly to user-facing ids.
- Missing operand errors are CLI-only.
- Varlock errors are adapter errors and not core errors.
- Cancel/back are flow signals, not mapped here.
- Secret/security failures intentionally expose little detail.

## Exit Codes

```txt
success -> 0
unchanged success -> 0
quiet cancel/back -> 1
domain/user error -> 1
internal defect -> 1
Ctrl+C abort -> 130
```

## Setup

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `SETUP_NAME_MISSING` | `ERR.SETUP.NAME_MISSING` | 1 | command, option |
| `SETUP_NAME_INVALID` | `ERR.SETUP.NAME_INVALID` | 1 | reason if safe |
| `SETUP_ALREADY_CONFIGURED` | `ERR.SETUP.ALREADY_CONFIGURED` | 1 | none |
| `KEY_GENERATION_FAILED` | `ERR.IDENTITY.KEY_GENERATION_FAILED` | 1 | raw cause diagnostics-only |
| `PRIVATE_KEY_PROTECTION_FAILED` | `ERR.HOME.PRIVATE_KEY_PROTECTION_FAILED` | 1 | raw cause diagnostics-only |

## Home State

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `HOME_STATE_NOT_FOUND` | `ERR.SETUP.REQUIRED` | 1 | remediation |
| `HOME_STATE_READ_FAILED` | `ERR.HOME.READ_FAILED` | 1 | none by default |
| `HOME_STATE_INVALID` | `ERR.HOME.STATE_INVALID` | 1 | none by default |
| `HOME_STATE_WRITE_FAILED` | `ERR.HOME.WRITE_FAILED` | 1 | none by default |
| `HOME_STATE_CLI_TOO_OLD` | `ERR.HOME.CLI_TOO_OLD` | 1 | artifact/current versions |
| `HOME_STATE_MIGRATION_PATH_MISSING` | `ERR.HOME.MIGRATION_PATH_MISSING` | 1 | from/to if known |
| `HOME_STATE_MIGRATION_HARD_BROKEN` | `ERR.HOME.MIGRATION_HARD_BROKEN` | 1 | from/to if known |

## Passphrase And Keys

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `PASSPHRASE_UNAVAILABLE` | `ERR.PASSPHRASE.UNAVAILABLE` | 1 | required interactive capability |
| `PASSPHRASE_INCORRECT` | `ERR.PASSPHRASE.INCORRECT` | 1 | none |
| `PASSPHRASE_CONFIRMATION_MISMATCH` | `ERR.PASSPHRASE.CONFIRMATION_MISMATCH` | prompt validation, no exit | none |
| `PRIVATE_KEY_DECRYPT_FAILED` | `ERR.HOME.PRIVATE_KEY_DECRYPT_FAILED` | 1 | none by default |
| `PRIVATE_KEY_REENCRYPT_FAILED` | `ERR.HOME.PRIVATE_KEY_REENCRYPT_FAILED` | 1 | raw cause diagnostics-only |
| `PRIVATE_KEY_PROTECTION_FAILED` | `ERR.HOME.PRIVATE_KEY_PROTECTION_FAILED` | 1 | raw cause diagnostics-only |

## Payload

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `PAYLOAD_PATH_MISSING` | `ERR.PAYLOAD.PATH_MISSING` | 1 | command |
| `PAYLOAD_NOT_FOUND` | `ERR.PAYLOAD.NOT_FOUND` | 1 | path |
| `PAYLOAD_ALREADY_EXISTS` | `ERR.PAYLOAD.ALREADY_EXISTS` | 1 | path |
| `PAYLOAD_READ_FAILED` | `ERR.PAYLOAD.READ_FAILED` | 1 | path; raw cause diagnostics-only |
| `PAYLOAD_WRITE_FAILED` | `ERR.PAYLOAD.WRITE_FAILED` | 1 | path; raw cause diagnostics-only |
| `PAYLOAD_INVALID` | `ERR.PAYLOAD.INVALID` | 1 | path |
| `PAYLOAD_ENV_INVALID` | `ERR.PAYLOAD.ENV_INVALID` | 1 | validation summary |
| `PAYLOAD_ENCRYPT_FAILED` | `ERR.PAYLOAD.ENCRYPT_FAILED` | 1 | raw cause diagnostics-only |
| `PAYLOAD_DECRYPT_FAILED` | `ERR.PAYLOAD.DECRYPT_FAILED` | 1 | none |
| `PAYLOAD_ACCESS_DENIED` | `ERR.PAYLOAD.ACCESS_DENIED` | 1 | none |

## Payload Compatibility / Update

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `PAYLOAD_CLI_TOO_OLD` | `ERR.PAYLOAD.CLI_TOO_OLD` | 1 | artifact/current versions |
| `PAYLOAD_MIGRATION_PATH_MISSING` | `ERR.PAYLOAD.MIGRATION_PATH_MISSING` | 1 | from/to if known |
| `PAYLOAD_MIGRATION_HARD_BROKEN` | `ERR.PAYLOAD.MIGRATION_HARD_BROKEN` | 1 | from/to if known |
| `PAYLOAD_UPDATE_REQUIRED` | `ERR.PAYLOAD.UPDATE_REQUIRED` | 1 | path, reasons |

Readable-but-outdated read success maps to:

```txt
WARN.PAYLOAD.UPDATE_RECOMMENDED
exit 0
details: path, reasons
```

## Identity

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `IDENTITY_STRING_MISSING` | `ERR.IDENTITY.STRING_MISSING` | 1 | command |
| `IDENTITY_STRING_INVALID` | `ERR.IDENTITY.STRING_INVALID` | 1 | reason if safe |
| `IDENTITY_REFERENCE_MISSING` | `ERR.IDENTITY.REFERENCE_MISSING` | 1 | command |
| `IDENTITY_REFERENCE_NOT_FOUND` | `ERR.IDENTITY.NOT_FOUND` | 1 | input ref, resolution scope |
| `IDENTITY_REFERENCE_AMBIGUOUS` | `ERR.IDENTITY.AMBIGUOUS` | 1 | input ref, resolution scope, candidates |
| `KNOWN_IDENTITY_CONFLICT` | `ERR.IDENTITY.CONFLICT` | 1 | owner id |
| `LOCAL_ALIAS_INVALID` | `ERR.IDENTITY.ALIAS_INVALID` | 1 | alias, reason |
| `LOCAL_ALIAS_DUPLICATE` | `ERR.IDENTITY.ALIAS_DUPLICATE` | 1 | alias, conflicting owner id |
| `CANNOT_IMPORT_SELF_IDENTITY` | `ERR.IDENTITY.CANNOT_IMPORT_SELF` | 1 | none |
| `CANNOT_FORGET_SELF_IDENTITY` | `ERR.IDENTITY.CANNOT_FORGET_SELF` | 1 | none |

## Grant / Revoke

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `CANNOT_GRANT_SELF` | `ERR.GRANT.CANNOT_GRANT_SELF` | 1 | none |
| `CANNOT_REVOKE_SELF` | `ERR.REVOKE.CANNOT_REVOKE_SELF` | 1 | none |

Idempotent branches are success, not errors:

```txt
grant already granted -> SUCCESS.PAYLOAD.GRANT { outcome: "unchanged" }
revoke not granted -> SUCCESS.PAYLOAD.REVOKE { outcome: "unchanged" }
```

## Prompt / Editor / Viewer

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `PROMPT_UNAVAILABLE` | `ERR.PROMPT.UNAVAILABLE` | 1 | capability |
| `PROMPT_ABORTED` | no scary error id | 1 | prompt name if needed |
| Ctrl+C during prompt | no scary error id | 130 | none |
| `INTERACTIVE_UNAVAILABLE` | `ERR.INTERACTIVE.UNAVAILABLE` | 1 | none |
| `EDITOR_UNAVAILABLE` | `ERR.EDITOR.UNAVAILABLE` | 1 | none by default |
| `EDITOR_LAUNCH_FAILED` | `ERR.EDITOR.LAUNCH_FAILED` | 1 | editor command only if user-configured; raw stderr diagnostics-only |
| `EDITOR_EXIT_NON_ZERO` | `ERR.EDITOR.EXIT_NON_ZERO` | 1 | exit code; editor command only if user-configured; raw stderr diagnostics-only |
| `EDITOR_TEMP_FILE_CREATE_FAILED` | `ERR.EDITOR.TEMP_FILE_CREATE_FAILED` | 1 | no temp path by default |
| `EDITOR_TEMP_FILE_READ_FAILED` | `ERR.EDITOR.TEMP_FILE_READ_FAILED` | 1 | no temp path by default |
| `SECURE_VIEWER_UNAVAILABLE` | `ERR.VIEWER.UNAVAILABLE` | 1 | none |
| `SECURE_VIEWER_RENDER_FAILED` | `ERR.VIEWER.RENDER_FAILED` | 1 | none by default |

## Load Protocol / Varlock

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `LOAD_PROTOCOL_REQUIRED` | `ERR.LOAD.PROTOCOL_REQUIRED` | 1 | expected version |
| `LOAD_PROTOCOL_UNSUPPORTED` | `ERR.LOAD.PROTOCOL_UNSUPPORTED` | 1 | received, expected |
| `LOAD_STDOUT_PIPE_UNAVAILABLE` | `ERR.VARLOCK.STDOUT_PIPE_UNAVAILABLE` | adapter error | none |
| `VARLOCK_CLI_START_FAILED` | `ERR.VARLOCK.CLI_START_FAILED` | adapter error | launcher, cause |
| `VARLOCK_LOAD_EXIT_NON_ZERO` | `ERR.VARLOCK.LOAD_EXIT_NON_ZERO` | adapter error | exit code |
| `VARLOCK_NOT_INITIALIZED` | `ERR.VARLOCK.NOT_INITIALIZED` | adapter error | none |
| `VARLOCK_MULTIPLE_INIT_UNSUPPORTED` | `ERR.VARLOCK.MULTIPLE_INIT_UNSUPPORTED` | adapter error | none |

Rules:

- varlock adapter errors are not CLI exit codes.
- `LoadProtocolFailure` represents the CLI process returning a protocol-level failure.
- `VarlockAdapterFailure` represents the plugin/runtime failing to start, wire, or interpret that protocol.

## Internal

| Error kind | Message id | Exit | Safe details |
| --- | --- | --- | --- |
| `INTERNAL_DEFECT` | `ERR.INTERNAL.DEFECT` | 1 | none by default |
| `UNREACHABLE_STATE` | `ERR.INTERNAL.DEFECT` | 1 | none by default |
| `PORT_IMPLEMENTATION_MISSING` | `ERR.INTERNAL.DEFECT` | 1 | none by default |

## Open Mapping Questions

None active after current cleanup pass.
