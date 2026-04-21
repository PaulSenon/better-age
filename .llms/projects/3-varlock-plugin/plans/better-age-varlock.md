# Plan: Better Secrets Varlock Plugin

> Source PRD: [VARLOCK_PRD.md](../1-VARLOCK_PRD.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Source of truth**: `better-age` CLI owns payload decryption and machine-safe plaintext export. The varlock plugin is a thin adapter only.
- **No shared public core**: do not introduce a public `core` package shared between CLI and plugin.
- **Machine command**: the machine-only command is `load`.
- **Load protocol**: plugin invokes `load --protocol-version=1 <path>`.
- **Machine semantics**:
  - `stdout` contains raw `.env` text only
  - `stderr` contains prompts, diagnostics, remediation, compatibility failures
  - non-zero exit on every failure
  - no hidden mutation
  - no update prompt
- **Educational command**: `read` remains user-facing guidance only and must not be the machine plaintext path anymore.
- **Plugin API**: minimal v0 surface:
  - `@initBetterAge(...)`
  - `betterAgeLoad()`
- **Plugin instance model**: single default instance only in v0.
- **Payload selection**: explicit payload path required. No cwd discovery in v0.
- **Launcher model**: plugin supports optional `command=` as a shell-string launcher prefix. Default is `better-age`. Plugin appends fixed `load` args itself.
- **Load frequency**: plugin may reuse the first successful or failed load result only in memory for the lifetime of one `varlock` process. Nothing persists across runs.
- **Packaging**:
  - PoC may use a local single-file plugin
  - released product should ship a separate npm plugin package
  - CLI is a separate runtime requirement checked at runtime
- **Platform**: Unix and WSL only for v0. Native Windows shells are out of scope.

---

## Phase 1: Freeze CLI Machine Contract

**User stories**: 5, 6, 7, 8, 9, 10, 11, 12, 13, 21, 22, 23, 30, 35

### What to build

Build the CLI contract first, before any plugin package work.

Add a machine-only `load` command that is explicitly designed for other tools to call. This phase must make the CLI contract stable enough that later plugin work can depend on it without guessing behavior.

This slice should:
- introduce `load` as the only machine-facing plaintext path
- require explicit payload path
- require `--protocol-version=1`
- allow passphrase prompting
- refuse payload update prompting
- normalize machine-facing failure messages
- reserve stdout strictly for raw `.env` payload output
- reserve stderr strictly for prompts and diagnostics
- turn `read` into an educational/discoverability command that explains why plaintext reading is discouraged and points users to `inspect`, `edit`, and `load`

This phase should also settle the internal CLI split:
- one module owning machine load policy and failure wording
- one module owning machine load orchestration
- one module owning educational `read` UX

### Implementation details

- Reuse the existing layered CLI architecture; do not bypass current app/use-case layers.
- Introduce a dedicated machine-load policy boundary so:
  - protocol version parsing
  - explicit path requirement
  - stdout/stderr discipline
  - failure normalization
  stay centralized and testable.
- Keep payload opening/decryption in the existing `better-age` application path rather than inventing a second decryption flow.
- Make stale payload handling in machine mode explicitly refuse interactive update and emit:
  - `Payload must be updated before load`
  - `Run: bage update <path>`
- Normalize decrypt failure to:
  - `Failed to decrypt payload with provided passphrase`
- Make `read` intentionally non-machine and educational:
  - no plaintext env stdout path
  - clear redirection toward `inspect`, `edit`, and `load`

### Acceptance criteria

- [ ] `bage load --protocol-version=1 <path>` succeeds with raw `.env` text on stdout only.
- [ ] `load` prompts for passphrase but never prompts for payload update.
- [ ] stale payload in `load` fails with terse remediation on stderr and non-zero exit.
- [ ] decrypt failure in `load` uses the normalized wording from the PRD.
- [ ] `read` no longer acts as the machine plaintext path and instead teaches safer alternatives.
- [ ] CLI tests cover stdout/stderr/exit-code behavior for `load` and `read`.

---

## Phase 2: Create Plugin Package Skeleton

**User stories**: 4, 25, 26, 27, 29, 35

### What to build

Create the new varlock integration package with no real secret-loading implementation yet.

This phase is intentionally about package shape and repo integration, not runtime behavior. The result should be a real package that mirrors the repo’s package standards closely enough that implementation can proceed inside it without later scaffolding churn.

This slice should:
- create the new package directory
- define package metadata for eventual separate release
- wire build, lint, typecheck, and test entrypoints
- choose the plugin export shape expected by varlock
- establish the minimal folder structure and package conventions
- include a placeholder plugin module that loads cleanly but does not yet implement the real runtime behavior

### Implementation details

- Mirror existing plugin-package conventions from the varlock ecosystem where useful, but keep naming and docs aligned to `better-age`.
- Package should be shaped for eventual publishability even if initial use is local-only.
- Keep the internal module split shallow at first but reserve clear ownership for:
  - plugin init config parsing
  - subprocess invocation
  - compatibility guard
  - per-run in-memory reuse
- Ensure the skeleton supports local-file plugin loading during development and the later npm package release path without redesigning package exports.
- Add basic placeholder tests that verify the package boots and exports a plugin entrypoint in the expected format.

### Acceptance criteria

- [ ] A new plugin package exists in the repo with build/lint/typecheck/test scripts wired.
- [ ] The package has a plugin entrypoint shaped for varlock plugin loading.
- [ ] The package can be built and referenced as a local plugin artifact even though runtime behavior is still placeholder.
- [ ] Package scaffolding follows existing repo/package conventions closely enough to avoid later structural rework.

---

## Phase 3: Implement Minimal Plugin V0

**User stories**: 1, 2, 3, 14, 15, 16, 18, 19, 27, 28, 32, 34, 35

### What to build

Implement the first end-to-end plugin version with as little logic as possible.

This is the first true integration slice. It should prove the whole flow works:
- varlock initializes the plugin
- plugin invokes the `better-age` CLI
- CLI prompts once for passphrase
- plugin captures stdout env text
- varlock injects the env text into the run

Keep this phase intentionally narrow:
- single default instance only
- no custom launcher prefix yet
- default command only: `better-age`
- local-file usage is acceptable for PoC

The point of this slice is to prove the CLI contract and adapter contract actually meet cleanly before adding configurability.

### Implementation details

- Register only:
  - `@initBetterAge(path=...)`
  - `betterAgeLoad()`
- `@initBetterAge(...)` should require explicit payload path and use default launcher prefix `better-age`.
- `betterAgeLoad()` should:
  - spawn the CLI once
  - append fixed suffix `load --protocol-version=1 <path>`
  - let stdin/stderr remain interactive/visible
  - capture stdout only
  - return raw `.env` text to varlock for `@setValuesBulk(..., format=env)`
- Add per-process in-memory reuse so repeated internal resolver evaluation does not trigger a second CLI invocation during one varlock run.
- Treat command start failures as hard failures with install/configure remediation.
- Do not add compatibility wrapping beyond the minimum needed to surface CLI errors clearly.

### Acceptance criteria

- [ ] A local-file plugin can be loaded by varlock and inject env text from `bage load`.
- [ ] The integration prompts for passphrase only once per varlock process/run.
- [ ] The plugin loads secrets at most once per varlock run even if the resolver is reached multiple times internally.
- [ ] Missing or unstartable CLI fails hard with install/configure remediation.
- [ ] The slice is demoable end-to-end with the default `better-age` launcher only.

---

## Phase 4: Manual QA Gate

**User stories**: 1, 2, 4, 14, 19, 30, 35

### What to build

Pause implementation changes and hand the minimal integration to the user for manual QA before adding configurability or more failure logic.

This phase exists to validate the real-world UX at the narrowest possible integration surface. The aim is to detect any mismatch between the CLI contract and actual varlock runtime behavior before complexity increases.

### Implementation details

- Prepare a short manual QA checklist focused on:
  - passphrase prompt visibility
  - stdout cleanliness
  - stderr readability
  - stale payload failure behavior
  - wrong-passphrase behavior
  - command-not-found behavior
  - one-prompt-per-run behavior
- Do not expand plugin configuration during this phase.
- Treat user feedback from this phase as a gate before moving to command configurability and broader compatibility UX.

### Acceptance criteria

- [ ] The user has manually exercised the minimal integration against real varlock runs.
- [ ] Any contract mismatches found during manual QA are resolved before new configurability is added.
- [ ] The minimal default-launcher integration is explicitly accepted as a base for further phases.

---

## Phase 5: Add Custom Launcher Prefix Support

**User stories**: 17, 18, 24, 31, 35

### What to build

Add the configurable launcher-prefix behavior after the default path has been manually validated.

This phase should widen invocation support without changing the core load protocol. Users should be able to choose alternate launcher styles while the plugin still owns the fixed `load` invocation suffix.

This slice should support the real launcher modes identified in design:
- global installed CLI
- local package-manager exec
- ad hoc package-manager execution

### Implementation details

- Extend `@initBetterAge(...)` with optional `command=` as a single shell-string launcher prefix.
- Keep `command=` semantics strict:
  - it is launcher prefix only
  - plugin still appends `load --protocol-version=1 <path>`
- Preserve the default when omitted:
  - `better-age`
- Keep Unix/WSL-only assumptions explicit in runtime validation and docs.
- Improve error reporting for malformed or failing launcher prefixes without weakening the load protocol.

### Acceptance criteria

- [ ] `command=` can override the default launcher prefix with a shell string.
- [ ] The plugin still owns and appends `load`, machine version, and explicit payload path.
- [ ] Global install, package-manager exec, and ad hoc launcher styles are verifiable through the same config surface.
- [ ] Default behavior remains unchanged when `command=` is omitted.

---

## Phase 6: Compatibility Guard And Release Surface

**User stories**: 20, 24, 25, 26, 29, 30, 34, 35

### What to build

Finish the integration by hardening runtime compatibility behavior and release-facing package/docs semantics.

This slice should make the feature ready for a final-user release story:
- runtime compatibility checks are clear
- plugin/CLI mismatch errors are explicit
- package shape matches intended release
- CLI runtime requirement is documented honestly
- local-file plugin path can still exist for internal/dev workflows

### Implementation details

- Keep compatibility ownership split:
  - CLI is primary guard for protocol-version mismatch
  - plugin adds secondary context when CLI output is missing or insufficient
- Make mismatch wording clear about what is outdated and what should be updated, without relying on fake peer-dependency guarantees.
- Document CLI as runtime requirement instead of trying to enforce it with peer dependencies.
- Finalize npm package metadata and release semantics for the separate plugin package.
- Ensure docs explain:
  - default launcher path
  - optional `command=`
  - Unix/WSL-only support
  - CLI install/runtime requirement
  - local plugin file usage for pre-release/dev

### Acceptance criteria

- [ ] CLI/plugin compatibility mismatches fail loudly with clear remediation.
- [ ] Release package semantics reflect a separate plugin package plus separate CLI runtime requirement.
- [ ] Documentation matches the real runtime contract and supported invocation modes.
- [ ] Local single-file plugin usage still remains possible for PoC/dev workflows.
