# Plan: Runtime CLI Release Readiness

> Source PRD: [12-PRD_RUNTIME_CLI_RELEASE_READINESS.md](../12-PRD_RUNTIME_CLI_RELEASE_READINESS.md)

## Architectural Decisions

Durable decisions that apply across all phases:

- **Command Grammar**: `@effect/cli` owns release-facing command tree, operands, flags, aliases, help, usage, and parse errors.
- **Flow Boundary**: existing command flows remain the business behavior seam; grammar delegates into flows and does not absorb domain logic.
- **Guided Invocation**: promptable operands stay optional in grammar; exact/guided behavior remains flow-level.
- **Protocol Operands**: protocol-owned inputs, especially `load --protocol-version=1`, stay strict and fail before prompts.
- **Parse Errors**: grammar failures map through the presenter/styling boundary, write stderr only, and exit 2.
- **Terminal Runtime**: menus use `@effect/cli/Prompt.select`; text prompts use local Node primitives; passphrases use a local raw-mode hidden input primitive.
- **Secure Viewer**: release-ready `view` uses a small isolated in-process viewer behind the terminal adapter boundary; plaintext never goes to stdout.
- **Editor Resolution**: editor priority is `$VISUAL` / `$EDITOR`, then persisted Home State preference, then interactive picker, then unavailable failure.
- **Home Schema**: Home State v2 adds `preferences.editorCommand: string | null`; v1 migrates to v2 with `editorCommand: null`.
- **Interactive Session**: real state-aware menu loop; before setup shows setup/quit only; after setup shows Files/Identities/Quit; menus exclude `load` and `interactive`.
- **Styling**: minimal local ANSI helper; human stderr only; no styling on machine stdout; respects `NO_COLOR`; disables color when stderr is not a TTY.
- **Packaging**: CLI release artifact is one standalone bundled `bage` file, bundling core and CLI runtime, preserving the shebang.
- **Testing**: unit and contract tests are required; manual QA is accepted for real terminal behavior; Docker and pseudo-TTY E2E are deferred.
- **Docs**: release docs target new CLI and varlock runtime behavior; legacy proof-of-concept stays private and unreleased.

---

## Phase 1: Grammar Tracer Bullet

**User stories**: 1-10

### What To Build

Introduce the release-facing `@effect/cli` command grammar as a thin layer over existing command flows. Prove one representative command from grammar to flow, then cover the full command tree, aliases, help, and parse-error behavior.

### Acceptance Criteria

- [x] Root help lists every release command.
- [x] Command help shows operands, flags, one-line purpose, and aliases.
- [x] `identity passphrase` help exposes `pass` and `pw`.
- [x] `load` help exposes required `--protocol-version=1`.
- [x] Promptable operands remain optional in grammar.
- [x] Protocol operands fail before prompts when missing or invalid.
- [x] Parse errors write stderr only and exit 2.
- [x] Grammar delegates to existing command flows.
- [x] Existing `runCli` flow tests remain meaningful and passing.

---

## Phase 2: Home State v2 + Home Status

**User stories**: 25-26, 28-31

### What To Build

Add the durable state needed by release-ready runtime behavior: a Home State v2 schema with nullable editor preference and a setup-state query for interactive menus.

### Acceptance Criteria

- [x] Home State v2 persists `preferences.editorCommand: string | null`.
- [x] Home State v1 migrates to v2 with `editorCommand: null`.
- [x] Current home parse/encode tests cover v2.
- [x] Migration tests cover v1 to v2 upgrade.
- [x] Core exposes a home status query returning not-setup or setup with self identity summary.
- [x] Interactive menu setup gating can use home status without relying on error control flow.

---

## Phase 3: Hidden Secret Prompt

**User stories**: 11-15

### What To Build

Replace the current echoing readline secret prompt with a release-ready TTY-only hidden passphrase prompt. Keep it isolated in the terminal runtime adapter and preserve existing passphrase retry flow behavior.

### Acceptance Criteria

- [x] Passphrase input is hidden and does not echo characters.
- [x] Secret prompt requires interactive stdin and stderr TTYs.
- [x] No passphrase is accepted through argv, env, or piped stdin.
- [x] No-TTY preflight maps to passphrase unavailable.
- [x] Ctrl-C during prompt maps to cancel.
- [x] Active-prompt EOF maps to cancel.
- [x] Existing passphrase retry tests still pass.
- [x] Unit tests cover the prompt state machine where practical.

---

## Phase 4: Editor Runtime

**User stories**: 20-24

### What To Build

Implement prototype-parity external editor resolution for `edit`: environment override, saved preference, interactive picker, one-time vs remember, launch attached to TTY, temp file lifecycle, and no plaintext stdout.

### Acceptance Criteria

- [ ] `$VISUAL` / `$EDITOR` wins over saved preference.
- [ ] Saved editor preference is used when no env override exists.
- [ ] Saved editor availability is validated through PATH before use.
- [ ] Missing saved editor falls back to picker without auto-clearing state.
- [ ] Interactive picker offers common editors.
- [ ] Picker supports one-time and remember decisions.
- [ ] Remember persists editor command string in Home State preferences.
- [ ] One-time choice does not mutate Home State.
- [ ] Headless/no-editor path fails editor unavailable.
- [ ] Editor non-zero exit maps to explicit editor failure.
- [ ] Temp file cleanup is best-effort.
- [ ] Plaintext never goes to stdout.

---

## Phase 5: Secure Viewer

**User stories**: 16-19

### What To Build

Add a small isolated in-process secure viewer for `view`. It should render plaintext to the terminal UI, support keyboard scrolling and quit, and preserve the no-stdout safety contract.

### Acceptance Criteria

- [ ] `view` uses the in-process viewer in interactive terminals.
- [ ] Viewer renders plaintext only to terminal UI/stderr-compatible output, never stdout.
- [ ] Viewer supports scrolling for long payloads.
- [ ] Viewer supports keyboard quit.
- [ ] Viewer cancel/quit returns to command flow cleanly.
- [ ] Viewer unavailable/headless paths fail explicitly.
- [ ] Viewer logic is isolated behind the terminal adapter boundary.
- [ ] Unit tests cover viewer state/navigation where practical.

---

## Phase 6: Real Interactive Loop

**User stories**: 27-34

### What To Build

Replace the current one-shot interactive router with a real state-aware menu loop. It should gate setup state, expose Files and Identities menus after setup, support back/quit, and delegate selected actions to direct command flows.

### Acceptance Criteria

- [ ] Before setup, root menu shows setup and quit only.
- [ ] Successful setup transitions into normal setup-complete menu state.
- [ ] After setup, root menu shows Files, Identities, and Quit.
- [ ] Setup is not shown after setup exists.
- [ ] Files submenu exposes human payload commands except `load`.
- [ ] Identities submenu exposes identity commands.
- [ ] Menus include back and quit where appropriate.
- [ ] Selecting an action delegates to the same direct command flow.
- [ ] After action completion, session returns to the active menu.
- [ ] `load` and `interactive` are excluded from interactive menus.
- [ ] No business logic is duplicated inside menu code.

---

## Phase 7: Styling + Presenter Polish

**User stories**: 35-40

### What To Build

Add minimal capability-detected styling for human output while preserving plain readable output and clean machine stdout.

### Acceptance Criteria

- [ ] Human successes, warnings, and errors are visually distinct when styling is enabled.
- [ ] Styling applies only to human stderr output.
- [ ] `load` stdout remains raw env text.
- [ ] `identity export` stdout remains raw identity string.
- [ ] `NO_COLOR` disables styling.
- [ ] Non-TTY stderr disables styling.
- [ ] Output remains readable without styling.
- [ ] Emoji are not used by default.
- [ ] Presenter tests cover styled and plain modes.

---

## Phase 8: Standalone Bundle

**User stories**: 41-44

### What To Build

Switch the CLI release build from multi-file TypeScript output to a single standalone bundled `bage` artifact, mirroring the legacy proof-of-concept bundling strategy.

### Acceptance Criteria

- [ ] Build emits one standalone executable `bage` JavaScript file.
- [ ] Bundle includes CLI runtime and core dependency.
- [ ] Shebang is preserved.
- [ ] Package `bin` points to the bundled artifact.
- [ ] Only truly unbundleable dependencies are externalized.
- [ ] Bundle build is covered by package contract tests.
- [ ] Built `bage` smoke tests cover startup and basic non-interactive failures.
- [ ] Varlock still invokes the expected `bage load --protocol-version=1 <path>` contract.

---

## Phase 9: Release Docs + Manual QA

**User stories**: 45-50

### What To Build

Update release-facing docs and create a manual QA checklist for the terminal behaviors that are intentionally not gated by pseudo-TTY or Docker E2E in this phase.

### Acceptance Criteria

- [ ] CLI README documents install/build, command list, examples, machine-output policy, and known limitations.
- [ ] Varlock README documents `bage` bin assumption and custom launcher behavior.
- [ ] Repository docs explain package roles without presenting legacy as releasable product.
- [ ] Manual QA checklist covers hidden passphrase prompt.
- [ ] Manual QA checklist covers editor launching and remembered editor preference.
- [ ] Manual QA checklist covers secure viewer scrolling and quit.
- [ ] Manual QA checklist covers interactive menu loop.
- [ ] Manual QA checklist covers clean stdout for `load` and `identity export`.
- [ ] Docs state Docker/pseudo-TTY E2E are deferred.
