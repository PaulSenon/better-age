# PRD: Runtime CLI Release Readiness

## Problem Statement

The Better Age MVP rebuild now has a clean core/CLI/varlock boundary, a tested command-flow contract, and a working built `bage` entrypoint. However, the runtime CLI is not release-ready yet.

The remaining problem is not the core domain model. It is the release-facing terminal experience: command grammar/help, hidden passphrase input, real editor/viewer adapters, a real interactive session, minimal styling, standalone bundle packaging, and release docs. Without this work, the CLI contract is mostly proven, but the shipped binary would still feel like a harness rather than a polished Unix CLI.

## Solution

Make the new CLI release-ready while preserving the architecture already built.

The release-ready CLI should:

- expose a real `@effect/cli` command grammar for commands, aliases, flags, help, and parse errors.
- keep existing flow orchestration as the business behavior seam.
- build into one standalone bundled `bage` file, mirroring the legacy proof-of-concept packaging style.
- provide a hidden TTY-only passphrase prompt.
- provide a small isolated in-process secure viewer for `bage view`.
- provide prototype-parity external editor resolution for `bage edit`, including persisted editor preference.
- introduce Home State v2 for `preferences.editorCommand`.
- implement a real state-aware interactive menu loop.
- apply minimal terminal styling only to human stderr output.
- update release-facing docs for the new CLI and varlock package.

This is a runtime hardening and packaging PRD. It should not reopen core payload/identity behavior unless needed for editor preference and setup-state queries.

## User Stories

1. As a user, I want `bage --help` to show every supported command, so that I can discover the CLI without reading source.
2. As a user, I want command help to show operands, flags, and aliases, so that I can run commands correctly.
3. As a user, I want `bage identity passphrase --help` to show `pass` and `pw` aliases, so that shortcuts are discoverable.
4. As a user, I want `bage load --help` to clearly show `--protocol-version=1`, so that machine integrations use the protocol correctly.
5. As a user, I want parse errors to be concise and styled like other errors, so that failures are understandable.
6. As a script author, I want parse errors to write only stderr and exit 2, so that stdout remains safe.
7. As a maintainer, I want `@effect/cli` to own command grammar, so that parsing/help behavior is release-grade.
8. As a maintainer, I want command grammar to delegate to existing flows, so that business logic is not duplicated.
9. As a user, I want guided commands to keep prompting for missing promptable operands, so that `@effect/cli` integration does not regress guided UX.
10. As a machine caller, I want protocol operands to remain strict, so that protocol misuse fails before prompts.
11. As a user, I want passphrase prompts to hide typed input, so that secrets are not exposed on screen.
12. As a user, I want passphrases to never be accepted through argv, env, or piped stdin for this release, so that accidental leakage paths stay closed.
13. As a headless caller, I want passphrase-required commands to fail before prompting when no TTY is available, so that automation does not hang.
14. As a user, I want Ctrl-C during a passphrase prompt to cancel cleanly, so that I can abort safely.
15. As a user, I want EOF during an active prompt to cancel cleanly, so that interrupted terminals do not produce confusing errors.
16. As a user, I want `bage view` to open plaintext in a small in-process viewer, so that secrets never fall back to stdout.
17. As a user, I want the secure viewer to scroll with the keyboard, so that I can inspect longer payloads.
18. As a user, I want the secure viewer to quit quickly from the keyboard, so that viewing secrets is low friction.
19. As a maintainer, I want the secure viewer isolated behind the terminal adapter boundary, so that viewer complexity does not leak into command flows.
20. As a user, I want `bage edit` to use `$VISUAL` or `$EDITOR` when set, so that it respects my shell.
21. As a user, I want `bage edit` to use my remembered editor when no env override is set, so that repeated edits are smooth.
22. As a first-time user without `$VISUAL` or `$EDITOR`, I want an interactive picker for common editors, so that edit still works.
23. As a user, I want to choose whether an editor pick is one-time or remembered, so that I control local preference.
24. As a user, I want missing saved editors to fall back to picker, so that a removed editor does not break edit forever.
25. As a maintainer, I want editor preference stored in Home State v2, so that schema evolution remains explicit.
26. As a maintainer, I want v1 home state to migrate to v2 with `editorCommand: null`, so that existing new-MVP users keep working.
27. As a user, I want `bage interactive` to be a real loop, so that I can stay in guided mode across multiple actions.
28. As a first-time user, I want interactive mode to show only setup and quit before setup, so that the menu matches available state.
29. As a setup user, I want the interactive session to move into the normal menu after setup succeeds, so that onboarding continues naturally.
30. As an existing user, I want interactive mode to show Files, Identities, and Quit, so that the menu stays focused.
31. As an existing user, I do not want setup shown after setup exists, so that invalid actions are hidden.
32. As an interactive user, I want Files and Identities submenus to include back and quit, so that navigation is predictable.
33. As an interactive user, I want menus to expose all human commands except `load` and `interactive`, so that machine-output and recursive commands stay out of the menu.
34. As a maintainer, I want interactive menu actions to reuse direct command flows, so that no business logic forks.
35. As a user, I want human output to have minimal color and emphasis, so that errors, warnings, and successes are readable.
36. As a user over SSH or plain terminals, I want output to remain readable without color, so that compatibility stays high.
37. As a script author, I want `load` and `identity export` stdout to remain unstyled, so that machine output is stable.
38. As a user, I want `NO_COLOR` respected, so that I can disable color globally.
39. As a user, I want color disabled when stderr is not a TTY, so that redirected logs stay plain.
40. As a maintainer, I want a local styling helper rather than a heavy styling dependency, so that the terminal layer stays simple.
41. As a release user, I want `bage` distributed as one standalone executable JavaScript file, so that installation is simple.
42. As a maintainer, I want core bundled into the CLI release artifact, so that MVP packaging prioritizes the CLI.
43. As a maintainer, I want the bundler to preserve the shebang, so that installed `bage` runs directly.
44. As a maintainer, I want only truly unbundleable dependencies externalized, so that the release artifact is self-contained.
45. As a varlock user, I want varlock docs to explain the `bage` bin assumption and custom launcher, so that integration is clear.
46. As a CLI user, I want release docs with command list and examples, so that I can use the tool without reading implementation plans.
47. As a maintainer, I want legacy docs excluded from release docs, so that unreleased proof-of-concept code is not presented as product.
48. As a maintainer, I want unit tests for grammar, flows, adapters, and packaging contracts, so that release behavior is protected.
49. As a maintainer, I want manual QA accepted for real terminal behavior in this phase, so that pseudo-TTY and Docker setup do not block release readiness.
50. As a future maintainer, I want Docker or pseudo-TTY E2E parked as optional later hardening, so that the current phase stays achievable.

## Implementation Decisions

- `@effect/cli` integration is mandatory for release readiness.
- `@effect/cli` owns command grammar, flags, aliases, help, usage, and parse errors.
- Existing command flow orchestration remains the business behavior seam.
- Promptable operands remain optional in grammar so guided invocation still works.
- Protocol operands remain strict in grammar, especially `load --protocol-version=1`.
- Parse errors are mapped through the existing presenter/styling boundary.
- Parse errors write stderr only and exit 2.
- Flow contract tests remain around the injected `runCli` seam.
- Grammar tests are added around the `@effect/cli` program seam.
- Built `bage` tests are smoke tests only.
- Docker and pseudo-TTY E2E are deferred.
- Release-ready CLI requires a small in-process Secure Viewer.
- Secure Viewer is isolated behind the existing terminal `openViewer` port.
- Secure Viewer supports rendering, keyboard scrolling, and quit.
- Secure Viewer must never write plaintext to stdout.
- Release-ready CLI requires a hidden TTY-only Secret Prompt.
- Secret Prompt does not accept passphrases through argv, env, or piped stdin in this release.
- Secret Prompt maps no-TTY preflight to passphrase unavailable.
- Secret Prompt maps Ctrl-C and active-prompt EOF to cancel.
- Editor resolution matches prototype behavior.
- Editor resolution priority is `$VISUAL` / `$EDITOR`, then saved preference, then interactive picker, then unavailable failure.
- Editor picker offers common editors such as `nano`, `vi`, `vim`, and `nvim`.
- Editor picker asks one-time vs remember.
- Editor commands are persisted as command strings, not resolved absolute paths.
- Editor command availability is validated through PATH when chosen and when reused.
- Missing saved editor falls back to picker and does not auto-clear state.
- Home State v2 adds `preferences.editorCommand: string | null`.
- Home State v1 to v2 migration sets `editorCommand: null`.
- `getHomeStatus` core query is added for setup-aware interactive menu gating.
- Interactive Session is a real loop.
- Before setup, Interactive Session shows setup and quit only.
- After setup, Interactive Session shows Files, Identities, and Quit.
- Setup is not shown once setup exists.
- Files and Identities menus include back and quit.
- Interactive menus exclude `load` and `interactive`.
- Menus delegate to direct command flows and return to the active menu after actions.
- Menus use `@effect/cli/Prompt.select`.
- Text prompts use local Node primitives.
- Secret prompt uses local raw-mode primitive adapted from prototype/legacy behavior.
- Styling uses a minimal local ANSI helper.
- Styling is applied only to human stderr output.
- Styling respects `NO_COLOR`.
- Styling disables color when stderr is not a TTY.
- `FORCE_COLOR` support is optional but allowed.
- Emoji are avoided by default for SSH and portable Unix compatibility.
- CLI packaging targets one standalone bundled file.
- Bundling should mirror legacy proof-of-concept strategy.
- The bundler should bundle CLI runtime and core into the single artifact.
- Module format is chosen by build/runtime reliability.
- Core external library packaging is nice-to-have and not an MVP release blocker.
- Release docs target new packages and runtime behavior only.
- Legacy proof-of-concept stays private/unreleased and does not need release-facing docs.

Major modules to build or modify:

- Command grammar module over `@effect/cli`.
- Parse error mapper.
- Flow adapter from parsed commands to existing command flows.
- Node terminal runtime adapter.
- Hidden secret prompt primitive.
- Secure viewer module.
- Editor resolver and launcher.
- Editor preference core commands/queries or preference update API.
- Home State v2 schema and migration.
- Home status core query.
- Styling helper.
- Standalone bundle build config.
- CLI package docs.
- Varlock docs.
- Manual QA checklist.

## Testing Decisions

- Tests should verify behavior through public seams, not implementation details.
- `runCli` flow tests stay fast and exhaustive for command behavior.
- `@effect/cli` grammar tests cover:
  - command list.
  - aliases.
  - flags.
  - optional promptable operands.
  - required protocol operands.
  - help output.
  - parse error mapping.
- Presenter/styling tests cover semantic output and color capability rules.
- Machine stdout tests ensure `load` and `identity export` remain clean.
- Secret prompt tests cover pure/raw-mode state transitions where practical.
- Secure viewer tests cover navigation state and no-stdout contract where practical.
- Editor resolver tests cover env override, saved preference, picker, one-time choice, remember choice, missing command fallback, and headless unavailable behavior.
- Home State v2 migration tests cover v1 to v2 upgrade and current v2 parse/encode.
- Interactive session tests cover setup-gated root menu, setup success transition, normal root menu, Files menu, Identities menu, back, quit, and exclusion of `load`.
- Packaging contract tests cover single-file bundle target and bin manifest.
- Bin smoke tests cover startup, parse errors, and stdout/stderr split for non-interactive commands.
- Manual QA covers real hidden prompt, real editor launching, real secure viewer scrolling/quit, and interactive menu loop.
- Docker and pseudo-TTY E2E are explicitly not required for this PRD.

## Out of Scope

- Reworking core payload or identity domain behavior already covered by the MVP rebuild.
- Supporting headless passphrase injection.
- Accepting passphrases through argv, env, or piped stdin.
- Full rich TUI.
- Full in-process editor.
- Docker E2E as a release gate.
- Pseudo-TTY automation as a release gate.
- Public SDK polish for `@better-age/core`.
- Releasing `cli-legacy`.
- Writing release docs for `cli-legacy`.
- Automatic import of unknown payload recipients.
- Identity alias management commands beyond current import behavior.

## Further Notes

Release blockers agreed in the grilling session:

1. `@effect/cli` command grammar/help/parse errors.
2. Standalone single-file bundle.
3. Hidden TTY passphrase prompt.
4. In-process secure viewer.
5. External editor resolution plus persisted editor preference plus Home State v2 migration.
6. Real interactive loop.
7. Minimal styling.
8. Release docs.
9. Unit tests plus manual QA checklist.

The current contract rebuild is valuable and should be preserved. This PRD should be implemented as runtime hardening over the existing flow/core shape, not as a rewrite of the completed MVP behavior.
