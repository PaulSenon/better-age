# Plan: CLI IO Stack Realignment

> Source PRD: `.llms/projects/4-cli-core-boundary-hardening/15-PRD_CLI_IO_STACK_REALIGNMENT.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Command grammar**: `@effect/cli` remains the only command grammar, help, and parse-error owner.
- **Interactive prompts**: `@inquirer/prompts` is the default implementation for normal human interactive IO.
- **Effect terminal integration**: `@effect/platform/Terminal` remains for Effect runtime/platform integration where needed; it is not a reason to hand-roll prompt widgets.
- **Prompt boundary**: command flow logic talks to a small CLI IO port and does not import prompt libraries or Node terminal primitives.
- **Machine output**: `load` and exact `identity export` keep strict raw stdout behavior.
- **Human output**: human status/errors remain on stderr.
- **Custom terminal code**: allowed only for Better Age-specific behavior, mainly the in-process secure viewer and final stdout/stderr writers.
- **Abort semantics**: prompt cancellation and Ctrl-C normalize to the CLI cancellation concept and exit code `130`.
- **Release sequencing**: remaining release UX parity phases stay blocked until this IO stack realignment is complete.
- **Tests**: no markdown/spec/PRD tests; test observable behavior and adapter contracts only.

---

## Phase 1: Prompt Boundary And Dependency Spine

**User stories**: 16-25, 31-35

### What to build

Create the clean IO boundary that the rest of the CLI will use, add the prompt dependency, and make the Node CLI adapter own concrete prompt implementation choices. This phase should not yet chase every UX flow; it should establish the shape that prevents future prompt/rendering drift.

### Acceptance criteria

- [x] `@inquirer/prompts` is an explicit CLI dependency.
- [x] Command flow code depends only on the CLI IO port, not on Inquirer or low-level Node terminal APIs.
- [x] The Node adapter owns prompt implementation wiring.
- [x] Prompt cancellation has one normalized internal representation.
- [x] Existing exact `load` and `identity export` stdout contracts still pass.
- [x] Custom raw-key select code is marked for deletion or deleted if fully replaced in this slice.
- [x] Package tests/checks pass.

---

## Phase 2: Inquirer Select As The Only Normal Picker

**User stories**: 1-4, 7-9, 16-18, 20-21, 23

### What to build

Replace the custom raw-key select implementation with a thin adapter around Inquirer select. All existing menu/picker callers should continue using the same CLI IO port, but the concrete behavior should now be owned by Inquirer.

### Acceptance criteria

- [x] Interactive menus use the Inquirer-backed select adapter.
- [x] Guided payload/identity pickers use the same select adapter.
- [x] Editor picker and update-required choices use the same select adapter.
- [x] Disabled rows are passed to the prompt adapter as disabled choices.
- [x] Ctrl-C / prompt close maps to CLI cancellation and exit code `130`.
- [x] The local custom select renderer and raw keypress loop are removed.
- [x] Tests verify adapter cancellation/choice mapping without snapshotting Inquirer internals.
- [x] Manual QA checklist includes redraw-in-place verification.
- [x] Package tests/checks pass.

---

## Phase 3: Inquirer Text, Password, And Pause Prompts

**User stories**: 3-6, 13-15, 18-21

### What to build

Move normal text input, hidden passphrase input, and wait-for-enter pauses onto the same prompt adapter. Keep command flow semantics unchanged: exact/headless behavior stays strict, guided/interactive behavior prompts through the adapter.

### Acceptance criteria

- [x] Guided text prompts use Inquirer input through the CLI IO port.
- [x] Passphrase prompts use Inquirer password unless a documented blocker is found.
- [x] Wait-for-enter pauses use a shared prompt adapter primitive.
- [x] Prompt cancellation from input/password/pause maps to exit code `130`.
- [x] Interactive command output still flushes immediately.
- [x] Primary stdout result screens still pause before menu redraw.
- [x] Simple success/status messages still do not pause.
- [x] `load` stdout remains raw env text only.
- [x] Exact `identity export` stdout remains raw identity string only.
- [x] Package tests/checks pass.

---

## Phase 4: Editor Flow Realignment

**User stories**: 9, 27-29

### What to build

Clean the editor flow so editor choice, remember/just-once decision, and missing editor recovery use the shared prompt adapter. Evaluate Inquirer’s editor prompt, but only adopt it if it fits Better Age’s saved editor preference behavior without fighting the tool.

### Acceptance criteria

- [x] Editor picker uses the shared Inquirer-backed select adapter.
- [x] Remember/just-once decision uses a shared prompt primitive.
- [x] Saved editor preference behavior remains clean and testable.
- [x] `$VISUAL` / `$EDITOR` override behavior remains explicit.
- [x] Missing saved editor falls back to picker without custom menu code.
- [x] If Inquirer editor is not adopted, the reason is documented in memory or plan notes.
- [x] Package tests/checks pass.

Plan note: Inquirer's `editor` prompt is not adopted for MVP because Better Age needs explicit editor command discovery plus saved editor preference behavior. The current editor launcher remains a small isolated adapter over the chosen editor command.

---

## Phase 5: Secure Viewer And Machine Output Isolation

**User stories**: 10-12, 25-26

### What to build

Make the boundary between normal prompts, secure viewer, and machine output explicit. The secure viewer can remain custom because it is domain-specific, but its raw-mode code must stay isolated and not be reused for normal prompt behavior.

### Acceptance criteria

- [x] Secure viewer remains isolated from normal prompt adapter code.
- [x] Normal select/text/password prompts do not share secure viewer raw-mode code.
- [x] `load` remains machine-stdout safe.
- [x] Exact `identity export` remains machine-stdout safe.
- [x] Interactive `identity export` still shows immediately and pauses before menu redraw.
- [x] Human statuses/errors remain on stderr.
- [x] Package tests/checks pass.

---

## Phase 6: Release Plan Rebase And Cleanup

**User stories**: 30-35

### What to build

Rebase the release UX parity plan so this IO realignment is the required prerequisite before payload envelope and guided UX phases continue. Clean up docs/manual QA to reflect the new prompt stack and remove stale custom-rendering assumptions.

### Acceptance criteria

- [x] Release UX parity plan states IO realignment is complete before Phase 4 continues.
- [x] Manual QA covers Inquirer-backed redraw-in-place, keyboard navigation, disabled rows, Ctrl-C, prompt cancellation, password hiding, immediate output, and raw stdout.
- [x] No markdown/spec/PRD tests are added.
- [x] Stale notes implying custom select rendering is acceptable are removed.
- [x] Short-term memory records the corrected stack and next phase.
- [x] Full `pnpm test` passes.
- [x] Full `pnpm check` passes.
- [x] `git diff --check` passes.
