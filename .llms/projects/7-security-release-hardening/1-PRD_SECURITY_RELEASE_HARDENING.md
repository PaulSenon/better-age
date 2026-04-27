# PRD: Security Release Hardening

## Problem Statement

Better Age has a rebuilt core/CLI architecture and improved terminal UX, but the security review found release blockers in local key safety, corrupt-state handling, prompt behavior, terminal rendering, and small runtime edges.

The main user risk is not missing features. The risk is that a normal user action, such as changing the identity passphrase, can leave local private keys in a mixed or unrecoverable state. Other failures can crash the CLI, leak passphrase length, expose encrypted key blobs to unnecessary filesystem access, or let decrypted payload text control the terminal.

This pass must harden release-facing behavior without starting the larger signed Identity V2 project.

## Solution

Implement a focused security hardening pass across core, CLI, and varlock.

The release must:

- make passphrase changes practically all-or-nothing while preserving individual age-protected key files and stable final key paths.
- recover or fail closed if an unfinished key transaction is detected.
- expose corrupt local artifacts as typed, user-readable failures.
- keep using Inquirer prompts while disabling visible password masks.
- enforce strict filesystem permissions for Better Age home and encrypted key files.
- render decrypted viewer text without interpreting terminal control sequences.
- harden editor plaintext temp files as much as possible for external editors.
- reject empty and too-short new passphrases.
- verify payload mutations in memory before writing final encrypted payloads.
- avoid false `PASSPHRASE_INCORRECT` failures caused by corrupt retired keys.
- avoid caching failed varlock loads.
- keep unsigned V1 identities, but add an explicit key-update trust gate if it fits cleanly.

## User Stories

1. As a user changing my identity passphrase, I want the operation to either complete for every local key or recover safely, so that I am not locked out by a mixed keyset.
2. As a user, I want my individual private keys to remain age-protected files, so that Better Age stays transparent and age-compatible.
3. As a user, I want the primary key paths to remain stable, so that local state stays understandable.
4. As a user, I do not want hidden generation directories or deferred garbage collection, so that local key storage is explicit.
5. As a user, I want an interrupted passphrase change to rollback before future key reads, so that later commands do not use mixed state.
6. As a user, I want unrecoverable key transaction failures to fail closed with clear remediation, so that I know manual inspection is needed.
7. As a user with corrupt home state, I want a stable error instead of a CLI crash, so that I can recover intentionally.
8. As a user with an unsupported artifact version, I want a clear upgrade/migration error, so that I do not misinterpret corruption.
9. As a user with an invalid private key artifact, I want a precise error, so that I know local key material is the problem.
10. As a user typing a passphrase, I do not want the terminal to reveal passphrase length, so that session recording leaks less information.
11. As a user, I want Better Age to use the prompt library we chose instead of custom secret input, so that prompt behavior stays maintained.
12. As a user, I want my Better Age home directory to be private, so that encrypted key blobs are not casually exposed.
13. As a user, I want encrypted key files written with strict permissions, so that offline passphrase attack material is protected.
14. As a user, I want Better Age to repair loose local permissions when possible, so that common local drift does not force manual work.
15. As a user, I want permission repair failures to stop safely, so that secret state is not used under unsafe conditions.
16. As a user viewing decrypted payloads, I want terminal control characters shown as text, so that malicious payloads cannot manipulate my terminal.
17. As a user, I want viewer sanitization to affect display only, so that my payload content is not changed.
18. As a user editing a payload, I want the plaintext editor temp file to use a private temp dir and file mode, so that unavoidable plaintext exposure is reduced.
19. As a user, I want the editor temp file deleted after edit, so that plaintext does not remain intentionally.
20. As a user, I want docs to be honest about editor swap/backup/plugin risk, so that I can choose my workflow knowingly.
21. As a user creating or changing a passphrase, I want empty or very short passphrases rejected, so that accidental weak local protection is avoided.
22. As a user mutating a payload, I want Better Age to verify the encrypted result can decrypt and parse before writing, so that crypto or serialization bugs do not overwrite the last good payload.
23. As a user, I do not want Better Age to create payload temp files in my project directory, so that my workspace stays clean.
24. As a user reading a payload, I want the current key tried first, so that common reads are fast and robust.
25. As a user with one corrupt retired key, I do not want current payload reads to fail with a misleading wrong-passphrase error.
26. As a varlock user, I want a transient failed `bage load` to be retryable, so that one bad prompt or cancellation does not poison the process forever.
27. As a CLI user, I want unknown or new failure codes to show useful code/details, so that security errors are not hidden behind "command failed".
28. As a maintainer, I want core randomness to be adapter-driven, so that core remains deterministic and testable.
29. As a user importing a V1 identity update with the same owner id but a changed age recipient, I want explicit trust required, so that unsigned V1 updates are not silently accepted.
30. As a maintainer, I want signed Identity V2 tracked separately, so that this hardening pass does not become a trust-model rewrite.

## Implementation Decisions

- Signed Identity V2 is out of scope for this pass.
- V1 identities remain unsigned / TOFU for MVP.
- A V1 identity key-update trust gate is in scope only because it fits the current import architecture cleanly.
- A key update means same `ownerId` but changed age recipient/public key.
- Display-name, timestamp, and alias-only changes do not require the key-update trust gate.
- Interactive identity import may prompt to trust the changed key and retry explicitly.
- Exact/headless import must fail unless an explicit trust option is provided.
- Exact grant with a pasted identity string should also honor the trust option if wired cleanly; otherwise users can import first, then grant.
- Passphrase change uses a bounded backup/restore transaction over individual key files.
- Passphrase change prepares and verifies all new encrypted blobs before moving stable files.
- Passphrase transaction recovery runs before any future key read.
- Transaction recovery restores backups over partially migrated stable files, removes leftover new files, and removes the marker after successful rollback.
- If transaction recovery cannot complete safely, core returns `KEY_TRANSACTION_INCOMPLETE`.
- Core exposes typed failures for `HOME_STATE_INVALID`, `PRIVATE_KEY_INVALID`, `ARTIFACT_UNSUPPORTED_VERSION`, and `KEY_TRANSACTION_INCOMPLETE`.
- CLI maps these failures to stable user-readable messages without stack traces.
- Inquirer remains the prompt primitive for passphrases.
- Passphrase prompts use transparent/no-mask mode (`mask: false`), not custom secret input.
- Better Age home directory is created/chmodded `0700`.
- Private key files and key temp files are written/chmodded `0600`.
- Existing loose home/key permissions are auto-repaired with warning/notice when possible.
- If permission repair fails, core fails closed.
- Secure viewer escapes ANSI/OSC/control characters visibly during rendering.
- Viewer sanitization is display-only.
- Editor temp hardening for MVP is limited to private temp dir, private temp file, random temp name, cleanup, and docs.
- Strict editor flags, in-process editor, and encrypted editor temp files are deferred.
- New passphrases must be at least 8 characters and non-empty.
- Payload mutation verification is in-memory only.
- Payload mutation does not introduce `.env.enc.tmp`, `.better-age-tmp`, or other project-local staging files.
- Payload replacement is not claimed to be crash-atomic for MVP.
- Payload decrypt tries current key first, then retired keys lazily.
- Corrupt retired keys produce warnings/notices, not false passphrase failures.
- Varlock memoizes successful load only, or clears cached promise on rejection.
- Varlock custom shell command remains trusted-local config for MVP and is documented as such.
- `Date.now()` fallback inside core is removed; payload ids come from required adapter randomness.
- Branded domain ids and core/node export split are deferred unless naturally touched.

## Testing Decisions

- Use TDD for implementation.
- Tests should focus on observable behavior and core/CLI contracts.
- Core tests cover passphrase transaction success, ordinary failure rollback, crash-marker recovery, unrecoverable recovery failure, corrupt artifact failures, permission repair behavior, payload verification, and lazy retired-key decrypt.
- CLI tests cover prompt mask config, corrupt artifact presentation, passphrase policy retry/fail behavior, identity key-update trust prompt/flag behavior, viewer sanitization output, and failure fallback behavior.
- Varlock tests cover retry after rejected load promise.
- Adapter/integration tests cover real key file permissions and age-backed key behavior where practical.
- Manual QA remains required for real terminal editor/viewer/prompt behavior.
- Specs, PRDs, plans, and manual QA docs are review artifacts, not code-test targets.
- After each implementation phase, run the relevant package tests/checks, then full `pnpm test`, `pnpm check`, and `git diff --check` before declaring done.

## Out of Scope

- Full signed Identity V2.
- Owner id derivation changes.
- Public identity string V2.
- Migration from unsigned V1 to signed V2.
- Keyring wrapper artifact.
- Generation directory key storage and deferred garbage collection.
- Payload atomic replacement using project-local staging files.
- Strict editor mode flags.
- In-process editor.
- Headless passphrase injection.
- Docker/pseudo-TTY E2E as required scope.
- Broad branded-type refactor.
- Core public export-path split unless trivial.
- Structured varlock `command + args` launcher.

## Further Notes

This PRD intentionally changes the audit recommendation for passphrase changes. The audit suggested generation directories and later garbage collection. The accepted product constraints are stable key paths, individual age-protected key files, no keyring wrapper, and no deferred trash. The resulting design is a bounded transaction/recovery protocol rather than a home-state pointer swap.

This PRD also intentionally limits payload write hardening. The accepted product constraint is no payload temp/staging files in the user project. Therefore this pass adds in-memory verification before final write, but does not claim portable atomic payload replacement.
