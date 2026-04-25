# Notice And Success Spec

Status: active spec. Goal: stable non-error outcomes and side-channel messages.

## Principles

- Core notices are semantic side information returned with successful or failed core responses.
- CLI warnings/info are presentation mappings of semantic notices or CLI-only conditions.
- Success ids describe completed user intent, not low-level implementation steps.
- Idempotent no-op cases are successful outcomes, not warnings and not errors.
- Machine stdout commands must keep stdout clean; notices/warnings go to stderr.

## Core Notices

```txt
HOME_STATE_MIGRATED
PAYLOAD_READ_USED_IN_MEMORY_MIGRATION
PAYLOAD_UPDATE_RECOMMENDED
```

### `HOME_STATE_MIGRATED`

Details:

```txt
fromVersion
toVersion
```

CLI mapping:

```txt
INFO.HOME.STATE_MIGRATED
```

Rules:

- emitted when managed home state auto-migrates.
- safe to show as info.
- does not change command success/failure status.

### `PAYLOAD_READ_USED_IN_MEMORY_MIGRATION`

Details:

```txt
path
fromVersion
toVersion
```

CLI mapping:

```txt
INFO.PAYLOAD.READ_USED_IN_MEMORY_MIGRATION
```

Rules:

- emitted when payload read succeeds through in-memory migration.
- no payload file is persisted.
- can accompany `view`, `inspect`, `load`, and write-gate preflight reads.

### `PAYLOAD_UPDATE_RECOMMENDED`

Details:

```txt
path
reasons:
  payload-format-migration
  self-recipient-refresh
```

CLI mapping:

```txt
WARN.PAYLOAD.UPDATE_RECOMMENDED
```

Rules:

- emitted when payload can be read but should be persisted through `bage update`.
- read commands still succeed.
- write commands use the outdated payload write gate instead of silently mutating.

## CLI-Only Warnings

```txt
WARN.IDENTITY.SELF_RECIPIENT_STALE_AFTER_ROTATE
```

### `WARN.IDENTITY.SELF_RECIPIENT_STALE_AFTER_ROTATE`

Details:

```txt
ownerId
nextFingerprint
```

Rules:

- emitted after `identity rotate`.
- does not inspect or rewrite payloads.
- tells user existing payloads may need `bage update`.

## Success Message Ids

```txt
SUCCESS.SETUP.COMPLETE
SUCCESS.IDENTITY.IMPORT
SUCCESS.IDENTITY.FORGET
SUCCESS.IDENTITY.PASSPHRASE
SUCCESS.IDENTITY.ROTATE
SUCCESS.PAYLOAD.CREATE
SUCCESS.PAYLOAD.EDIT
SUCCESS.PAYLOAD.GRANT
SUCCESS.PAYLOAD.REVOKE
SUCCESS.PAYLOAD.UPDATE
```

No dedicated success message:

```txt
identity export:
  stdout identity string is the success output.

identity list:
  stdout human list output is the success output.

inspect:
  stdout human inspect output is the success output.

view:
  viewer close with exit 0 is the success signal.

load:
  stdout env text is the success output.
```

## Success Outcome Params

```txt
SUCCESS.PAYLOAD.CREATE:
  path
  payloadId

SUCCESS.PAYLOAD.EDIT:
  path
  payloadId
  outcome: edited | unchanged

SUCCESS.PAYLOAD.GRANT:
  path
  payloadId
  recipientOwnerId
  outcome: added | updated | unchanged

SUCCESS.PAYLOAD.REVOKE:
  path
  payloadId
  recipientOwnerId
  outcome: removed | unchanged

SUCCESS.PAYLOAD.UPDATE:
  path
  payloadId
  outcome: updated | unchanged
  rewriteReasons

SUCCESS.IDENTITY.IMPORT:
  ownerId
  handle
  outcome: added | updated | unchanged | alias-updated

SUCCESS.IDENTITY.FORGET:
  ownerId
  outcome: removed

SUCCESS.IDENTITY.PASSPHRASE:
  ownerId

SUCCESS.IDENTITY.ROTATE:
  ownerId
  nextFingerprint

SUCCESS.SETUP.COMPLETE:
  ownerId
  handle
```

## Idempotent Success Cases

```txt
grant already granted same/older:
  SUCCESS.PAYLOAD.GRANT outcome=unchanged

grant already granted but provided snapshot newer:
  SUCCESS.PAYLOAD.GRANT outcome=updated

revoke recipient not granted:
  SUCCESS.PAYLOAD.REVOKE outcome=unchanged

update no reasons:
  SUCCESS.PAYLOAD.UPDATE outcome=unchanged

edit identical:
  SUCCESS.PAYLOAD.EDIT outcome=unchanged

identity import known same/older and alias unchanged:
  SUCCESS.IDENTITY.IMPORT outcome=unchanged

identity import known same/older but alias changed:
  SUCCESS.IDENTITY.IMPORT outcome=alias-updated
```

## Output Channel Rules

Machine stdout commands:

```txt
identity export
load
```

Rules:

- no success text on stdout.
- notices/warnings/errors/prompts go to stderr.
- exit code is the machine success/failure signal.

Human stdout output commands:

```txt
identity list
inspect
```

Rules:

- primary human output goes to stdout.
- warnings/errors go to stderr.

Status-only commands:

```txt
setup
create
edit
grant
revoke
update
identity import
identity forget
identity passphrase
identity rotate
```

Rules:

- no primary stdout output.
- success/status/errors/warnings go to stderr.

