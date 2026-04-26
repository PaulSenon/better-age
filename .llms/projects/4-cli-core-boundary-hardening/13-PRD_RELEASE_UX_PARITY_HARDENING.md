# PRD: Release UX Parity Hardening

## Problem Statement

The rebuilt Better Age CLI has a cleaner core/CLI/package structure, but user QA found release-blocking regressions in the end-user terminal experience compared with the legacy prototype.

The problem is not primarily the core domain model. The problem is that the release-facing CLI no longer meets the intended MVP quality bar:

- interactive menus are not keyboard navigable.
- interactive command output is buffered until quit, making commands appear broken.
- invalid guided inputs can appear to silently succeed.
- Ctrl-C behaves like navigation instead of abort.
- guided payload and identity suggestions regressed.
- help/parser behavior is hand-rolled instead of relying on `@effect/cli`.
- payload files are opaque instead of user-readable encrypted `.env`-style envelopes.

The MVP goal was not merely "new structure". The goal was a simple, elegant, professional CLI with at least the useful end-user capability floor of the legacy prototype, improved polish, and maintainable internals.

## Solution

Harden the new CLI until it satisfies the **UX Parity Floor**: every useful end-user behavior from the legacy prototype must be preserved or intentionally classified as changed, dropped, or deferred.

This PRD does not require a 1:1 clone of the legacy prototype. Exact output text, exact transcript shape, and internal implementation parity are not required. The target is better UX over the new architecture.

The release-ready CLI should:

- use real `@effect/cli` grammar/help/parser behavior.
- use keyboard-navigable select prompts for all interactive choices.
- show command output immediately in `bage interactive`.
- pause only after primary result screens where immediate menu redraw would hide useful output.
- treat Ctrl-C as an abort signal everywhere.
- restore guided payload path discovery and creation flows.
- restore guided identity pickers with compact identity rendering and alias overlays.
- make guided invalid input visibly recoverable.
- persist encrypted payload files in a readable Better Age outer envelope wrapping untouched age armor.
- make manual QA the explicit release gate for real terminal UX.

Core architecture should remain stable unless a UX requirement needs a core/storage contract change.

## User Stories

1. As a user, I want the rebuilt CLI to preserve useful legacy prototype UX capabilities, so that the clean rewrite does not feel like a regression.
2. As a maintainer, I want a parity matrix for legacy end-user behaviors, so that regressions are explicit instead of accidental.
3. As a maintainer, I want each parity item classified as keep, change, drop, defer, or unknown, so that planning stays concrete.
4. As a user, I want interactive menus to be keyboard navigable, so that the CLI feels smooth and professional.
5. As a user, I want the main interactive session to use the same keyboard select behavior as guided command pickers, so that interaction is consistent.
6. As a user, I want the editor picker to use keyboard navigation, so that first-time edit setup feels polished.
7. As a user, I want update-required choices to use keyboard navigation, so that recovery flows are easy.
8. As a user, I do not want numbered readline menus as the main release UX, so that menus do not feel like a debug harness.
9. As an interactive user, I want command output to appear immediately after each selected command, so that I can see whether an action succeeded or failed.
10. As an interactive user, I want `identity export` to show the identity string immediately, so that I can copy it without quitting the menu.
11. As an interactive user, I want result screens like identity export to wait for Enter before returning to the menu, so that the menu redraw does not hide important output.
12. As an interactive user, I want simple success messages to return to the menu without an extra blocking step, so that routine actions stay fast.
13. As an interactive user, I do not want all command output dumped only after quitting, so that the session does not appear broken.
14. As a user, I want Ctrl-C to abort immediately anywhere in the CLI, so that the terminal follows normal Unix expectations.
15. As a user, I want Ctrl-C to exit with code 130, so that shells and scripts can identify an interrupt.
16. As a user, I want Ctrl-C to restore terminal state, so that my terminal is not left in raw mode or a broken screen.
17. As a user, I do not want Ctrl-C to behave like Back, so that abort and navigation are not confused.
18. As a user, I want Back to be an explicit menu choice, so that navigation is intentional.
19. As a user, I want missing existing payload paths to discover encrypted payload candidates in the current directory, so that guided commands are convenient.
20. As a user, I want existing payload discovery to look for `.env.enc` and `.env.*.enc` files, so that common project payloads are suggested.
21. As a user with no discovered payloads, I want the CLI to prompt me for a path, so that guided mode still works.
22. As a user with one discovered payload, I want a keyboard menu with that file preselected plus Enter Path and Cancel, so that I can accept or override the suggestion.
23. As a user with many discovered payloads, I want a keyboard menu listing them plus Enter Path and Cancel, so that choosing the right file is fast.
24. As a user creating a payload interactively, I want `.env.enc` suggested by default, so that the common case is quick.
25. As a user creating a payload interactively, I want empty input to use `.env.enc`, so that defaults are ergonomic.
26. As a user creating a payload where the target already exists, I want a visible collision menu, so that overwrite is never accidental.
27. As a user handling a create collision, I want Override, Change Name, and Cancel options, so that I control the outcome.
28. As a user granting access, I want the picker to merge self identity, local known identities, payload recipients, and local aliases, so that all relevant identities are visible.
29. As a user granting access, I want self shown disabled with a `[you]` tag, so that I understand why I cannot grant myself.
30. As a user granting access, I want already granted recipients shown disabled with a `[granted]` tag, so that duplicate grants are clear.
31. As a user granting access, I want known identities not yet granted to be selectable, so that sharing is easy.
32. As a user granting access, I want payload recipients that are not locally known to still render from embedded payload identity data, so that payload state is understandable.
33. As a user granting access, I want an Enter Identity String option, so that I can grant a brand-new recipient.
34. As a user granting a new identity string, I want that path to trigger the identity import flow, so that the recipient becomes known locally.
35. As a user revoking access, I want the picker to show only actual payload recipients, so that I cannot revoke someone who is not granted.
36. As a user revoking access, I want self disabled with `[you]`, so that I do not accidentally remove my own access.
37. As a user revoking access, I want alias overlays applied to payload recipients, so that familiar local names are used.
38. As a user revoking access, I do not want an Enter Identity String option, so that revoke stays constrained to current recipients.
39. As a user viewing identity lists or pickers, I want compact identity lines, so that the terminal stays readable.
40. As a user viewing identity lists or pickers, I do not want full public keys in normal rows, so that output is not noisy.
41. As a user, I want aliases to appear before display names when available, so that my local naming is respected.
42. As a user, I want contextual tags such as `[you]` and `[granted]`, so that identity rows are self-explanatory.
43. As a user importing an invalid identity string in exact mode, I want a visible error and non-zero exit, so that bad input is rejected.
44. As a guided user importing an invalid identity string, I want the error shown immediately and a chance to retry or cancel, so that I can recover without restarting.
45. As a guided user entering a duplicate alias, I want the error shown immediately and a chance to reprompt, skip, or cancel, so that alias conflicts are recoverable.
46. As a guided user entering an invalid create path or colliding path, I want an immediate action menu, so that I can correct the issue.
47. As a guided user, I do not want invalid input to appear silently accepted, so that I can trust the CLI.
48. As a guided user, I do not want errors hidden until the interactive session exits, so that feedback is timely.
49. As a user opening an encrypted payload file in an editor, I want explanatory comments at the top, so that the file is understandable.
50. As a user opening an encrypted payload file, I want a Better Age outer block, so that the app-owned payload can be parsed trivially.
51. As a user auditing encryption, I want the inner age armored encrypted file preserved unchanged, so that the payload remains transparent and age-compatible.
52. As a maintainer, I want the payload parser to extract exactly one Better Age block, so that malformed files fail deterministically.
53. As a maintainer, I want comments and blank lines outside the block ignored, so that the file can be readable without breaking parsing.
54. As a maintainer, I want malformed, missing, duplicated, or non-age-armored payload blocks rejected, so that bad files fail clearly.
55. As a varlock user, I want `load` to decrypt only the extracted inner age payload, so that machine integration remains stable.
56. As a CLI user, I want `bage --help` to be generated by `@effect/cli`, so that help is battle-tested and consistent.
57. As a CLI user, I want command help generated by `@effect/cli`, so that operands, flags, and aliases are reliable.
58. As a CLI user, I want parse errors owned by `@effect/cli` and mapped through the presenter, so that grammar behavior is not hand-rolled.
59. As a maintainer, I want guided operands represented in grammar without breaking prompts, so that `@effect/cli` integration does not remove guided UX.
60. As a maintainer, I want protocol flags strict in grammar, so that `load --protocol-version=1` still fails before prompts when wrong or missing.
61. As a maintainer, I want no duplicated custom command tree unless it is thin adapter glue, so that help and parser behavior cannot drift again.
62. As a maintainer, I want terminal UX manual QA to be an explicit release gate, so that real terminal regressions are caught before release.
63. As a maintainer, I want the manual QA checklist to cover keyboard navigation, so that menu regressions are caught.
64. As a maintainer, I want the manual QA checklist to cover Ctrl-C abort, so that interrupt semantics are verified.
65. As a maintainer, I want the manual QA checklist to cover immediate interactive feedback, so that output buffering regressions are caught.
66. As a maintainer, I want the manual QA checklist to cover guided suggestions, so that discovery and pickers remain usable.
67. As a maintainer, I want the manual QA checklist to cover editor and viewer behavior, so that plaintext workflows stay safe.
68. As a maintainer, I want the manual QA checklist to cover payload envelope files, so that persisted output is inspectable.
69. As a maintainer, I want the manual QA checklist to cover machine stdout, so that `load` and `identity export` stay pipe-safe.
70. As a maintainer, I want pseudo-TTY tests only where trivial, so that test maintenance does not derail the MVP.

## Implementation Decisions

- The target is the **UX Parity Floor**, not a 1:1 clone of the legacy prototype.
- A parity matrix is required before release readiness can be claimed again.
- Parity matrix statuses are `keep`, `change`, `drop`, `defer`, and `unknown`.
- Useful legacy end-user behavior may not silently disappear.
- Release blocker scope is end-user CLI UX parity and polish.
- Core architecture should remain untouched unless a UX requirement needs a core/storage contract.
- Real `@effect/cli` grammar/help/parser behavior is required.
- Hand-rolled help/parser behavior is a release blocker.
- Promptable operands remain promptable by command flows.
- Protocol inputs remain strict in grammar, especially `load --protocol-version=1`.
- Keyboard-navigable select prompts are required everywhere a release interactive choice list appears.
- Numbered readline selection is not acceptable as primary release UX.
- The terminal adapter should expose one select abstraction reused by menus, guided pickers, editor picker, and update gates.
- Interactive session command results are written immediately after each command completes.
- Interactive session should not accumulate command output until quit.
- Interactive session needs a result/pause policy for primary output screens.
- Primary result screens may wait for Enter before returning to a menu.
- Simple success/status messages should not require a blocking pause.
- Ctrl-C is an abort signal everywhere in interactive CLI surfaces.
- Ctrl-C exits with code 130 and restores terminal state.
- Ctrl-C is never Back.
- Existing payload path selection discovers `.env.enc` and `.env.*.enc` candidates in the current directory.
- Existing payload path selection always allows custom path entry.
- Payload creation target defaults to `.env.enc`.
- Payload creation collision is resolved through Override, Change Name, and Cancel in guided interactive mode.
- Grant identity picker merges self, known identities, payload recipients, and aliases.
- Grant picker disables self and already granted recipients.
- Grant picker supports entering a new identity string.
- Entering a new identity string from grant triggers import flow before granting.
- Revoke identity picker is constrained to payload recipients.
- Revoke picker does not support arbitrary identity string entry for MVP.
- Identity rows use compact rendering.
- Normal identity rows do not show full public keys.
- Guided invalid input uses retry/edit/cancel behavior instead of silent success or delayed failure.
- Payload files use a Better Age outer envelope with `BETTER AGE PAYLOAD` markers.
- The inner encrypted content remains an untouched age armored encrypted file.
- Payload file parsing extracts exactly one Better Age block and validates the inner age armor.
- Manual QA is the primary E2E gate for terminal UX.
- Pseudo-TTY automation is allowed only if trivial and low-maintenance.

Major modules to build or modify:

- Parity matrix document and release checklist.
- Command grammar module over `@effect/cli`.
- Parse-error-to-presenter adapter.
- Terminal select adapter.
- Interactive session runtime/output writer.
- Ctrl-C/abort handling across terminal surfaces.
- Guided payload path resolver.
- Guided payload creation target resolver.
- Guided identity picker and compact identity renderer.
- Guided identity import retry flow.
- Payload file envelope parser/renderer.
- Payload repository adapter integration for the new file envelope.
- Manual QA checklist.
- Release docs.

## Testing Decisions

- Tests should focus on user-visible behavior and module contracts, not private implementation details.
- Unit/contract tests remain required for command flows, parsing adapters, payload envelope parsing, identity rendering, and picker data construction.
- Markdown specs, PRDs, plans, and manual QA checklists are review artifacts, not code-test targets.
- The parity matrix is part of the release test strategy; every legacy end-user behavior must be classified.
- The manual QA checklist is a required release artifact.
- Manual QA must cover:
  - keyboard navigation in interactive menus.
  - keyboard navigation in guided pickers.
  - Ctrl-C abort from menus, prompts, viewer, and editor-adjacent flows where applicable.
  - immediate output after interactive commands.
  - pause after primary result screens.
  - payload discovery with zero, one, and many `.env.enc` / `.env.*.enc` candidates.
  - create target default and collision handling.
  - grant picker with self, known identities, granted recipients, aliases, and typed identity string.
  - revoke picker over payload recipients only.
  - invalid identity string retry.
  - duplicate alias retry/skip/cancel.
  - payload file envelope creation and parsing.
  - `load` clean stdout.
  - `identity export` clean stdout in exact mode.
- Pseudo-TTY tests may be added for cheap high-value checks, but are not mandatory for this PRD.
- Good pseudo-TTY candidates, if cheap:
  - Ctrl-C exits 130.
  - interactive command output appears before quit.
  - keyboard select can move and choose.
- Existing `pnpm test`, `pnpm check`, and `git diff --check` remain required.

## Out of Scope

- Rewriting the core architecture from scratch again.
- Reusing legacy prototype code by default.
- Exact transcript/output parity with the legacy prototype.
- Preserving known rough legacy UX where a better flow is specified.
- Headless passphrase injection.
- Docker E2E as a required release gate.
- Full pseudo-TTY test suite as a required release gate.
- Full TUI.
- Public SDK polish for core.
- Releasing `cli-legacy`.
- Automatic import prompt for all unknown identities discovered from payloads outside the specified grant/import path.
- New identity alias management commands beyond current import-time alias behavior.

## Further Notes

This PRD exists because the previous release-readiness audit was too static. Passing tests and completed plan checkboxes did not prove terminal UX quality.

The implementation should preserve the valuable new structure and core tests, but treat user-facing CLI polish as a release blocker. The next implementation plan should be tracer-bullet based, starting with the highest-risk runtime behavior: real `@effect/cli`, keyboard select, immediate interactive feedback, and abort semantics.
