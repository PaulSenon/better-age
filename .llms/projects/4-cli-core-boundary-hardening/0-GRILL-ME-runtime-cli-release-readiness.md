# Runtime CLI Release Readiness Grilling Log

Append-only log for the post-contract rebuild grilling session.

## 2026-04-25 Start

Context:

- MVP contract rebuild phases 1-11 are complete.
- Build, tests, checks passed.
- Remaining gap is not domain/core behavior; it is runtime CLI readiness.

Question:

Should remaining work target **usable local MVP** or **release-ready CLI**?

Recommended answer:

- **Usable local MVP first**, because it keeps scope smaller:
  - hidden passphrase prompt.
  - editor adapter.
  - secure viewer or explicit fallback.
  - built `bage` bin works.
  - interactive can stay simple.
  - no forced full `@effect/cli` rewrite.

User answer:

- **Release-ready**.

Decision:

- The next planning/spec pass targets **release-ready CLI**, not just local MVP usability.
- Scope can include parser/help/styling/packaging/release-surface work if needed.

## 2026-04-25 Effect CLI Boundary

Question:

For **release-ready**, is `@effect/cli` integration mandatory?

Recommended answer:

- Yes, mandatory for parsing/help/command structure, but not for business flow orchestration.
- `@effect/cli` owns command grammar, flags, help, aliases, and parse errors.
- Existing `runCli`-style flows remain the tested orchestration layer.
- Core logic should not be rewritten into `@effect/cli` handlers unless the boundary proves useful.

User answer:

- Yes. This is the whole point.

Decision:

- `@effect/cli` integration is mandatory for release-ready CLI.
- The release-ready CLI must expose a real `@effect/cli` command grammar.
- The command grammar must delegate into existing tested command flows rather than absorbing business logic.

## 2026-04-25 Test Seams

Question:

Should `runCli(argv)` remain as the stable test seam, or should tests move up to the built `@effect/cli` program?

Recommended answer:

- Use both seams with different responsibilities.
- `runCli(argv)` remains the flow contract seam:
  - fast tests.
  - injected core.
  - injected terminal.
  - command behavior and stdout/stderr contracts.
- `@effect/cli` program gets grammar tests:
  - aliases.
  - flags.
  - missing operands.
  - help.
  - parse errors.
- built `bage` gets smoke tests only:
  - startup.
  - stdout/stderr split.
  - exit codes.

User answer:

- Both.
- Docker E2E for the CLI bin sounds desirable, but likely last because interactive IO is hard to test elegantly.

Decision:

- Keep both flow-level and grammar-level tests.
- Add bin smoke tests before heavy Docker E2E.
- Treat Docker E2E as a late release-hardening layer, not the next implementation blocker.
- Interactive E2E must not block `@effect/cli` grammar integration unless a small, maintainable harness emerges.

## 2026-04-25 Secure Viewer

Question:

For release-ready, do we require a real **Secure Viewer** for `bage view`, or can `view` launch `$PAGER` / `less -R` as MVP release behavior?

Recommended answer:

- Use `$PAGER` / `less` with strict stdout safety for first release.

User answer:

- Wants a small in-process viewer.
- Prototype already had one.
- Scope can be basic:
  - no plaintext stdout.
  - scrollable with keyboard.
  - quit.
  - isolated so complexity does not leak through the codebase.

Decision:

- Release-ready CLI requires a small in-process **Secure Viewer**.
- The viewer must be an isolated runtime adapter behind the existing `openViewer` terminal port.
- The viewer must never write plaintext to stdout.
- The viewer may be basic for first release: render, scroll, quit.

## 2026-04-25 Passphrase Prompt

Question:

For release-ready, should we require a real hidden passphrase prompt with no echo and TTY-only behavior?

Recommended answer:

- Yes, required.

Contract:

- No passphrase in argv/env/stdin pipe for first release.
- Prompt only when stdin and stderr are TTY.
- Input hidden, ideally no `*` echo.
- Ctrl-C maps to `CANCELLED`.
- EOF maps by timing:
  - if prompt started: `CANCELLED`.
  - if no TTY before prompt: `PASSPHRASE_UNAVAILABLE`.

User answer:

- Yes.

Decision:

- Hidden TTY passphrase prompt is a hard release requirement.
- The current readline secret prompt is not release-ready because it echoes input.
- Secret acquisition belongs in an isolated runtime terminal adapter, not in command flow logic.

## 2026-04-25 Editor Resolution

Question:

For release-ready `bage edit`, should editor integration be:

1. `$EDITOR` / `$VISUAL` external editor only.
2. small in-process editor.
3. both.

Recommended answer:

- External editor only for release.
- Use `$VISUAL`, then `$EDITOR`.
- If unset, fail `EDITOR_UNAVAILABLE` with remediation.

User answer:

- Match prototype behavior.
- Try environment editor first.
  - User wrote `$EDITOR` / `$VIDUAL`; canonical env var is `$VISUAL`.
- If no environment editor is found and terminal is interactive:
  - show editor picker with common editors: `nano`, `vi`, `vim`, `nvim`.
  - after first pick, ask whether to use just once or remember.
  - if remembered, persist preferred editor in home data.
- On later edit:
  - forced environment editor wins.
  - otherwise use local preferred editor when present.
  - otherwise prompt again.

Decision:

- Release-ready CLI requires prototype-parity external editor resolution.
- Editor priority:
  1. `$VISUAL` / `$EDITOR` environment override.
  2. persisted local preferred editor from home state.
  3. interactive editor picker.
  4. `EDITOR_UNAVAILABLE` if no interactive picker is possible.
- There is no in-process editor requirement for release.

## 2026-04-25 Editor Preference Storage

Question:

Should editor preference be stored in the same `Home State preferences` object?

Recommended answer:

- Yes.

Shape:

```ts
preferences: {
  rotationTtl: string;
  editorCommand?: string;
}
```

Rules:

- Only persist when user chooses "remember".
- Validate command exists before saving.
- Environment `$VISUAL` / `$EDITOR` never mutates preference.
- If saved editor later missing, ignore it and fall into picker.
- Do not auto-clear missing saved editor; replace only when user picks and remembers again.

User answer:

- Yes, exactly.

Decision:

- `editorCommand` belongs in `Home State preferences`.
- It is managed state and may require a home schema migration.
- Missing saved editor is treated as unusable for the current command, not as data corruption.

## 2026-04-25 Styling Policy

Question:

For release-ready, what styling layer do we want?

Recommended answer:

- Chalk-like minimal styling with capability detection, not rich TUI.

Contract:

- Color/bold only on stderr human output.
- No color in machine stdout.
- Respect `NO_COLOR`.
- Disable color when stderr is not TTY.
- Optionally support `FORCE_COLOR`.
- Avoid emoji by default for SSH/portable Unix.
- Output remains readable as plain text.

User answer:

- Yes.
- Wants minimal readability and UX.
- Must stay compatible and simple.

Decision:

- Release-ready CLI uses minimal terminal styling, not rich TUI styling.
- Styling is presentation-only and must not affect command semantics or machine stdout.

## 2026-04-25 Terminal Primitive Dependencies

Question:

Which dependency strategy should runtime terminal primitives use?

Options considered:

- Minimal local terminal primitives, fewer dependencies.
- Proven prompt libraries for select/secret/editor selection, more dependencies but faster polish.
- Hybrid.

Codebase finding:

- Legacy CLI already used `@effect/cli/Prompt.select` for interactive menus.
- Legacy CLI implemented hidden secret input locally with raw-mode stdin.
- No existing prompt dependency like `inquirer`, `prompts`, or `enquirer` is present.

User answer:

- Menus likely should use built-in `@effect/cli` select.
- Unsure for the rest.

Decision:

- Use `@effect/cli/Prompt.select` for menus/pickers.
- Use local minimal ANSI styling helper, no styling dependency by default.
- Use local raw-mode hidden secret prompt adapted from prototype/legacy behavior.
- Use `node:readline` or equivalent local primitive for normal text prompts.
- Do not add a general prompt library unless a specific release requirement cannot be met cleanly with these primitives.

## 2026-04-25 Interactive Session Shape

Question:

For release-ready, should `bage interactive` be a real loop with menus/back/cancel, or can it remain a one-shot command picker?

Recommended answer:

- Real loop, but shallow.
- Main menu:
  - Payloads.
  - Identities.
  - Setup.
  - Quit.
- Back returns one menu up.
- Cancel/Quit exits.
- Selected action reuses same direct command flow.
- After action completes, return to same menu.
- No duplicate business logic.

User answer:

- Real loop.
- Prototype was quite good.
- Before setup:
  - show only `setup` and `quit`.
  - after setup succeeds, loop into the setup-complete state.
- Once setup exists:
  - show `Files`, `Identities`, `quit`.
  - never show setup once done.
- Submenus:
  - files and identities expose all commands except `load` and `interactive`.
  - include `back` and `quit`.

Decision:

- Release-ready **Interactive Session** is a real state-aware menu loop.
- Home setup state controls the root menu.
- `load` is intentionally excluded from interactive menus because it is a machine-output command.
- `interactive` is excluded from itself.
- Menus delegate to direct command flows and then return to the active menu.

## 2026-04-26 Home Status Query

Question:

How should CLI know "first time" vs "once setup" for the **Interactive Session**?

Recommended answer:

- Add a core query:

```ts
queries.getHomeStatus():
  | { status: "not-setup" }
  | { status: "setup"; self: SelfIdentitySummary }
```

Reason:

- Avoids using error control flow from `getSelfIdentity`.
- Useful for `interactive` and future health/help.
- Keeps menu state from poking storage directly.

Alternative:

- Call `getSelfIdentity` and treat `HOME_STATE_NOT_FOUND` as not setup.

User answer:

- Sounds right.

Decision:

- Release-ready core should expose `queries.getHomeStatus`.
- Interactive menu setup gating should use `getHomeStatus`.

## 2026-04-26 Release Docs Scope

Question:

What docs are required before calling CLI release-ready?

Recommended minimum:

- `packages/cli/README.md`:
  - install/build.
  - command list.
  - examples.
- root README or project doc:
  - package roles: `core`, `cli`, `varlock`, `cli-legacy`.
- varlock README:
  - new `bage` bin assumption.
  - custom launcher.
- known limitations:
  - no headless passphrase.
  - Docker E2E deferred.

User answer:

- Yes.
- Drop docs for legacy because the legacy proof-of-concept will never release.

Decision:

- Release docs target new packages and user-facing runtime only.
- `cli-legacy` should stay private/unreleased and does not need release-facing docs.
- Docs should mention legacy only as non-release/private when necessary for repository orientation.

## 2026-04-26 Release Packaging

Question:

Should `@better-age/cli` ship TypeScript source via `exports: "./src/index.ts"` like core currently does, or compiled `dist` only?

Recommended answer:

- Release packages should ship compiled `dist` only.
- `@better-age/core` should also eventually get a release packaging pass.
- `exports` points to `dist/index.js`.
- package `files` includes `dist` and `README.md`.
- declarations are desirable.

User answer:

- CLI should be built as a standalone single file, like the legacy proof-of-concept.
- Core should be built like a library, but for MVP it is mainly an internal monorepo dependency bundled into the CLI.
- External core package consumers are not a priority for MVP.
- CLI packaging is the priority.

Decision:

- Release-ready CLI packaging targets a standalone single-file `bage` bundle.
- `@better-age/core` remains package-shaped internally, but MVP release priority is bundling it into the CLI.
- Core external library packaging is nice-to-have, not release-blocking for MVP.

## 2026-04-26 Bundler

Question:

Legacy used a single-file bundle. Should new CLI use the same bundler setup as legacy?

Recommended answer:

- Yes, use esbuild for the CLI bundle unless legacy had a strong reason not to.
- Target:
  - one bundled CLI file.
  - core and CLI runtime bundled inside.
  - externalize only dependencies that truly cannot bundle.
  - preserve shebang.

CJS vs ESM recommendation:

- Prefer CJS for CLI release if dependencies allow it.
- If Effect or crypto dependencies make ESM more reliable, use ESM.
- Choose based on build/runtime reliability.

User answer:

- Same bundling.
- One standalone file for CLI.

Decision:

- New CLI release bundle should mirror legacy strategy: one standalone bundled CLI file.
- Module format is a build-reliability implementation detail unless runtime constraints force a decision.

## 2026-04-26 Command Grammar Promptable Operands

Question:

For release-ready `@effect/cli`, should grammar enforce required operands, or preserve current guided behavior where missing operands are allowed and flow prompts?

Recommended answer:

- Promptable operands are optional in grammar.
- Protocol operands are required in grammar.
- Exact/guided distinction remains flow-level.

Example:

```txt
bage grant [payload] [identity-ref]
bage load [payload] --protocol-version=1
```

User answer:

- Yes.
- This was already obvious from prior specs.

Decision:

- `@effect/cli` grammar must not mark promptable operands as required.
- Grammar integration must preserve guided invocation behavior.
- The reason to restate this is regression prevention during parser integration, not a new domain decision.

## 2026-04-26 Terminal Testing Scope

Question:

Do we require automated tests for hidden passphrase and viewer using a pseudo-TTY harness, or accept unit tests around adapters plus manual QA?

Recommended answer:

- Unit tests for parser, flow, and adapters.
- One small pseudo-TTY smoke harness for hidden passphrase and viewer quit.
- Docker E2E later, optional.

User answer:

- Unit tests plus manual QA for now.

Decision:

- Release-ready planning does not require pseudo-TTY or Docker E2E as a gate.
- Hidden prompt, viewer, editor, and interactive loop should have unit-level tests where practical.
- Manual QA is accepted for real terminal behavior in this phase.

## 2026-04-26 Home State v2 for Editor Preference

Question:

Since we add `preferences.editorCommand`, do we bump Home State schema version now?

Recommended answer:

- Yes, introduce HomeState v2 even if migration is tiny.

Reason:

- Release-ready means migration mechanism must remain real.
- Avoids silent optional-field drift.
- Tests can prove v1 -> v2 adds the new field consistently.

Question:

Should `editorCommand` be nullable or optional?

Recommended answer:

```ts
editorCommand: string | null
```

User answer:

- Yes.

Decision:

- Add **Home State v2** for editor preference.
- Persist `preferences.editorCommand` as `string | null`.
- Migration from v1 to v2 sets `editorCommand: null`.

## 2026-04-26 Editor Command Validation

Question:

When user picks `nvim`, do we persist just `"nvim"` or resolved absolute path?

Recommended answer:

- Persist command string, not absolute path.

Reason:

- `$PATH` lookup each run detects current availability.
- User selected a command, not a binary artifact.
- Absolute paths can drift and are not meaningfully better for this local preference.

Validation:

- When choosing: verify command resolves in PATH.
- When using saved preference: verify it still resolves.
- If missing: fall back to picker.

User answer:

- Ok.

Decision:

- Persist editor command string.
- Runtime resolves and validates through PATH on use.

## 2026-04-26 Command Help

Question:

Should help text be exhaustive or minimal?

Recommended answer:

- Minimal but complete.

Required:

- Root help lists all commands.
- Command help shows operands/flags and one-line purpose.
- Aliases are visible.
- `load` help says `--protocol-version=1` is required.
- `identity passphrase` help shows aliases `pass`, `pw`.
- Terminal help stays short; README carries examples.

User answer:

- Exhaustive but minimal.

Decision:

- Release-ready help must cover every command and alias.
- Help copy should stay concise and operational, not become long-form documentation.

## 2026-04-26 Parse Error Presentation

Question:

Should `@effect/cli` parse errors be raw Effect output or mapped through our presenter?

Recommended answer:

- Mapped through presenter/styling layer.

Contract:

- Parse errors go to stderr.
- Exit code is `2`.
- Stdout is empty.
- Message is terse and includes a hint when useful.

Examples:

```txt
[ERROR] COMMAND_UNKNOWN: unknown command "foo"
[ERROR] OPTION_INVALID: --protocol-version must be 1
[ERROR] ARGUMENT_INVALID: expected identity command
```

User answer:

- Ok.

Decision:

- Release-ready grammar parse errors must use the same presenter/styling boundary as command failures.
- Raw `@effect/cli` parse output is not release-ready.
