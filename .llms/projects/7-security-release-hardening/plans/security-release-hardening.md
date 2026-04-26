# Plan: Security Release Hardening

> Source PRD: [1-PRD_SECURITY_RELEASE_HARDENING.md](../1-PRD_SECURITY_RELEASE_HARDENING.md)

## Architectural Decisions

- **Identity Trust**: signed Identity V2 is deferred; V1 stays unsigned/TOFU with an explicit key-update trust gate when same owner id changes age recipient.
- **Key Storage**: private keys remain individual age-protected files at stable final paths.
- **Passphrase Transaction**: passphrase changes use bounded backup/restore transaction and mandatory recovery before key reads.
- **Prompt Stack**: Inquirer remains the normal prompt stack; passphrase prompts use no visible mask.
- **Payload Writes**: payload mutation verification is in-memory only; no project-local temp/staging files are introduced.
- **Viewer Safety**: decrypted viewer output is sanitized for display only.
- **Release Discipline**: each phase uses TDD and ends with relevant checks plus full `pnpm test`, `pnpm check`, and `git diff --check`.

---

## Phase 1: Failure Surface And Corrupt Artifacts

**User stories**: 7-9, 27, 28

### What To Build

Make corrupt local state and unknown failures user-readable instead of crashy or generic. Remove deterministic-core drift from fallback randomness.

### Acceptance Criteria

- [x] Corrupt home state returns `HOME_STATE_INVALID` or maps to it at the core/CLI boundary.
- [x] Invalid private key artifacts return `PRIVATE_KEY_INVALID`.
- [x] Unsupported artifact versions return `ARTIFACT_UNSUPPORTED_VERSION`.
- [x] CLI renders those failures without stack traces.
- [x] Unknown failures include useful code/details instead of only generic "command failed".
- [x] Payload id generation requires adapter randomness; no `Date.now()` fallback remains.

---

## Phase 2: Local Secret IO And Permissions

**User stories**: 10-15, 21

### What To Build

Harden passphrase entry and local secret file permissions while keeping the chosen prompt stack.

### Acceptance Criteria

- [x] Inquirer password prompts use no visible mask/length echo.
- [x] Prompt cancellation still maps to `CANCELLED` exit 130.
- [x] New passphrases shorter than 8 characters are rejected.
- [x] Setup and passphrase-change flows apply the new passphrase policy.
- [x] Better Age home directory is created/chmodded `0700`.
- [x] Private key files and key temp files are written/chmodded `0600`.
- [x] Existing loose permissions are auto-repaired with warning/notice when possible.
- [x] Failed permission repair fails closed with a typed user-readable failure.

---

## Phase 3: Passphrase Change Transaction

**User stories**: 1-6

### What To Build

Replace one-by-one key rewriting with the accepted bounded backup/restore transaction over stable individual age key files.

### Acceptance Criteria

- [ ] Passphrase change decrypts all old keys before writing anything.
- [ ] Passphrase change re-encrypts and verifies all new key blobs before moving stable files.
- [ ] Passphrase change writes a transaction marker before replacing stable files.
- [ ] Ordinary write/rename failure rolls back backups and leaves old passphrase usable.
- [ ] Crash-marker recovery runs before future key reads.
- [ ] Recovery restores backups over partial migrated files and removes leftover new files.
- [ ] Successful passphrase change removes backups and marker synchronously.
- [ ] Unrecoverable transaction state returns `KEY_TRANSACTION_INCOMPLETE`.
- [ ] Individual key files remain age-protected and final paths remain stable.

---

## Phase 4: Payload Safety

**User stories**: 22-25

### What To Build

Improve payload mutation and read safety without adding project-local temp/staging files.

### Acceptance Criteria

- [ ] Payload create/edit/grant/revoke/update encrypt next state in memory.
- [ ] Mutations decrypt and parse the encrypted result in memory before final write.
- [ ] Verification failure writes nothing and returns a typed failure.
- [ ] No `.env.enc.tmp`, `.better-age-tmp`, or project-local staging files are introduced.
- [ ] Payload decrypt tries current key before retired keys.
- [ ] Retired keys are tried lazily only when needed.
- [ ] Corrupt/missing retired keys warn but do not cause false `PASSPHRASE_INCORRECT`.
- [ ] If no key decrypts payload, the normal decrypt failure is returned.

---

## Phase 5: V1 Identity Key-Update Trust Gate

**User stories**: 29, 30

### What To Build

Add a small trust gate for unsigned V1 identity updates without starting the signed Identity V2 project.

### Acceptance Criteria

- [ ] Same owner id + unchanged public key imports as today.
- [ ] Same owner id + changed public key fails without explicit trust.
- [ ] Alias-only changes do not require key-update trust.
- [ ] Interactive import shows old/new key fingerprints and asks for confirmation.
- [ ] Exact/headless import requires an explicit trust option.
- [ ] Guided grant custom identity-string path handles the trust gate cleanly or fails with a clear import-first remediation.
- [ ] Signed Identity V2 remains documented as a separate project.

---

## Phase 6: CLI Runtime Edges And Display Safety

**User stories**: 16-20, 26

### What To Build

Harden display/editor/varlock runtime edges that can leak, confuse, or poison later execution.

### Acceptance Criteria

- [ ] Secure viewer escapes ANSI/OSC/control characters visibly.
- [ ] Viewer sanitization is display-only and never mutates payload content.
- [ ] Editor temp dir uses private permissions.
- [ ] Editor temp file uses private permissions and random name.
- [ ] Editor temp file is deleted after editor exit.
- [ ] Docs describe editor swap/backup/plugin residual risk.
- [ ] Varlock failed `bage load` promise is not cached forever.
- [ ] Load protocol docs still state plaintext stdout is intentional and stderr-only for warnings/errors.
- [ ] Varlock custom command docs state trusted-local config for MVP.

---

## Phase 7: Final Security QA And Deferred Work

**User stories**: all

### What To Build

Close the hardening pass with docs, manual QA guidance, backlog cleanup, and full verification.

### Acceptance Criteria

- [ ] Security hardening docs match implemented behavior.
- [ ] Deferred items are persisted in backlog/project docs.
- [ ] Manual QA checklist covers prompt, editor, viewer, passphrase change, and varlock retry behavior.
- [ ] Relevant package tests pass.
- [ ] Full `pnpm test` passes.
- [ ] Full `pnpm check` passes.
- [ ] `git diff --check` passes.
- [ ] Release readiness is not claimed until user QA passes.
