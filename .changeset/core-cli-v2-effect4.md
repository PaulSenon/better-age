---
"@better-age/cli": minor
---

Rebuild Core and CLI on Effect v4 (`effect@4.0.0-rc.117`, bundled). No data migration: existing homes, keys, identity strings, and payloads are read and written unchanged.

User-visible changes:

- Handles for known identities and recipients now show a short `fp_…` fingerprint instead of the full public key (import/grant success lines, key-update trust prompt).
- Local warnings (repaired file permissions, unreadable retired key) are printed as `[WARN]` for every command.
- Ctrl-C in any prompt aborts the command or the whole interactive session with exit code 130; explicit Cancel/Back still returns to the menu. Grant, revoke, and forget pickers gain a Cancel row.
- `create` retries a wrong passphrase like other commands.
- Errors that previously printed `unmapped failure code` now have messages (for example `CANNOT_GRANT_SELF`, `PAYLOAD_ACCESS_DENIED`).
- Help and parse-error wording follow the Effect v4 CLI; `--completions <shell>` is available.
