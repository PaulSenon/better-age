# PRD: CLI IO Stack Realignment

## Problem Statement

The rebuilt Better Age CLI has drifted into custom terminal primitives while trying to recover release-grade interactive UX. This is the wrong direction.

The current implementation uses `@effect/cli` for command grammar, but interactive input/output is split across local readline/raw-mode code, custom select rendering, custom passphrase reading, custom editor orchestration, and direct stdout/stderr writes. That split already caused a visible regression: keyboard menus move the pointer by appending full new frames instead of redrawing in place.

The deeper problem is architectural: the CLI should not maintain low-level prompt rendering, cursor movement, raw mode, prompt cancellation, and terminal cleanup unless the behavior is truly domain-specific. Better Age is an age-wrapper with professional CLI UX, not a terminal UI framework.

Before continuing release UX parity work, the CLI implementation structure needs to align with the best available primitives:

- `@effect/cli` for command grammar, help, and parse errors.
- `@effect/platform/Terminal` for Effect runtime/platform terminal integration where needed.
- `@inquirer/prompts` for normal interactive user IO.
- Small Better Age-specific adapters and policies around those tools.

Breaking implementation changes are acceptable. The goal is the cleanest release-ready codebase and best technical decisions now, not preserving the current adapter shape.

## Solution

Rework the CLI IO layer around a deliberate stack:

- Keep `@effect/cli` as the command grammar/help/parser owner.
- Introduce `@inquirer/prompts` as the default implementation for interactive prompts.
- Keep `@effect/platform/Terminal` for Effect CLI/prompt runtime integration where it naturally fits, without using it as an excuse to hand-roll terminal widgets.
- Preserve the current core CLI flow logic when it remains clean and domain-focused.
- Replace local prompt rendering and low-level menu primitives with a small terminal IO adapter over battle-tested prompt libraries.
- Keep custom terminal code only where Better Age has a real domain-specific need, such as the in-process secure viewer and strict machine-output paths.

The implementation should produce a CLI structure where:

- command parsing is one concern.
- command flow orchestration is one concern.
- human interactive IO is one concern.
- machine output policy is one concern.
- domain/core behavior remains outside terminal concerns.

If the implementation starts fighting the chosen tools, work should stop and the design should be reconsidered before adding more custom workaround code.

## User Stories

1. As a Better Age user, I want interactive prompts to redraw cleanly in place, so that keyboard navigation feels professional.
2. As a Better Age user, I want menus to use battle-tested prompt behavior, so that basic terminal UX does not regress.
3. As a Better Age user, I want Ctrl-C to cancel prompts consistently, so that terminal behavior matches Unix expectations.
4. As a Better Age user, I want cancelled prompts to restore terminal state, so that my terminal is not left broken.
5. As a Better Age user, I want text prompts to feel standard and polished, so that guided mode is pleasant.
6. As a Better Age user, I want password prompts to hide input reliably, so that secret entry is safe.
7. As a Better Age user, I want select prompts to support arrow-key navigation, so that menus are easy to use.
8. As a Better Age user, I want disabled select rows to be visibly unavailable, so that I understand why an option cannot be chosen.
9. As a Better Age user, I want menu prompts, guided payload pickers, guided identity pickers, editor pickers, and update gates to share the same prompt behavior, so that the CLI is consistent.
10. As a Better Age user, I want exact commands like `identity export` to keep raw stdout, so that shell piping remains clean.
11. As a varlock user, I want `load` to keep raw env stdout, so that machine integration remains stable.
12. As a Better Age user, I want human messages to remain on stderr, so that stdout can stay machine-safe where needed.
13. As an interactive user, I want command results inside `bage interactive` to appear immediately, so that actions do not appear silent.
14. As an interactive user, I want important stdout result screens to pause before returning to menus, so that I can read or copy them.
15. As an interactive user, I do not want simple success messages to require extra Enter presses, so that routine operations stay fast.
16. As a maintainer, I want no custom select renderer, so that the codebase does not maintain cursor and redraw logic.
17. As a maintainer, I want no custom readline menu fallback as primary UX, so that release behavior is not a debug harness.
18. As a maintainer, I want one prompt adapter boundary, so that implementation choices can change without rewriting command flows.
19. As a maintainer, I want command flows to express intent such as “select one identity” or “ask for passphrase”, so that flow logic remains readable.
20. As a maintainer, I want the terminal adapter to map library cancellation into one internal cancellation error, so that flows handle abort consistently.
21. As a maintainer, I want prompt library errors normalized, so that presenter and exit-code policy stay centralized.
22. As a maintainer, I want `@effect/cli` help and parse behavior to remain the only command grammar source, so that grammar cannot drift again.
23. As a maintainer, I want `@inquirer/prompts` used for ordinary interactive IO, so that prompt rendering is delegated to a maintained package.
24. As a maintainer, I want `@effect/platform/Terminal` used where Effect requires platform terminal services, so that Effect integration stays idiomatic.
25. As a maintainer, I want custom terminal code limited to Better Age-specific experiences, so that the blast radius stays small.
26. As a maintainer, I want the in-process secure viewer isolated, so that its raw-mode complexity does not leak into normal prompts.
27. As a maintainer, I want editor selection to use shared prompt primitives, so that editor setup does not have bespoke menu behavior.
28. As a maintainer, I want editor launch behavior reviewed against Inquirer’s editor prompt, so that we use standard behavior if it fits.
29. As a maintainer, I want saved editor preference behavior preserved only if it can be implemented cleanly, so that preference UX does not justify messy terminal code.
30. As a maintainer, I want manual QA updated for the new IO stack, so that release testing checks real prompt behavior.
31. As a maintainer, I want tests to verify observable CLI behavior, so that tests do not lock in implementation details.
32. As a maintainer, I want no tests for markdown specs or PRDs, so that documentation remains review material, not fake coverage.
33. As a maintainer, I want prompt adapters tested with fake input/output streams where practical, so that regressions are caught cheaply.
34. As a maintainer, I want hard-to-automate terminal behavior covered by manual QA, so that test complexity stays pragmatic.
35. As a maintainer, I want the release UX parity plan paused until this IO stack is clean, so that later phases build on stable primitives.

## Implementation Decisions

- This PRD supersedes continuing release UX parity hardening until the CLI IO stack is corrected.
- Breaking implementation changes are allowed.
- The CLI should prefer standard prompt libraries over local low-level terminal rendering.
- `@effect/cli` remains the command grammar, help, and parse-error owner.
- `@inquirer/prompts` becomes the default implementation for normal interactive prompts.
- `@effect/platform/Terminal` remains available for Effect runtime/platform integration and should not be treated as a requirement to hand-roll prompt UX.
- The CLI should expose a small IO port to command flow logic.
- Command flow logic should not import `@inquirer/prompts` directly.
- Command flow logic should not import low-level Node terminal primitives directly.
- The Node CLI adapter owns the concrete prompt library choice.
- The adapter should provide at least:
  - text input.
  - hidden/password input.
  - single select.
  - confirm if needed.
  - wait-for-enter / pause.
  - result writer.
  - cancellation normalization.
- `selectOne` should be implemented through `@inquirer/prompts` select or an equivalent standard prompt, not custom raw keypress rendering.
- Text prompts should use `@inquirer/prompts` input unless there is a clear reason not to.
- Passphrase prompts should use `@inquirer/prompts` password unless it fails a Better Age security or UX requirement.
- Editor selection and remember/just-once prompts should use shared select/confirm primitives.
- Inquirer’s editor prompt should be evaluated, but not adopted if it fights the saved-editor preference flow.
- The in-process secure viewer remains custom and isolated because it is a Better Age-specific plaintext viewing experience.
- Machine-output commands must retain explicit stdout/stderr policy and should not route raw output through prompt libraries.
- `load` stdout remains raw env text only.
- Exact `identity export` stdout remains the identity string only.
- Interactive-mode `identity export` may render through immediate result output plus pause policy.
- Prompt cancellation maps to the CLI’s cancellation concept and exit code 130.
- Ctrl-C should not be treated as Back.
- Prompt adapter should use the prompt library’s supported runtime/context options instead of managing raw mode manually where possible.
- If stream/context wiring makes prompt behavior worse, stop and reassess instead of adding local rendering patches.
- The previous custom raw-key select implementation should be deleted, not patched.
- The release UX parity plan should be updated to insert this IO realignment before remaining parity phases.
- Existing core package behavior is out of scope unless needed to support clean CLI contracts.

Major modules to build or modify:

- Node terminal adapter.
- CLI terminal IO port.
- Interactive session result writer / pause policy.
- Editor runtime integration.
- Secret prompt integration.
- Manual QA checklist.
- Release UX parity plan.
- Package dependencies.

## Testing Decisions

- Use TDD for implementation.
- Tests should verify behavior through public CLI/adapter interfaces, not private prompt internals.
- No markdown/spec/PRD tests.
- Keep tests focused on observable contracts:
  - command grammar still produces help through `@effect/cli`.
  - exact machine-output commands keep clean stdout.
  - interactive session writes results immediately.
  - select cancellation maps to exit 130.
  - prompt adapter maps Inquirer cancellation into the CLI cancellation error.
  - text/password/select adapter functions call the expected prompt capability without leaking library-specific errors.
  - editor selection uses shared prompt adapter.
- Use fake streams or mock prompt functions where this verifies adapter behavior without brittle terminal snapshots.
- Avoid testing Inquirer’s own rendering implementation.
- Manual QA remains required for:
  - select redraw in place.
  - keyboard navigation.
  - disabled rows.
  - Ctrl-C cleanup.
  - prompt cancellation exit code.
  - immediate interactive output.
  - stdout cleanliness for `load`.
  - stdout cleanliness for exact `identity export`.
  - editor picker behavior.
  - password prompt hiding.
- Full pseudo-TTY E2E remains optional unless it becomes cheap and stable.
- Required checks remain `pnpm test`, `pnpm check`, and `git diff --check`.

## Out of Scope

- Continuing payload envelope implementation before IO stack cleanup.
- Rewriting the core package.
- Reworking domain contracts unrelated to CLI IO.
- Building a full TUI.
- Maintaining custom select rendering as a parallel implementation.
- Exact transcript parity with the legacy prototype.
- Docker-based interactive E2E as a required gate.
- Adding tests for PRD/spec/plan markdown files.
- Releasing `cli-legacy`.

## Further Notes

The mistake to avoid repeating: “keyboard navigable” is not enough. Release-grade prompt UX also requires redraw, cleanup, cancellation semantics, disabled state rendering, and consistent stream behavior. Those are library concerns.

The correct engineering posture is to make Better Age excellent at Better Age-specific command flow and encryption UX, while delegating terminal prompt mechanics to maintained packages.

Source checks that informed this PRD:

- `@inquirer/prompts` provides `input`, `select`, `password`, `confirm`, `editor`, runtime context options, `clearPromptOnDone`, and abort/cancel support.
- `@effect/cli` provides command grammar/help/parser and also prompt primitives, but if Inquirer is chosen for normal prompts, the implementation should not mix prompt engines casually.
- `@effect/platform/Terminal` provides the Effect platform terminal service required by Effect CLI/prompt runtime.
