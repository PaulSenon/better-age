# @better-age/cli

New CLI package for the Better Age MVP reimplementation.

Responsibilities:

- target `bage` command surface
- exact/guided command execution
- interactive/headless terminal policy
- prompt, editor, viewer, and picker flows
- presenter-driven human output
- clean machine stdout for `load` and `identity export`

Command surface:

```txt
bage create <payload>
bage edit <payload>
bage grant <payload> <identity-ref>
bage inspect <payload>
bage load --protocol-version=1 <payload>
bage revoke <payload> <identity-ref>
bage update <payload>
bage view <payload>

bage identity export
bage identity forget <identity-ref>
bage identity import <identity-string> [--alias <alias>]
bage identity list
bage identity passphrase
bage identity pass
bage identity pw
bage identity rotate

bage setup [--name <display-name>]
bage interactive
bage i
```

Machine-output commands:

- `bage load --protocol-version=1 <payload>` writes raw `.env` text to stdout only.
- `bage identity export` writes the identity string to stdout only.
- prompts, warnings, errors, and human success messages go to stderr.

MVP notes:

- passphrases are prompted only in interactive terminals.
- headless payload reads fail fast because MVP has no passphrase injection mechanism.
- `edit` and `view` depend on terminal adapters; unavailable adapters return explicit errors.

Implementation plan source:

- `../../.llms/projects/4-cli-core-boundary-hardening/plans/better-age-mvp-reimplementation.md`
