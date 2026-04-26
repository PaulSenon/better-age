# Grill Me: Release UX Parity Hardening

Status: active grilling log. Append-only.

## 2026-04-26 Kickoff

Problem:

- User QA found release-blocking CLI UX regressions after implementation was previously judged release-ready by static/spec/test audit.
- The issue is mostly end-user CLI/runtime UX parity and polish, not necessarily core architecture.

Reported regressions:

- Menus are not keyboard navigable like expected/prototype behavior.
- Help is custom/manual instead of leaning on real `@effect/cli` command/help behavior.
- Interactive mode buffers command output until session quit, making commands look silent/broken.
- Invalid identity import appears to succeed silently during interactive flow because feedback is delayed.
- Ctrl-C in interactive mode behaves like back/navigation instead of exiting clearly.
- Payload files should likely be readable `.env`-style envelopes with comments/docs plus extractable armored block.
- Guided commands regressed suggested inputs: missing payload paths should suggest `.env*.enc` from cwd; identity operands should offer known/payload/self-aware choices plus typed input where appropriate.

Resolved distinction:

- "Feature parity" means end-user capability/UX parity floor with the legacy prototype.
- It does not mean 1:1 implementation reuse, exact output text, exact flow transcript, or preserving prototype rough edges.
- The target remains better structure and better polish than the prototype.

Working invariant candidate:

- New CLI should not regress any useful end-user capability from `cli-legacy` unless the regression is explicitly documented as deprecated or intentionally changed in the parity matrix.

## 2026-04-26 Parity Matrix Taxonomy

Decision:

- Use a parity matrix to classify every legacy end-user UX behavior.

Statuses:

- `keep`: preserve or improve for MVP.
- `change`: same user goal remains required, but better flow/output is accepted.
- `drop`: intentionally removed from MVP.
- `defer`: valuable, but post-MVP.
- `unknown`: needs QA/spec decision.

Rule:

- No useful end-user legacy behavior may silently disappear. It must be classified.

## 2026-04-26 Keyboard Navigation

Decision:

- MVP interactive menus must use real keyboard navigation everywhere a choice list appears.

Applies to:

- `bage interactive` menus.
- Guided payload picker.
- Guided identity picker.
- Editor picker.
- Update-required choice.
- Any remaining retry/error-action menu.

Implementation direction:

- Use one terminal select adapter everywhere.
- Prefer `@effect/cli/Prompt.select` or an equivalent keyboard-navigable adapter.
- The current numbered readline `selectOne` is not acceptable as primary release UX.

## 2026-04-26 Interactive Feedback And Pause Policy

Decision:

- `bage interactive` must show each launched command result immediately.
- The session must not buffer command stdout/stderr until quit.

Pause policy:

- Exact direct command invocation prints output and terminates normally.
- Guided interactive/session invocation may pause after human-readable result screens when immediate menu redraw would hide the result.
- Example: `identity export` from interactive session shows the identity string, waits for Enter, then returns to menu.
- Simple success/status messages such as identity import success do not need a blocking pause; they can remain visible while the menu returns.

Implementation direction:

- Interactive session should write command result channels to terminal at command completion.
- Add a command-result classification or flow hint for "pause after displaying primary result".

## 2026-04-26 Ctrl-C Policy

Decision:

- Ctrl-C anywhere in the interactive CLI aborts immediately.
- It exits the current command or session with exit code 130.
- It must not behave like Back.
- It must not delay or buffer output.
- It must restore terminal state before exit.

Rules:

- Back is an explicit menu choice.
- Escape can be considered later, but is not Ctrl-C.

## 2026-04-26 Guided Payload Path UX

Decision:

- Any interactive existing-payload picker discovers `.env.enc` and `.env.*.enc` files in the current working directory.

Existing payload picker:

```txt
0 found:
  prompt for path

1 found:
  keyboard select menu
  file is preselected
  also show "Enter path"
  also show Cancel

N found:
  keyboard select menu
  list all found files
  also show "Enter path"
  also show Cancel
```

File creation flow:

```txt
prompt file name
default/suggestion: .env.enc
empty input uses .env.enc

if path collides:
  show "file already exists"
  keyboard select:
    Override
    Change name
    Cancel
```

Notes:

- Existing payload selection and new payload creation are separate UX policies.
- Creation collision is not an automatic failure in interactive mode; user chooses override/change/cancel.

## 2026-04-26 Guided Identity Picker UX

Decision:

- Guided identity pickers merge all relevant identity sources and overlay local aliases.

Grant picker sources:

- Self identity.
- Known local identities.
- Payload recipients from the decrypted payload.
- Local alias mapping for any owner id.

Grant picker rendering/behavior:

- Render all relevant identities in one keyboard select list.
- Self is disabled with contextual tag `[you]`.
- Already granted payload recipients are disabled with contextual tag `[granted]`.
- Known local identities not yet granted are selectable.
- Payload recipients that are not locally known still render normally from embedded payload identity data; they are just already granted.
- Include `Enter identity string` option.
- Entering a new identity string triggers the identity import flow, then uses it for grant.
- Include Cancel.

Compact identity rendering:

```txt
[<alias>] [(<displayName>)] <handle> <tag?>
```

Rules:

- Do not render full public keys in normal lists/pickers; too noisy.
- Tags are contextual, e.g. `[you]`, `[granted]`.
- Alias overlays display name when present, but display name can still be shown compactly in parentheses.

Revoke picker:

- Missing revoke identity opens a picker over payload recipients only.
- Self recipient is disabled with `[you]`.
- Other granted recipients are selectable.
- Alias overlay applies when the owner id is known locally.
- No `Enter identity string` for revoke in MVP.
- Include Cancel.

## 2026-04-26 Guided Invalid Input Policy

Decision:

```txt
exact mode invalid input:
  print error
  exit non-zero

guided interactive invalid input:
  show error immediately
  stay in the relevant flow
  let user retry/edit/cancel
```

Cases:

- Invalid identity string during import: show error, reprompt identity string or cancel.
- Duplicate alias: show error, reprompt alias or skip/cancel.
- Invalid create path/collision: show error/action menu with enter another name, override, cancel.

Rules:

- Guided mode must not silently accept invalid input.
- Guided mode must not hide failure until interactive session exit.

## 2026-04-26 Payload File Envelope

Decision:

- Persisted encrypted payload files use a human-readable better-age envelope.
- The outer envelope is app-specific.
- The inner payload remains the untouched age armored encrypted file for transparency and auditability.

Target file shape:

```txt
# better-age encrypted env payload
# Docs: ...
# This file is safe to commit only if your policy allows encrypted secrets.
# Do not edit the armored block manually.

-----BEGIN BETTER AGE PAYLOAD-----
-----BEGIN AGE ENCRYPTED FILE-----
<encrypted bytes>
-----END AGE ENCRYPTED FILE-----
-----END BETTER AGE PAYLOAD-----
```

Parser rules:

- Ignore comments and blank lines outside the better-age block.
- Extract exactly one `BETTER AGE PAYLOAD` block.
- Preserve the inner age armor bytes exactly for decryption.
- Fail if the block is missing, duplicated, malformed, or contains non-age-armored content.
- `load` decrypts only the extracted inner age armored payload.

Rationale:

- Users can open the file and understand what it is.
- The payload remains transparently age-based.
- External audit/manual extraction remains simple.

## 2026-04-26 Effect CLI Grammar And Help

Decision:

- Release CLI grammar/help/parser must use real `@effect/cli` behavior.
- The current hand-rolled help/parser is a release blocker.

Rules:

- `bage --help`, `bage <cmd> --help`, and parse errors are owned by `@effect/cli`.
- Guided operands remain optional in grammar where command flows can prompt.
- Protocol flags remain strict, especially `load --protocol-version=1`.
- Avoid duplicated custom command tree/help unless it is thin adapter glue required by `@effect/cli`.

Rationale:

- Do not rebuild battle-tested parser/help behavior.
- Reduces entropy and drift between spec, help, and parsing.

## 2026-04-26 QA Gate

Decision:

- Manual QA is the primary E2E gate for release-facing terminal UX for now.
- Pseudo-TTY tests are allowed only where trivial and low-maintenance.

Required release gate:

- Unit and contract tests stay required.
- Parity matrix checklist is required.
- Manual QA checklist must cover interactive keyboard navigation, Ctrl-C abort, immediate output feedback, guided suggestions, editor, viewer, payload envelope, and machine stdout.

Rationale:

- Terminal E2E automation was previously costly.
- Current failure mode proves static tests alone are insufficient, so manual QA must become explicit and exhaustive.

## 2026-04-26 Release Blocker Scope

Decision:

- Release blocker scope is end-user CLI UX parity and polish.
- Core architecture should stay untouched unless needed to support UX requirements.

Core changes allowed only when required for:

- Payload file envelope.
- Identity picker data and alias access.
- Import flow correctness.
- Parser/help integration contracts.

Focus:

- CLI runtime.
- Guided flows.
- Interactive session behavior.
- Documentation.
- Manual QA.
