# GRILL_ME_VARLOCK

## Round 1 - 2026-04-17

### Context

- Goal: make `better-age` work seamlessly with varlock.
- Target UX:
  - `varlock run something`
  - prompt for `better-age` passphrase
  - run `something` with envs incl decrypted secrets
- Chosen direction: varlock plugin, not builtin `exec()`.

### External constraints collected

- Varlock builtin `exec()` uses `child_process.exec()` and is not the right interactive bridge for passphrase prompting.
- Varlock supports local plugins from single files via `@plugin(./path/to/plugin.cjs)`.
- A varlock plugin can stay thin and shell out to a local CLI.

### Question 1

- Q: Should plugin target a dedicated machine command instead of generic `better-age read`?
- Recommended: yes.

### Outcome 1

- User leans yes.
- Current thinking:
  - stop exposing `read` as the real plaintext-output path
  - replace it with a clearer machine-facing command name, maybe `load`, `decrypt`, or `export`
  - optional `read` command could remain only as an educational guardrail that explains why plaintext read is discouraged and points to safer alternatives:
    - `inspect` for non-sensitive metadata
    - `edit` for human interaction
    - machine-facing command for process injection / plugin use

### Working takeaways

- Keep one source of truth for now: plugin calls local CLI.
- Avoid split `core / cli / plugin` for POC if it creates dual-implementation drift.
- Prefer a narrow machine contract over reusing a human-oriented command forever.

### Question 2

- Q: Should `bage load` allow interactive maintenance prompts like payload update, or only prompt for passphrase?
- Recommended: strict passphrase-only.

### Outcome 2

- User answer: yes, `load` should be strict.
- `load` may prompt for passphrase.
- `load` must not prompt for payload update.
- If update is needed, it should fail cleanly on `stderr` with remediation and non-zero exit.

### Additional outcome

- Keep an educational `read` command.
- `read` should act as a discoverability / guardrail path for users who naturally try it first.
- `read` should explain why plaintext reading is discouraged and point users to:
  - `inspect`
  - `edit`
  - `load`

### Question 3

- Q: When stale payload blocks `varlock run`, should recovery stop at `bage update <path>` or introduce extra helper commands?
- Recommended: for v0/PoC, stop at `bage update <path>`.

### Outcome 3

- User answer: for v0/PoC, stop at `bage update <path>`.
- No extra doctor/recovery abstraction yet.

### Question 4

- Q: Should plugin init optimize for common case and require only `path=.env.enc`, with optional `command=` override?
- Recommended: yes.

### Outcome 4

- User answer: yes.
- Planned plugin init shape:
  - common case: `@initBetterAge(path=.env.enc)`
  - optional advanced override: `command=...`
- `command` override exists mainly for local dev / monorepo / nonstandard invocation paths.

### Question 5

- Q: Support multiple plugin instances in v0, or single default instance only?
- Recommended: single default instance only for v0.

### Outcome 5

- User answer: single default instance only for v0.
- Plugin API should stay minimal and default-instance only for the first version.

### Question 6

- Q: Should the machine contract be explicitly versioned at the CLI boundary?
- Recommended: yes.

### Outcome 6

- User answer: yes.
- Plugin should call a versioned load protocol, eg `--protocol-version=1`.
- Contract mismatch should fail loudly.
- Failure UX should tell user to upgrade the plugin.

### Machine contract v1 candidate

- `stdout` = raw `.env` text only
- `stderr` = prompts, warnings, remediation, compatibility failures
- exit `0` on success
- non-zero on all failure cases
- no hidden mutation
- passphrase prompt allowed
- no payload update prompt

### Question 7

- Q: On protocol-version mismatch, who owns the primary compatibility error?
- Recommended: CLI primary, plugin secondary.

### Outcome 7

- User answer: accepted.
- Compatibility mismatch handling:
  - CLI should be the primary guard
  - plugin should add fallback/wrapper context when needed

### Question 8

- Q: In machine mode, allow passphrase/session caching between invocations, or reprompt every invocation?
- Recommended: reprompt every invocation for v0.

### Outcome 8

- User answer: reprompt every invocation.
- No session caching / daemon / unlock window in v0 machine mode.

### Question 9

- Q: Commit now to `load` as machine command name, or keep naming open?
- Recommended: commit to `load`.

### Outcome 9

- User answer: commit to `load`.
- Machine command name for now: `load`.

### Question 10

- Q: Should `load` require explicit path arg every time, or allow implicit default discovery?
- Recommended: require explicit path for v0.

### Outcome 10

- User answer: require explicit path for v0.
- `bage load` should require explicit payload path.

### Question 11

- Q: Should stale-payload stderr for `load` stay terse and command-oriented?
- Recommended: yes.

### Outcome 11

- User answer: accepted.
- Preferred stale error shape:
  - `Payload must be updated before load`
  - `Run: bage update .env.enc`

### Question 12

- Q: Should wrong-passphrase / decrypt failure be normalized in `load`?
- Recommended: yes.

### Outcome 12

- User answer:
  - `Failed to decrypt payload with provided passphrase`
- This is the preferred normalized decrypt failure message for machine mode.

### Question 13

- Q: For protocol-version mismatch, should stderr include direct plugin-upgrade remediation?
- Initial recommendation: yes.

### Outcome 13

- User wants clearer wording:
  - explain what is outdated
  - explain what should be updated
  - include most likely fix command
- Candidate remediation commands mentioned:
  - `npm -g install @better-age/cli@latest`
  - `npm install -D @better-age/varlock@latest`

### Tension discovered

- Current v0/PoC direction is local sidecar plugin file.
- If plugin remains local-file based, npm remediation commands would be misleading.
- Therefore compatibility error UX depends on distribution mode:
  - local sidecar plugin
  - published npm plugin package

### Refinement

- User clarification:
  - local-first remains the rollout plan
  - but compatibility/remediation UX should be designed for eventual released product, not only current local PoC
- Implication:
  - final error UX may need production-ready remediation paths
  - but source of truth for those remediation commands still needs a concrete ownership model

### Confusion point

- User is confused by CLI/plugin dependency relationship.

### Clarified model

- There are 2 layers, not 2 cores:
  - `better-age` CLI = source of truth for decrypt/load behavior
  - varlock plugin = adapter that invokes the CLI and converts result into varlock-compatible bulk env loading
- The plugin depends on the CLI contract.
- The CLI does **not** depend on the plugin.
- Therefore compatibility direction is one-way:
  - plugin must support the CLI machine contract version it calls
- Release reality later:
- npm plugin package may depend on a compatible CLI version range
- but behavior still remains: CLI owns load behavior, plugin owns varlock integration

### Question 16

- Q: Should final released architecture also keep CLI as source of truth and plugin as thin adapter, with no shared public core package?
- Recommended: yes.

### Outcome 16

- User answer: yes.
- Final intended architecture:
  - CLI remains source of truth
  - varlock plugin remains thin adapter
  - no shared public core package

### Question 17

- Q: If plugin cannot find the configured CLI command, should it fail hard or try fallback guesses?
- Recommended: fail hard.

### Outcome 17

- User answer: fail hard.
- Plugin should not guess alternate invocations.
- Failure should prompt user to install the CLI first.

### Question 18

- Q: Should plugin validate CLI compatibility eagerly at init, or lazily when load actually resolves?
- Initial recommendation: lazily on load.

### User constraint added

- Secret loading model is bulk-only, not per-key.
- Desired UX:
  - one passphrase prompt per `varlock run`
  - secrets loaded only once per varlock process/run
- Therefore plugin must avoid repeated subprocess decrypt calls within the same run.

### Clarification on "cache"

- User confusion: expected model is simply `load` -> stdout env blob -> plugin injects into varlock.
- Clarification:
  - "cache" here means only an in-memory variable inside the plugin instance during one `varlock` process
  - it is **not** persisted to disk
  - it is **not** remembered across separate `varlock run` invocations
  - it only prevents accidentally spawning `bage load` multiple times during the same run if varlock resolves the bulk loader more than once internally

### Question 19

- Q: Should plugin keep the first `load` result only in memory for the duration of the current `varlock run`, so CLI is called at most once per run?
- Recommended: yes.

### Outcome 19

- User answer: accepted.
- In-memory reuse is allowed only within one `varlock` process/run.
- Nothing should persist across separate runs.

### Question 20

- Q: Should plugin pass payload path only as explicit CLI arg, or also via env vars?
- Recommended: arg only for v0.

### Outcome 20

- User answer: arg only.
- Payload path should be passed only as explicit CLI arg in v0.

### Question 21

- Q: Should plugin add any custom data types / schema helpers in v0, or stay minimal?
- Recommended: stay minimal.

### Outcome 21

- User answer: minimal.
- Plugin surface for v0 should stay minimal:
  - `@initBetterAge(...)`
  - `betterAgeLoad()`

### Question 22

- Q: Should `command=` be raw shell string or structured binary-only path?
- Recommended: binary-only for v0.

### Outcome 22

- User answer: accepted.
- `command=` should be binary-only in v0.
- No free-form shell command parsing in plugin config.

### Question 23

- Q: Given binary-only `command=`, is it acceptable for local PoC to use a tiny shim/wrapper binary on PATH if install path is awkward?
- Recommended: yes.

### Outcome 23

- User answer: accepted.
- Local PoC may use a tiny shim/wrapper binary if needed.
- Product API should stay clean rather than absorb monorepo dev complexity.

### Question 24

- Q: Should `load` require an explicit protocol-version flag in addition to command name?
- Recommended: yes.

### Outcome 24

- User answer: accepted.
- `load` should require explicit protocol-version flag, eg `--protocol-version=1`.
- That flag is the guarantee boundary for strict machine behavior.

### Question 25

- Q: Should `load` be reserved as machine-only, or leave room for future human-facing `load` UX?
- Recommended: reserve `load` as machine-only.

### Outcome 25

- User answer: machine only.
- `load` should remain machine-only.

### Question 26

- Q: For eventual released product, should varlock integration ship as separate npm package, bundled into CLI, or remain local-file only?
- Recommended: separate npm package.

### Outcome 26

- User answer: separate npm package.
- Final release shape should use a dedicated npm package for varlock integration.

### Clarification on peerDependencies vs CLI install

- User asked whether `peerDependencies` works with global installs and `npx` usage.
- Verified conclusion:
  - `peerDependencies` expresses compatibility in an npm dependency tree, typically for plugins/host libraries.
  - It is not a reliable mechanism for asserting that a CLI executable exists on PATH.
  - It does not model users who only run the CLI via `npx` / `npm exec`.
  - Therefore `peerDependencies` is the wrong primary mechanism for requiring the `better-age` CLI.

### Packaging implication

- Prefer:
  - runtime CLI discovery + runtime compatibility check
  - documented install guidance for CLI
- Avoid:
  - relying on `peerDependencies` to guarantee CLI availability

### Question 27

- Q: Should the released plugin treat the CLI as a documented runtime requirement checked at runtime, not as a peer dependency?
- Recommended: yes.

### Outcome 27

- User answer: yes.
- Final packaging model:
  - plugin package separate
  - CLI separate runtime requirement
  - runtime compatibility check, not peer-dependency enforcement

### Question 28

- Q: For released product, should installed CLI binaries be the only officially supported invocation path, or should `npx` / `npm exec` style invocation also be supported?
- Initial recommendation: installed CLI only.

### Outcome 28

- User answer: would like to support `npx` / `npm exec` too.

### Tension discovered

- Earlier decision:
  - `command=` should be binary-only for v0
- New desire:
  - officially support `npx` / `npm exec`
- These conflict unless one of the following changes later:
  - plugin config model
  - wrapper/shim story
  - separate supported invocation modes for v0 vs released product

### Spec change

- User wants to change the earlier spec and allow custom command.
- Motivation: support `npx` / `npm exec` and similar invocation styles directly.

### Additional constraint

- User clarified realistic invocation modes are only:
  - global CLI install
  - local installed dependency via package-manager exec
  - ad hoc package-manager execution
- No broader arbitrary command use case was identified.

### Strong decision

- User explicitly wants custom command support.
- Directional debate is resolved:
  - plugin config must support custom command

### Question 31

- Q: Should custom command be modeled as shell string or argv-style structure?
- Recommended after user push: shell string.

### Outcome 31

- User answer: single string ok.
- `command=` should be a single string.

### Question 32

- Q: Should `command=` mean launcher prefix only, or full exact command owned by user?
- Recommended: launcher prefix only.

### Outcome 32

- User answer: yes, launcher prefix only.
- Plugin should append and own:
  - `load`
  - `--protocol-version=1`
  - explicit payload path

### Question 33

- Q: Should `command=` default to `better-age` when omitted, or be required explicitly?
- Recommended: default to `better-age`.

### Outcome 33

- User answer: yes.
- `command=` should default to `better-age` when omitted.

### Question 34

- Q: Given shell-string `command=`, should v0/PoC officially target Unix-like shells only first, or promise Windows too?
- Recommended: Unix-like only for v0/PoC.

### Outcome 34

- User answer:
  - Unix only
  - Windows not supported
  - WSL is fine because it is Unix-like

## Implementation Follow-up

### Phase 2 Outcome

- Added package scaffold at `packages/varlock`.
- Package export is `./plugin -> ./dist/plugin.cjs`.
- Added package-local `build`, `check`, and `test` scripts.
- Added placeholder plugin entry and package-shape tests.
- Validation passed:
  - `pnpm run build`
  - `pnpm run check`
  - `pnpm run test`

### Phase 3 Outcome

- Implemented minimal v0 plugin runtime.
- Registered:
  - `@initBetterAge(path=...)`
  - `betterAgeLoad()`
- Plugin now invokes:
  - `bage load --protocol-version=1 <path>`
- Runtime behavior:
  - default launcher only: `better-age`
  - one in-memory load promise per varlock process
  - hard failure if plugin used before init
  - hard failure with install remediation if CLI cannot start
- Added unit coverage for:
  - CLI invocation args
  - one-load-per-process reuse
  - missing init failure
  - command-start failure
  - decorator/resolver registration
  - init path validation
- Validation passed:
  - `pnpm run build`
  - `pnpm run check`
  - `pnpm run test`

### Next Intended Gate

- Manual QA before adding configurable `command=...`.

### Phase 5 Outcome

- Added `command=` support to `@initBetterAge(...)`.
- `command=` is a shell-string launcher prefix only.
- Plugin still appends and owns:
  - `load`
  - `--protocol-version=1`
  - explicit payload path
- Default launcher remains:
  - `better-age`
- Runtime now:
  - uses shell launch only when needed for launcher prefixes with spaces
  - includes configured launcher in command-start failures
  - distinguishes default-launcher install remediation from custom-launcher remediation
- Registration now rejects:
  - whitespace-only `path`
  - whitespace-only `command`
- Added tests covering:
  - custom launcher shell invocation
  - custom launcher start failure wording
  - optional `command` parsing
  - whitespace-only validation
