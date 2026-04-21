# Better Secrets Varlock Plugin PRD

## Problem Statement

`better-age` already solves encrypted-at-rest env payload storage, but its current plaintext read path is not a clean fit for `varlock run`.

The user wants this flow:
- run `varlock run <command>`
- get prompted once for the `better-age` passphrase
- run `<command>` with decrypted secrets injected as env vars

The current fallback approach of shelling through varlock builtin `exec()` is not the product direction. The real need is a first-class varlock integration that:
- uses `better-age` as the source of truth for decryption
- keeps plaintext on stdout only in a machine-safe path
- keeps mutation explicit
- avoids a second core implementation

The problem is not "build another secrets core inside a plugin". The problem is:
- define a machine-safe `load` contract in the CLI
- build a thin varlock adapter around that contract
- make installation and compatibility understandable for final users

## Solution

Introduce a dedicated varlock integration package for `better-age`, eventually released as a separate npm package, that acts as a thin adapter over the `better-age` CLI.

The integration is built around a new machine-only CLI command:
- `bage load --protocol-version=1 <path>`

`load` becomes the only supported machine-facing plaintext operation:
- explicit payload path required
- passphrase prompt allowed
- no payload update prompt
- no hidden mutation
- raw `.env` text only on stdout
- diagnostics and remediation only on stderr
- non-zero exit on every failure

The varlock plugin:
- registers a minimal integration surface
  - `@initBetterAge(...)`
  - `betterAgeLoad()`
- invokes the CLI through a configurable launcher prefix
- appends fixed `load` arguments itself
- loads secrets once per varlock process
- injects the returned `.env` text with `@setValuesBulk(..., format=env)`

The integration remains honest:
- CLI remains source of truth
- plugin is adapter only
- no public shared core package
- no Windows support in v0
- no automatic recovery/update workflow inside machine mode

## User Stories

1. As a developer, I want `varlock run` to prompt me once for my `better-age` passphrase, so that I can use encrypted env payloads in normal command execution.
2. As a developer, I want the varlock integration to bulk load all secrets at once, so that the plugin does not decrypt per key.
3. As a developer, I want the plugin to call the local `better-age` CLI instead of reimplementing decryption logic, so that there is only one source of truth.
4. As a developer, I want the plugin to remain thin, so that compatibility and debugging stay understandable.
5. As a developer, I want the CLI to expose a machine-only `load` command, so that plaintext output is clearly separated from human-facing workflows.
6. As a developer, I want `load` to require an explicit payload path, so that machine invocations are deterministic and do not guess files.
7. As a developer, I want `load` to require a protocol version flag, so that plugin and CLI compatibility failures are explicit.
8. As a developer, I want `load` to print only raw `.env` text to stdout, so that varlock can safely ingest the result.
9. As a developer, I want `load` to keep prompts and remediation on stderr, so that stdout stays machine-safe.
10. As a developer, I want `load` to allow passphrase prompting, so that my local encrypted key remains protected by interactive unlock.
11. As a developer, I want `load` to never prompt for payload update, so that `varlock run` does not unexpectedly enter a second maintenance workflow.
12. As a developer, I want stale payloads to fail with a short remediation message, so that I know to run `bage update <path>`.
13. As a developer, I want decrypt failures to use a stable user-facing message, so that plugin passthrough remains understandable.
14. As a developer, I want the plugin to load secrets at most once per varlock run, so that I am not reprompted because of internal resolution duplication.
15. As a developer, I want nothing cached across separate varlock runs, so that each invocation remains explicit and predictable.
16. As a developer, I want the plugin to default to `better-age` when no custom command is configured, so that normal installs stay simple.
17. As a developer, I want to override the launcher prefix with a single string, so that I can support global install, package-manager exec, or ad hoc execution.
18. As a developer, I want the launcher prefix to remain only a prefix, so that the plugin still owns `load`, machine version, and payload path arguments.
19. As a developer, I want the plugin to fail hard if the CLI command cannot be started, so that I immediately know I need to install or configure the CLI.
20. As a developer, I want compatibility mismatches between plugin and CLI to fail loudly, so that I do not get silent protocol drift.
21. As a developer, I want the educational `read` command to stay discoverable, so that newcomers who try to “read secrets” are guided toward safer commands.
22. As a developer, I want `read` to teach rather than dump plaintext, so that discoverability and safety can both improve.
23. As a maintainer, I want the protocol version to be owned by the CLI contract, so that the plugin can adapt without inventing a second core boundary.
24. As a maintainer, I want runtime compatibility checks instead of peer-dependency tricks, so that global CLI installs and `npx`-style usage can still be supported.
25. As a maintainer, I want the released varlock integration to ship as a separate npm package, so that varlock concerns can evolve without polluting the CLI package shape.
26. As a maintainer, I want the CLI to remain a separate runtime requirement, so that the package model matches runtime reality.
27. As a maintainer, I want the plugin API to stay minimal in v0, so that docs and support burden stay narrow.
28. As a maintainer, I want the initial plugin to support only one payload instance, so that the first version solves the core use case cleanly.
29. As a maintainer, I want Unix and WSL only in v0, so that shell-string launcher support does not immediately expand into Windows quoting complexity.
30. As a maintainer, I want failure messages to be terse and command-oriented, so that users see clear remediation during `varlock run`.
31. As a maintainer, I want installation guidance to reflect real invocation modes, so that users can choose global install, package-manager exec, or ad hoc execution.
32. As a maintainer, I want the plugin to integrate through bulk env injection only, so that it aligns with varlock’s strongest fit for this workflow.
33. As a maintainer, I want the implementation split to deepen existing boundaries instead of creating another public shared core package, so that architecture remains honest.
34. As a maintainer, I want the plugin package to depend on a stable load protocol rather than on internal module imports, so that CLI evolution stays manageable.
35. As a maintainer, I want the PRD to freeze the v0 integration semantics clearly, so that later polish does not accidentally drift the runtime contract.

## Implementation Decisions

- Keep `better-age` CLI as the only source of truth for payload decryption and machine-safe plaintext export.
- Do not introduce a public shared `core` package between CLI and varlock integration.
- Add a new machine-only CLI command named `load`.
- Keep `read` as an educational/discoverability command rather than the machine-facing plaintext path.
- Freeze the first load protocol around:
  - `load`
  - `--protocol-version=1`
  - explicit payload path
  - stdout-only `.env` payload on success
  - stderr-only prompts and remediation
  - non-zero exit on failure
  - no hidden mutation
  - no update prompt
- Require explicit path for `load` in v0. No cwd payload discovery.
- Normalize machine-facing decrypt failure wording to:
  - `Failed to decrypt payload with provided passphrase`
- Normalize stale-payload machine failure wording to:
  - `Payload must be updated before load`
  - `Run: bage update <path>`
- Keep passphrase prompting interactive in `load`.
- Do not add session caching or daemon-style unlock windows in machine mode.
- Allow only in-memory per-process reuse inside the plugin to ensure one decrypt max per varlock process.
- Keep the varlock plugin surface minimal:
  - one root decorator for initialization
  - one bulk-loading resolver function
- Keep plugin instance model single-default only for v0.
- The initialization surface should include:
  - required payload path
  - optional launcher prefix string
- Default launcher prefix to `better-age`.
- Interpret launcher prefix as shell string prefix only; the plugin must append:
  - `load`
  - `--protocol-version=1`
  - explicit payload path
- Support these real launcher styles through the prefix model:
  - global installed CLI
  - local package-manager exec
  - ad hoc package-manager execution
- Treat missing/unstartable CLI as hard failure with install/configure remediation.
- Treat plugin/CLI compatibility as a runtime concern, not a `peerDependencies` concern.
- Plan the released integration as a separate npm package, while still allowing local single-file plugin usage during PoC or pre-release workflows.
- Keep Unix-like shells as the supported execution environment in v0. WSL counts as supported because it is Unix-like. Native Windows shells are out of scope.

### Major modules to build or deepen

- **Load Protocol Contract**
  - Owns the exact `load` command semantics, protocol-version parsing, stdout/stderr discipline, and stable failure wording.
  - Deep module because the plugin and future integrations should depend on one compact CLI contract rather than on scattered command logic.

- **Machine Load Flow**
  - Owns passphrase prompting, payload opening, update-preflight refusal, and raw `.env` emission for machine mode.
  - Deep module because it centralizes all machine-facing plaintext behavior behind one command.

- **Educational Read Flow**
  - Owns the safe/discouraging user-facing explanation for `read` and the routing toward `inspect`, `edit`, and `load`.
  - Deep module because it separates discoverability policy from the load protocol.

- **Varlock Plugin Runtime**
  - Owns plugin initialization, launcher-prefix execution, in-memory per-run reuse, process spawning, stdout capture, stderr passthrough, and varlock-facing error wrapping.
  - Deep module because varlock-specific orchestration should stay isolated from CLI product logic.

- **Compatibility Guard**
  - Owns protocol-version mismatch detection and the split responsibility between CLI-primary and plugin-secondary compatibility failures.
  - Deep module because it keeps version drift and remediation policy coherent across release modes.

## Testing Decisions

- Good tests must assert external behavior, not implementation details.
- Good tests for this feature should focus on:
  - exact stdout/stderr contract
  - exit-code behavior
  - single-load-per-run behavior
  - launcher-prefix behavior
  - compatibility mismatch behavior
  - stale/update refusal behavior
  - passphrase prompt behavior at the machine boundary

Modules/behaviors that should be tested:
- `load` success path with raw `.env` stdout only
- `load` stale payload refusal path
- `load` bad passphrase failure wording
- `load` protocol-version validation and mismatch failure
- `read` educational guardrail behavior
- plugin initialization defaults
- launcher prefix default vs custom prefix invocation
- one-load-per-process reuse in the plugin
- CLI missing/unstartable failure path
- stderr passthrough without stdout contamination
- varlock bulk injection compatibility using env format

Prior art in the codebase:
- existing CLI command tests already assert stdout/stderr behavior and prompt calls
- existing use-case and integration tests establish the layered `better-age` testing style
- existing varlock plugin ecosystem demonstrates plugin package structure and resolver patterns, but this PRD should test the `better-age` contract first and the varlock adapter second

Expected test layers:
- unit tests for machine-load policy and compatibility decision logic
- CLI command tests for visible `load` and educational `read` behavior
- plugin package tests for invocation construction and per-run reuse semantics
- black-box integration tests covering a real CLI invocation through the plugin boundary

## Out of Scope

- native Windows support
- multiple payload/plugin instances
- per-key secret resolution
- hidden payload updates during `load`
- session caching across runs
- daemon/unlock-window behavior
- public shared core package between CLI and plugin
- broader plugin-specific data types or varlock schema surface
- payload path autodiscovery
- JSON machine output
- plugin-owned secret decryption logic
- automatic install of the CLI by the plugin
- peer-dependency enforcement of CLI presence
- non-varlock integrations in this PRD

## Further Notes

- This PRD intentionally specifies both the CLI contract and the plugin package because the plugin cannot be designed correctly without freezing the `load` boundary.
- The product goal is not “support every shell invocation elegantly.” The goal is to support the real invocation modes users need while keeping the plugin thin and the CLI authoritative.
- The local-file plugin path remains useful for PoC and internal testing, but the released product shape should still be a separate npm package.
- The decisions in `GRILL_ME_VARLOCK.md` should be treated as rationale history. This PRD is the product/implementation planning artifact for the varlock integration.
