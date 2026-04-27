# Plan: Release UX Parity Hardening

> Source PRD: [13-PRD_RELEASE_UX_PARITY_HARDENING.md](../13-PRD_RELEASE_UX_PARITY_HARDENING.md)

## Architectural Decisions

Durable decisions that apply across all phases:

- **UX Parity Floor**: preserve useful end-user legacy prototype capabilities unless explicitly classified as changed, dropped, or deferred.
- **Parity Matrix**: every legacy/QA-discovered user-visible behavior must be classified as `keep`, `change`, `drop`, `defer`, or `unknown`.
- **Command Grammar**: real `@effect/cli` owns command/help/parser behavior; custom parser/help is release-blocking entropy.
- **CLI IO Stack**: normal interactive IO is owned by the Inquirer-backed prompt adapter; custom terminal rendering is release-blocking except for the isolated secure viewer and strict output writers.
- **Interactive Feedback**: interactive session command results are displayed immediately; only primary result screens pause before menu return.
- **Abort Signal**: Ctrl-C aborts immediately, exits 130, restores terminal state, and is never Back.
- **Payload File Envelope**: encrypted payload files use an outer `BETTER AGE PAYLOAD` envelope wrapping untouched inner age armor.
- **Guided UX**: payload and identity guided flows are first-class UX, not fallback text prompts.
- **Testing**: code tests cover runtime behavior; exhaustive manual QA covers release terminal UX; pseudo-TTY tests are optional only when cheap.
- **Scope**: focus on release-facing CLI UX; core changes only when required by payload envelope, identity data, or parser contracts.

---

## Phase 1: Parity Matrix And QA Gate

**User stories**: 1-3, 62-70

### What To Build

Create the release UX parity matrix and make it part of the release QA contract. Upgrade manual QA so release readiness cannot be claimed from static tests alone.

### Acceptance Criteria

- [x] A parity matrix exists for release UX hardening.
- [x] The matrix documents `keep`, `change`, `drop`, `defer`, and `unknown` statuses.
- [x] Useful legacy/QA-discovered end-user behaviors are classified.
- [x] Manual QA explicitly covers keyboard navigation, Ctrl-C abort, immediate interactive feedback, guided suggestions, editor, viewer, payload envelope, and machine stdout.
- [x] Docs state release is blocked until the parity matrix is complete and manual QA passes.
- [x] No code test pretends markdown/spec text proves UX correctness.

---

## Phase 2: Real Effect CLI Grammar

**User stories**: 56-61

### What To Build

Replace hand-rolled command/help/parser behavior with real `@effect/cli` ownership while preserving guided operands and strict protocol flags.

### Acceptance Criteria

- [x] `bage --help` is produced by the `@effect/cli` command tree.
- [x] Command help is produced by `@effect/cli`.
- [x] Parse errors are owned by `@effect/cli` and mapped through the presenter.
- [x] Promptable operands remain compatible with guided flows.
- [x] `load --protocol-version=1` remains strict and fails before prompts when missing or invalid.
- [x] No duplicated custom command tree remains except thin adapter glue.

---

## Phase 3: Interactive Runtime Spine

**User stories**: 4-18

### What To Build

Fix the shared interactive runtime so every menu/picker is keyboard navigable, Ctrl-C aborts, command results display immediately, and result screens can pause before returning to menus.

### Acceptance Criteria

- [x] Interactive menus use keyboard navigation.
- [x] Guided choice lists use the same keyboard select adapter.
- [x] Editor picker and update-required choices use keyboard navigation.
- [x] Numbered readline selection is not the primary release UX.
- [x] Interactive command output appears immediately after each command.
- [x] Primary result screens can wait for Enter before returning to a menu.
- [x] Simple success/status messages do not require a blocking pause.
- [x] Ctrl-C aborts with exit code 130 and restores terminal state.
- [x] Ctrl-C is never treated as Back.

---

## Interlude: CLI IO Stack Realignment

Before Phase 4, complete [cli-io-stack-realignment.md](./cli-io-stack-realignment.md). Phase 3 proved that keyboard navigation alone is not enough: release behavior also needs maintained prompt rendering, redraw-in-place, cleanup, cancellation, disabled choices, and clean stream routing. The accepted implementation is `@effect/cli` for grammar/help and `@inquirer/prompts` behind the CLI IO port for normal prompts.

---

## Phase 4: Payload File Envelope

**User stories**: 49-55

### What To Build

Persist encrypted payloads in a readable Better Age file envelope while keeping the inner encrypted content as untouched age armor.

### Acceptance Criteria

- [x] Newly written payload files include explanatory comments.
- [x] Newly written payload files contain exactly one `BETTER AGE PAYLOAD` block.
- [x] The inner encrypted payload remains age-armored content.
- [x] Payload reads extract and decrypt only the inner age armor.
- [x] Missing, duplicated, malformed, or non-age-armored blocks fail clearly.
- [x] `load` remains machine-stdout safe with the envelope format.

---

## Phase 5: Guided Payload UX

**User stories**: 19-27, 46

### What To Build

Restore polished guided payload path behavior for existing payload commands and creation flows.

### Acceptance Criteria

- [x] Missing existing payload paths discover `.env.enc` and `.env.*.enc` files in the current directory.
- [x] Zero discovered payloads prompt for a custom path.
- [x] One discovered payload opens a keyboard menu with the file preselected, Enter Path, and Cancel.
- [x] Many discovered payloads open a keyboard menu listing all files plus Enter Path and Cancel.
- [x] Payload creation suggests `.env.enc` by default.
- [x] Empty create path input resolves to `.env.enc`.
- [x] Create collisions show Override, Change Name, and Cancel.
- [x] Guided create path/collision errors are visible and recoverable.

---

## Phase 6: Guided Identity UX

**User stories**: 28-48

### What To Build

Restore polished guided identity behavior for grant, revoke, import, alias handling, and identity rendering.

### Acceptance Criteria

- [x] Grant picker merges self, known identities, payload recipients, and aliases.
- [x] Grant picker disables self with `[you]`.
- [x] Grant picker disables already granted recipients with `[granted]`.
- [x] Grant picker allows entering a new identity string.
- [x] New identity string grant path triggers import before grant.
- [x] Revoke picker lists only actual payload recipients.
- [x] Revoke picker disables self with `[you]`.
- [x] Revoke picker does not offer arbitrary identity string entry.
- [x] Identity rows use compact rendering without full public keys.
- [x] Invalid guided identity strings show immediate retry/cancel feedback.
- [x] Duplicate aliases show immediate reprompt/skip/cancel feedback.
- [x] Exact invalid identity input exits non-zero with a visible error.

---

## Phase 7: Release Docs And Final QA

**User stories**: 62-70

### What To Build

Update release-facing docs to match the hardened UX, run the manual QA checklist, and make the final release-readiness call.

### Acceptance Criteria

- [x] CLI docs describe actual parser/help, guided payload UX, guided identity UX, payload envelope, and machine stdout policy.
- [x] Manual QA checklist is executable against the built CLI.
- [x] Manual QA result is recorded in the project docs or release notes.
- [x] `pnpm test` passes.
- [x] `pnpm check` passes.
- [x] `git diff --check` passes.
- [x] Remaining deferred items are explicitly listed as non-blockers.
- [x] Release readiness is not claimed until manual QA passes.
