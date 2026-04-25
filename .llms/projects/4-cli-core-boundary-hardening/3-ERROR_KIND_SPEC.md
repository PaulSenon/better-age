# Error Kind Spec

Status: active taxonomy. Goal: exhaustive semantic error kinds before implementation.

## Principles

- Core errors describe semantic/domain/app failure.
- CLI errors describe shell, prompt, editor, viewer, argv, and presentation failure.
- Missing mandatory operands are CLI-only errors; core receives exact inputs.
- Message ids are stable UX mapping keys, not raw error text.
- Low-level technical causes may be preserved internally but are not default user copy.
- Cancel/back are CLI flow signals, not error kinds.
- Notices are not errors.

## Setup Errors

```txt
SETUP_NAME_INVALID
SETUP_ALREADY_CONFIGURED
```

## Home State Errors

```txt
HOME_STATE_NOT_FOUND
HOME_STATE_READ_FAILED
HOME_STATE_INVALID
HOME_STATE_WRITE_FAILED
HOME_STATE_CLI_TOO_OLD
HOME_STATE_MIGRATION_PATH_MISSING
HOME_STATE_MIGRATION_HARD_BROKEN
```

Rules:

- no setup is `HOME_STATE_NOT_FOUND`.
- home exists but self identity is missing is `HOME_STATE_INVALID`.
- for `setup`, `HOME_STATE_NOT_FOUND` is expected and not an error.

## Passphrase And Key Errors

```txt
PASSPHRASE_UNAVAILABLE
PASSPHRASE_INCORRECT
PASSPHRASE_CONFIRMATION_MISMATCH
PRIVATE_KEY_DECRYPT_FAILED
PRIVATE_KEY_REENCRYPT_FAILED
PRIVATE_KEY_PROTECTION_FAILED
KEY_GENERATION_FAILED
```

Decrypt/security semantics:

```txt
PASSPHRASE_INCORRECT:
  local private key could not decrypt with supplied passphrase

PAYLOAD_ACCESS_DENIED:
  passphrase was valid for local key, but none of the local keys can decrypt payload

PAYLOAD_DECRYPT_FAILED:
  payload decrypt failed for non-auth-specific crypto/corruption reason

PRIVATE_KEY_DECRYPT_FAILED:
  local private-key material could not decrypt for a non-normal credential reason.
  Wrong user credential is PASSPHRASE_INCORRECT, not this error.
  This can occur while decrypting local keys for payload access or identity rotation.

KEY_GENERATION_FAILED:
  key generation failed at crypto/runtime layer.
  Raw cause is diagnostics-only by default.

PRIVATE_KEY_PROTECTION_FAILED:
  local private key could not be encrypted/protected for persistence.
  Raw cause is diagnostics-only by default.

PRIVATE_KEY_REENCRYPT_FAILED:
  existing local private key could not be reencrypted during passphrase change.
  Raw cause is diagnostics-only by default.

PAYLOAD_ENCRYPT_FAILED:
  payload could not be encrypted for persistence.
  Raw cause is diagnostics-only by default.
```

Prompt/capability distinction:

```txt
PASSPHRASE_UNAVAILABLE:
  command needs a credential, but execution context cannot acquire it.
  Example: credential-required command in headless mode.

PROMPT_UNAVAILABLE:
  CLI expected a human prompt/menu/text input, but prompt infra is unavailable or broken.

PASSPHRASE_CONFIRMATION_MISMATCH:
  inline prompt validation message.
  It retries the passphrase pair and is not a command-failure exit by itself.
```

## Payload File And Content Errors

```txt
PAYLOAD_NOT_FOUND
PAYLOAD_ALREADY_EXISTS
PAYLOAD_READ_FAILED
PAYLOAD_WRITE_FAILED
PAYLOAD_INVALID
PAYLOAD_ENV_INVALID
PAYLOAD_ENCRYPT_FAILED
PAYLOAD_DECRYPT_FAILED
PAYLOAD_ACCESS_DENIED
```

## Payload Compatibility And Update Errors

```txt
PAYLOAD_CLI_TOO_OLD
PAYLOAD_MIGRATION_PATH_MISSING
PAYLOAD_MIGRATION_HARD_BROKEN
PAYLOAD_UPDATE_REQUIRED
```

Rules:

- payload compatibility stays separate from repository/file IO errors.
- payload decrypt and mutation operations include repository, content, compatibility, and secret error groups.
- missing update reasons are not an error; update with no reasons is success unchanged.
- payload read operations can return not-found/read-failed, not write/already-exists.
- payload create can return already-exists/write-failed, not not-found/read-failed.
- payload mutation can return not-found/read-failed/write-failed, not already-exists.

## Identity Parse And Resolution Errors

```txt
IDENTITY_STRING_INVALID
IDENTITY_REFERENCE_NOT_FOUND
IDENTITY_REFERENCE_AMBIGUOUS
KNOWN_IDENTITY_CONFLICT
LOCAL_ALIAS_INVALID
LOCAL_ALIAS_DUPLICATE
```

Resolution error details include scope:

```txt
scope:
  known-identities
  payload-recipients
  known-and-payload-recipients
```

Grant recipient resolution:

```txt
exact grant identity-ref:
  parse as identity string when the input is a valid identity string
  otherwise resolve against known identities + payload recipients
  return exact PublicIdentitySnapshot
```

## Identity Command Domain Errors

```txt
CANNOT_IMPORT_SELF_IDENTITY
CANNOT_FORGET_SELF_IDENTITY
```

Rules:

- do not use aggregate command failures for `identity rotate` or `identity passphrase`.
- return precise lower-level semantic failures instead.
- command context may still shape CLI copy/remediation.

## Grant/Revoke Domain Errors

```txt
CANNOT_GRANT_SELF
CANNOT_REVOKE_SELF
```

Not errors:

```txt
grant already granted same/older -> success unchanged
revoke recipient not granted -> success unchanged
```

## CLI Prompt / Editor / Viewer Errors

```txt
PROMPT_UNAVAILABLE
PROMPT_ABORTED
INTERACTIVE_UNAVAILABLE
EDITOR_UNAVAILABLE
EDITOR_LAUNCH_FAILED
EDITOR_EXIT_NON_ZERO
EDITOR_TEMP_FILE_CREATE_FAILED
EDITOR_TEMP_FILE_READ_FAILED
SECURE_VIEWER_UNAVAILABLE
SECURE_VIEWER_RENDER_FAILED
```

## Load Protocol / Varlock Errors

```txt
LOAD_PROTOCOL_REQUIRED
LOAD_PROTOCOL_UNSUPPORTED
LOAD_STDOUT_PIPE_UNAVAILABLE
VARLOCK_CLI_START_FAILED
VARLOCK_LOAD_EXIT_NON_ZERO
VARLOCK_NOT_INITIALIZED
VARLOCK_MULTIPLE_INIT_UNSUPPORTED
```

## Internal Defects

```txt
INTERNAL_DEFECT
UNREACHABLE_STATE
PORT_IMPLEMENTATION_MISSING
```

## Open Taxonomy Questions

None active after current cleanup pass.

## Idempotent Success Cases

These are success codes, not errors:

```txt
grant already granted same/older -> success unchanged
revoke recipient not granted -> success unchanged
update no reasons -> success unchanged
edit identical content -> success unchanged
identity import known same/older -> success unchanged unless alias changed
```

Exception:

```txt
identity forget unknown exact ref -> error
```

## Ownership Classification

### Core-Owned Errors

```txt
HOME_STATE_NOT_FOUND
HOME_STATE_READ_FAILED
HOME_STATE_INVALID
HOME_STATE_WRITE_FAILED
HOME_STATE_CLI_TOO_OLD
HOME_STATE_MIGRATION_PATH_MISSING
HOME_STATE_MIGRATION_HARD_BROKEN
SETUP_NAME_INVALID
SETUP_ALREADY_CONFIGURED
PASSPHRASE_INCORRECT
PRIVATE_KEY_DECRYPT_FAILED
PRIVATE_KEY_REENCRYPT_FAILED
PRIVATE_KEY_PROTECTION_FAILED
KEY_GENERATION_FAILED

PAYLOAD_NOT_FOUND
PAYLOAD_ALREADY_EXISTS
PAYLOAD_READ_FAILED
PAYLOAD_WRITE_FAILED
PAYLOAD_INVALID
PAYLOAD_ENV_INVALID
PAYLOAD_ENCRYPT_FAILED
PAYLOAD_DECRYPT_FAILED
PAYLOAD_ACCESS_DENIED
PAYLOAD_CLI_TOO_OLD
PAYLOAD_MIGRATION_PATH_MISSING
PAYLOAD_MIGRATION_HARD_BROKEN
PAYLOAD_UPDATE_REQUIRED

IDENTITY_STRING_INVALID
IDENTITY_REFERENCE_NOT_FOUND
IDENTITY_REFERENCE_AMBIGUOUS
KNOWN_IDENTITY_CONFLICT
LOCAL_ALIAS_INVALID
LOCAL_ALIAS_DUPLICATE

CANNOT_IMPORT_SELF_IDENTITY
CANNOT_FORGET_SELF_IDENTITY
CANNOT_GRANT_SELF
CANNOT_REVOKE_SELF
```

### CLI-Only Errors

```txt
SETUP_NAME_MISSING
IDENTITY_STRING_MISSING
IDENTITY_REFERENCE_MISSING
PAYLOAD_PATH_MISSING
PASSPHRASE_UNAVAILABLE
PASSPHRASE_CONFIRMATION_MISMATCH
PROMPT_UNAVAILABLE
PROMPT_ABORTED
INTERACTIVE_UNAVAILABLE
EDITOR_UNAVAILABLE
EDITOR_LAUNCH_FAILED
EDITOR_EXIT_NON_ZERO
EDITOR_TEMP_FILE_CREATE_FAILED
EDITOR_TEMP_FILE_READ_FAILED
SECURE_VIEWER_UNAVAILABLE
SECURE_VIEWER_RENDER_FAILED
LOAD_PROTOCOL_REQUIRED
LOAD_PROTOCOL_UNSUPPORTED
```

Rules:

- `*_MISSING` operand errors are created by CLI argv parsing or guided flow policy.
- core can still reject invalid exact domain values such as `SETUP_NAME_INVALID`, `IDENTITY_STRING_INVALID`, and `PAYLOAD_ENV_INVALID`.
- `PASSPHRASE_CONFIRMATION_MISMATCH` is prompt validation, not a final command failure unless the user cancels.
- `PROMPT_ABORTED` exits 1; Ctrl+C exits 130.

### Varlock-Only Errors

```txt
LOAD_STDOUT_PIPE_UNAVAILABLE
VARLOCK_CLI_START_FAILED
VARLOCK_LOAD_EXIT_NON_ZERO
VARLOCK_NOT_INITIALIZED
VARLOCK_MULTIPLE_INIT_UNSUPPORTED
```

Rules:

- varlock-only errors are adapter failures, not core failures.
- CLI `load` failures still travel through the load protocol response.
- varlock adapter failure details may include launcher, payload path, and exit code when relevant.

## Structured Details Policy

Details-bearing errors:

```txt
*_MISSING:
  command
  missing operand/option name

*_AMBIGUOUS:
  input
  candidates

*_INVALID:
  input when safe
  reason when safe

*_DUPLICATE:
  alias
  conflicting owner id

*_NOT_FOUND:
  path/ref/input

*_CLI_TOO_OLD:
  artifact version
  supported/current version

*_MIGRATION_*:
  from version if known
  to version if known

PAYLOAD_UPDATE_REQUIRED:
  path
  reasons

PAYLOAD_NOT_FOUND:
  expose payload path

PAYLOAD_ALREADY_EXISTS:
  expose payload path

PAYLOAD_READ_FAILED:
  expose payload path
  raw OS cause is diagnostics-only by default

PAYLOAD_WRITE_FAILED:
  expose payload path
  raw OS cause is diagnostics-only by default

PASSPHRASE_UNAVAILABLE:
  required interactive capability

VARLOCK_*:
  launcher
  payload path when relevant
  exit code when relevant
  technical cause when relevant

EDITOR_UNAVAILABLE:
  no editor command by default

EDITOR_LAUNCH_FAILED:
  editor command only if explicit user config or $EDITOR
  raw stderr diagnostics-only by default

EDITOR_EXIT_NON_ZERO:
  exit code
  editor command only if explicit user config or $EDITOR
  raw stderr diagnostics-only by default

EDITOR_TEMP_FILE_CREATE_FAILED:
  no temp file path by default

EDITOR_TEMP_FILE_READ_FAILED:
  no temp file path by default
```

No secret/security details in normal user-facing output:

```txt
PASSPHRASE_INCORRECT
PAYLOAD_DECRYPT_FAILED
PAYLOAD_ACCESS_DENIED
PRIVATE_KEY_DECRYPT_FAILED
```

Rules:

- safe details may be used for rendering and tests.
- secret/security details may be preserved internally only if useful, but not displayed by default.
- raw cryptographic failure text is not stable user-facing UX.

## Message Id Convention

Format:

```txt
ERR.<SCOPE>.<REASON>
WARN.<SCOPE>.<REASON>
INFO.<SCOPE>.<EVENT>
SUCCESS.<SCOPE>.<EVENT>
```

Examples:

```txt
ERR.SETUP.NAME_MISSING
ERR.HOME.STATE_INVALID
ERR.PASSPHRASE.UNAVAILABLE
ERR.PAYLOAD.NOT_FOUND
ERR.PAYLOAD.UPDATE_REQUIRED
ERR.IDENTITY.STRING_INVALID
ERR.IDENTITY.AMBIGUOUS
ERR.GRANT.CANNOT_GRANT_SELF
ERR.REVOKE.CANNOT_REVOKE_SELF
ERR.PROMPT.UNAVAILABLE
ERR.EDITOR.UNAVAILABLE
ERR.VIEWER.UNAVAILABLE
ERR.LOAD.PROTOCOL_REQUIRED
ERR.VARLOCK.CLI_START_FAILED
ERR.INTERNAL.DEFECT
```

Rules:

- prefer domain scope when enough: `PAYLOAD`, `IDENTITY`, `HOME`.
- use command-specific scope only when generic scope loses meaning.
- command-specific accepted examples:
  - `ERR.GRANT.CANNOT_GRANT_SELF`
  - `ERR.REVOKE.CANNOT_REVOKE_SELF`
- message ids are stable semantic branches, not final copy.

## Warning / Info / Success Ids

Warnings:

```txt
WARN.PAYLOAD.UPDATE_RECOMMENDED
WARN.IDENTITY.SELF_RECIPIENT_STALE_AFTER_ROTATE
```

Info:

```txt
INFO.HOME.STATE_MIGRATED
INFO.PAYLOAD.READ_USED_IN_MEMORY_MIGRATION
```

Success ids stay coarse and carry typed outcome params where needed:

```txt
SUCCESS.SETUP.COMPLETE

SUCCESS.PAYLOAD.CREATE
SUCCESS.PAYLOAD.EDIT   { outcome: edited|unchanged }
SUCCESS.PAYLOAD.GRANT  { outcome: added|updated|unchanged }
SUCCESS.PAYLOAD.REVOKE { outcome: removed|unchanged }
SUCCESS.PAYLOAD.UPDATE { outcome: updated|unchanged }

SUCCESS.IDENTITY.IMPORT     { outcome: added|updated|unchanged|alias-updated }
SUCCESS.IDENTITY.FORGET
SUCCESS.IDENTITY.ROTATE
SUCCESS.IDENTITY.PASSPHRASE
```

Rules:

- avoid one success id per minor outcome.
- use outcome params when the UX branch is same command/result family.
- create has no unchanged outcome.
