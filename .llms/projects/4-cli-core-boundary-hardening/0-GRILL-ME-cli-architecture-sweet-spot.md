# Grill Log: CLI Architecture Sweet Spot

## Session Start

### User
Just finished the `age`-based CLI MVP. Wants deeper analysis before deciding what to do next. Main concerns raised:
- current CLI output too rough/plain
- wants basic, readable, professional CLI UX, not full TUI
- wonders about splitting current package into `core` + `cli`
- current Effect + DDD result feels too verbose for a small wrapper
- wants simple, elegant, maintainable, easy to onboard

### Assistant
Initial repo/doc/codebase analysis:
- repo already split at package level into `@better-age/cli` and `@better-age/varlock`
- inside `packages/cli`, structure is already onion-like: `domain`, `app`, `port`, `infra`, `cli`
- real issue appears to be boundary leakage and adapter verbosity, not lack of any architecture
- recommended against full rewrite-from-scratch
- recommended private internal `core` first, not public SDK
- recommended lightweight CLI presentation layer using native Node `util.styleText` / TTY-aware output, not a TUI framework

### User
Agreed private internal core sounds right. Also wants cleanup on error handling but is worried about regressions.

### Assistant
Proposed rough plan:
1. freeze behavior with CLI contract tests
2. add tiny presentation layer
3. push shell concerns out of app/core
4. extract internal `core` after seams are real
5. reduce verbosity where useful, especially command-level error mapping
6. refactor slice-by-slice, not big bang

### User
New concerns / clarifications:
- discussion should stay at architecture layer for now
- wants this first-level exploration logged
- suspects exact-vs-guided dual mode may be causing complexity churn
- current behavior:
  - exact invocation when all args provided
  - guided fallback when args missing and terminal interactive
  - hard fail in headless mode
  - full interactive menu loop via `interactive` command
- UX is a core differentiator and should not be cheapened
- wants all actions abstracted in core with solid interfaces, contextualized differently for interactive/headless/exact CLI contexts

## Current Assistant Position

- Likely target is **at least 3 concerns**, but not necessarily 3 publishable packages:
  1. core application/domain
  2. CLI interaction shell
  3. varlock plugin adapter
- However, the more important split is **behavioral**, not package-count:
  - pure action core
  - invocation policy / interaction orchestration
  - output presentation
- Main design pressure now is not package extraction itself.
- Main design pressure is whether guided/exact/interactive should be:
  - three separate surfaces over one action core
  - or a shared orchestrator abstraction with pluggable interaction policies

## Open Top-Level Decision To Resolve Next

How many first-class execution surfaces should the architecture recognize?

Current candidate model:
1. `action core`
2. `exact CLI surface`
3. `guided CLI surface`
4. `interactive menu shell`
5. `machine/plugin surface`

Need to decide whether guided fallback is:
- a property of command invocation only
- or a first-class interaction runtime in the architecture

## Append

### User
Corrected an ambiguity: "3" referred to **phases to reach the target**, not package count.

Confirmed:
- `3` packages / subprojects may still be right eventually
- `4` logical layers also sounds right

Strong requirement clarified:
- core should behave like an internal SDK/API
- core actions must take explicit inputs and return exact outputs/errors
- non-exact CLI invocations should gather missing information outside the core
- guided CLI may ask the core for query data needed to build interaction flows
- example given for `grant`:
  - CLI notices missing path / recipient
  - if interactive, it gathers options such as files in cwd and known identities
  - user picks path / identity or enters custom values
  - CLI then calls one exact core `grant` action with all params
  - open question remains around passphrase timing and whether one logical action may require multi-turn CLI/core exchange

### Assistant
Course correction:
- phase planning is now the active top-level track
- package extraction is secondary and later
- confirmed architectural direction:
  - exact/guided/interactive are different surfaces over one explicit action core
  - core should not own missing-arg resolution
  - next branch to resolve is which queries belong to core vs CLI-side shell helpers, especially payload discovery and passphrase choreography

### User
Clarified passphrase concern:
- asking for passphrase too early would create friction if later steps fail for unrelated reasons
- likely better to ask for passphrase at the end, after non-secret resolution is done
- if passphrase then fails, the action may still fail for many exact reasons:
  - wrong passphrase
  - unauthorized for payload
  - missing file
  - invalid file content
  - write failure
  - self-grant forbidden
  - invalid identity string
  - ambiguous identity name
- user is okay with exceptional two-phase command shape if it improves design
- confirmed:
  - keep `core commands`
  - keep `core queries`
  - keep `cli interaction`
  - keep `cli presentation`
  - keep `plugin adapter`
  - keep payload discovery in CLI only
- requested next step:
  - write a spec-only TypeScript API file defining IO contracts for the layers

### Assistant
Drafted spec file:
- `.llms/projects/4-cli-core-boundary-hardening/1-BOUNDARY_API_SPEC.ts`

Current draft decisions:
- core split into explicit commands and read-only queries
- shell-only cwd payload discovery stays outside core
- passphrase-bound payload mutations use `prepare -> execute`
- prepare step validates non-secret inputs first
- execute step performs decrypt/mutate/write and can fail with exact secret/payload reasons
- CLI interaction owns prompt timing, retry policy, back/cancel, and menu loops
- presentation is a separate message-id renderer and does not own machine contracts

Next unresolved branch:
- whether `prepare -> execute` should be limited to payload mutations only
- or generalized into a broader pattern for any action with expensive late validation

### User
Validated the two-step pattern when secret validation is needed after non-secret context validation, but wants the pattern tightly scoped to avoid overuse.

Raised 2 key challenges against the draft:
1. does the draft really reflect 100% of the intended specs and behavior?
2. where does artifact schema migration sit in the boundary model?

Specific migration concerns raised:
- `Home State` migration is auto-applied and persisted, but CLI may still want to inform the user on stderr
- payload reads may succeed through in-memory migration while still needing to warn/remediate
- payload writes may need explicit persisted update and interactive flow decisions
- current success/error model did not yet explain how to return "success + side info"

### Assistant
Checked migration docs and code:
- artifact spec confirms:
  - home uses global persisted preflight
  - payload reads may use in-memory migration
  - payload writes require explicit persisted update boundary
- current code confirms:
  - `HomeStatePreflight` runs before command logic
  - `OpenPayload` normalizes payload to current runtime shape and computes update-needed state

Spec correction made:
- added explicit `CoreNotice` channel
- added `CoreResponse<{result, notices}>` wrapper
- added `BetterAgeCoreLifecycle.runHomeStatePreflight()`
- added semantic notices for:
  - managed home auto-migrated
  - payload read used in-memory migration
  - payload update recommended
- updated payload reads/inspections and payload mutation executes to return notices alongside exact result/failure

Current architectural position:
- success/failure remains exclusive
- side-info is modeled orthogonally as notices
- migration policy now has a proper boundary location in the draft

### User
Raised a new design concern:
- maybe `notices` could be abstracted via a logging system rather than returned explicitly
- wants to avoid hand-building arrays of side-info in core
- suspects Effect / OpenTelemetry may already support convenient structured logging

Also clarified desired boundary further:
- core API should not mirror CLI commands
- `interactive` is pure CLI
- `view` and `load` should likely be two CLI surfaces over one core `readPayload`
- this clearer mismatch between core actions and CLI commands is considered important for a clean boundary

### Assistant
Position after checking official observability docs:
- observability logs are the wrong carrier for semantic product notices
- logs are observational / sink-dependent / filtered by runtime configuration
- semantic notices are part of the product contract and may influence CLI UX and tests
- therefore:
  - if information affects user-visible behavior or stable CLI output, keep it as typed core notice
  - if information is only diagnostic/operational, emit it as logs
- recommended compromise:
  - keep typed `notices` in core responses
  - optionally mirror important notices to Effect/OTel logs in adapters

Additional architectural clarification:
- yes, core API should be more domain-shaped than CLI-shaped
- `view` and `load` should be CLI interaction/presentation differences over shared core read behavior

### User
Confirmed the recommended constraint:
- typed `notices` should stay very small and semantic only
- no generic info/debug chatter in the notice channel

### Assistant
Decision locked:
- `notices` are product-contract side-info only
- logs remain separate observability output

### Assistant
Proposed next boundary:
- one domain-shaped core `readPayload` returning raw `envText`
- `view` and `load` become different outer adapters over the same read result

### User
Confirmed.

### Assistant
Decision locked:
- core keeps one `readPayload`
- core does not split human-view vs machine-load concerns

### Assistant
Proposed write-side choice:
- avoid a generic `writePayload`
- keep explicit payload mutations as domain actions inside core

### User
Confirmed:
- keep
  - `editPayload`
  - `grantPayloadRecipient`
  - `revokePayloadRecipient`
  - `updatePayload`
- domain logic stays in core

### Assistant
Decision locked:
- no generic payload write primitive in the public core API
- explicit payload mutations remain first-class core commands

### Assistant
Proposed home-query choice:
- keep `listKnownIdentities` and `getSelfIdentity` as separate core queries
- avoid a broad `inspectHomeState` blob query

### User
Confirmed: keep separate.

### Assistant
Decision locked:
- home-facing read queries stay small and explicit

### Assistant
Proposed identity-resolution choice:
- core exposes one exact `resolveKnownIdentity(reference)` query
- CLI does not reimplement alias / handle / display-name matching rules

### User
Confirmed: yes.

### Assistant
Decision locked:
- identity resolution order and ambiguity behavior belong to core

### Assistant
Proposed passphrase policy:
- passphrase retry / cancel / retry count belong entirely to CLI interaction
- core stays one-shot and exact, returning failures such as `PASSPHRASE_INCORRECT`

### User
Confirmed: yes.

### Assistant
Decision locked:
- passphrase retry policy is CLI-owned, not core-owned

### User
Raised identity-boundary question:
- identity exists in multiple forms:
  - public identity representation
  - derived/internal resolved representation
  - user-facing references:
    - local alias
    - display name
    - handle
    - identity string
- asked whether core APIs should broadly accept flexible identity references
- or whether CLI should always resolve first, then call strict core methods with one exact identity value

### Assistant
Called out terminology drift:
- `internal identity object` is too fuzzy against current glossary
- the real candidates are:
  - `Public Identity Snapshot`
  - `Resolved Known Identity`
  - `Owner Id`

Current position:
- commands should prefer strict identity inputs
- flexible user-facing references belong in dedicated core resolution/parsing queries, not in every mutation command signature
- import is the main exception where `Identity String` is itself the command input

### User
Pushed the identity flow further:
- from CLI side, passing only `Owner Id` feels right for known identities
- but real-case mapping is still unclear
- worried a too-strict contract could imply that payload identities must become known before grant is possible
- noted revoke is different because candidate identities come from the payload itself, so decrypt/inspect must happen first

Also raised a separate ownership question:
- maybe payload file read/write should belong to CLI and core should only receive encrypted content instead of a path

### Assistant
Current clarification:
- the assumption "all payload identities must be known before grant" conflicts with the current domain docs
- payload recipients, identity strings, and known identities share one canonical `Public Identity Snapshot`
- therefore grant likely needs a strict recipient target union, not only `Owner Id`
- revoke likely stays `Owner Id`-based after payload inspection
- payload file IO ownership remains a separate unresolved branch after identity-target modeling

### Assistant
Proposed clarification:
- `grantPayloadRecipient` should accept a strict target union:
  - known identity by `Owner Id`
  - external identity by `Public Identity Snapshot`
- `revokePayloadRecipient` should accept strict `Owner Id` only
- payload file repository IO should stay in core application layer once exact path is known
- CLI should own cwd discovery and interaction only

### User
Confirmed all of the above.

### Assistant
Decision locked:
- grant accepts strict known-or-public identity target union
- revoke accepts strict `Owner Id`
- payload file IO stays core-owned behind ports
- CLI owns shell discovery, prompting, and flow only

### User
Asked why the model still uses both `Owner Id` and `Public Identity Snapshot` instead of always using the snapshot.

Also asked why external grant identities are modeled as `Public Identity Snapshot` rather than raw `Identity String`.

### Assistant
Current clarification:
- `Identity String` is only one encoding of the canonical public identity shape
- it should be parsed first through a core query into `Public Identity Snapshot`
- command-side inputs stay strict and encoding-free
- `Owner Id` and `Public Identity Snapshot` are both kept because they express different exact intents:
  - `Owner Id`: stable identity continuity key when the system already knows the identity
  - `Public Identity Snapshot`: exact public data required when granting an external identity directly
- revoke stays `Owner Id`-based because removing access is keyed by identity continuity, not by supplying a public snapshot again

### User
Requested the spec to become more exhaustive:
- cover the full feature surface
- scope responsibilities explicitly by package and by layer
- list error kinds, notice kinds, and warning kinds explicitly

### Assistant
Spec overhaul performed:
- rewrote `1-BOUNDARY_API_SPEC.ts`
- made package/layer map explicit for:
  - `@better-age/core`
  - `@better-age/cli`
  - `@better-age/varlock`
- added explicit core port ownership showing payload file IO remains core-owned behind path-based repository ports
- expanded query/command API to cover current feature surface more completely
- added explicit error-code groups
- added explicit notice model with levels
- added explicit CLI human message kinds and message-id groups

Important simplification introduced:
- once query-side identity parsing/resolution and payload inspection are explicit,
  most dedicated `prepare -> execute` command pairs become unnecessary
- current spec now prefers:
  - read/resolve/inspect queries first
  - then one-shot strict commands
- this reduces API ceremony while preserving the same UX capabilities in CLI interaction flows

### Assistant
Recovered continuation context from persisted grill log + current spec + shipped CLI command surface.

New concrete gap found:
- core API spec is close to full-surface
- but `@better-age/cli :: interaction` only exposes:
  - `runGrantFlow`
  - `runRevokeFlow`
  - `runEditFlow`
  - `runInteractiveSession`
- shipped CLI surface is broader:
  - `setup`
  - `me`
  - `add-identity`
  - `forget-identity`
  - `identities`
  - `rotate`
  - `change-passphrase`
  - `create`
  - `inspect`
  - `view`
  - `edit`
  - `grant`
  - `revoke`
  - `update`
  - `load`

Next missing branch:
- is `interaction` meant to model only shared guided/high-friction flows
- or the full CLI use-case layer, including thin exact commands too

Current recommendation:
- keep `interaction` narrow
- let `shell/commands` directly adapt thin exact commands to core + presenter
- use `interaction/flows` only where there is real orchestration:
  - guided resolution
  - retries
  - back/cancel loops
  - editor/session choreography

Reason:
- avoids fake abstraction for thin commands like `me`, `identities`, `load`
- matches the declared package split already in the spec
- keeps “interaction” meaningfully about control-flow, not every command adapter

### User
Corrected scope again:
- current phase is pure specification under `.llms/projects/4-cli-core-boundary-hardening`
- wants ADR spec file
- wants exhaustive invocation matrix if it makes sense
- does **not** want tests or implementation work yet
- wants any TS artifacts to stay spec-only and live in the project spec folder
- wants grilling to continue toward 100% boundary coverage

### Assistant
Course correction locked:
- ADR + invocation matrix are spec artifacts only for now
- no implementation/test planning in this branch
- next spec gap identified in `1-BOUNDARY_API_SPEC.ts`:
  - current `InvocationKind` mixes orthogonal concerns (`exact|guided` with `interactive-session|machine`)
  - recommended split into separate dimensions before drafting exhaustive matrix:
    - `InvocationShape`
    - `InvocationSurface`
    - `TerminalCapability`

### User
Clarified the invocation matrix branch was already settled earlier:
- compose with 2 axes only
  - invocation mode: `direct | guided`
  - terminal mode: `interactive | headless`
- behaviors should derive from that matrix
- called out assistant for reopening an already-settled branch

### Assistant
Accepted correction:
- previous proposal to re-split invocation context was redundant noise
- lock matrix basis to exactly 2 axes for now:
  - `invocation mode`
  - `terminal mode`
- next grilling branch should build on that settled basis, not revisit it

### User
Confirmed next CLI spec shape:
- `1-BOUNDARY_API_SPEC.ts` should represent both:
  - full CLI command surface
  - reusable shared CLI flows
- but they must stay separated

### Assistant
Locked:
- add separate command-level and shared-flow-level CLI interfaces to the boundary spec
- next branch to resolve: whether command interfaces model raw argv/program parsing, or normalized command handlers after parse/validation

### User
Pushed back on command-outcome discussion:
- noted core already has `success/error + notices`
- said assistant had shifted too far from initial framing and become hard to follow
- asked whether proposed CLI behavioral spec is different from that existing result model

### Assistant
Reset layer distinction:
- `core result/notices` and `CLI invocation matrix` are separate artifacts, not alternatives
- core contract stays semantic/domain-oriented
- CLI matrix remains shell policy for prompting/headless/output-channel behavior
- next step is to keep those two concerns cleanly separated while continuing the spec grilling

### User
Asked for a concrete example because the distinction still felt unclear, especially around why core would be affected by CLI invocation policy at all.

### Assistant
Clarified that core is **not** affected by invocation/terminal policy.
Planned to answer with side-by-side examples:
- core API contract
- separate CLI invocation matrix/policy artifact
- same core result feeding different CLI behaviors (`view` vs `load`, `grant` exact vs guided)

### User
Confirmed sequencing:
- fully enumerate all CLI commands in `1-BOUNDARY_API_SPEC.ts` now before matrix/ADR

### Assistant
Locked next sequencing step:
- finish command inventory in API spec first
- next branch to resolve is naming:
  - CLI command interfaces should likely use user-visible command names
  - core remains semantic/domain-shaped
  - example: CLI `runAddIdentityCommand` -> core `importIdentityString`

### Assistant
Grounded naming review after inspecting current command semantics:
- most command names are already strong and should likely stay
- likely keep: `setup`, `interactive`, `me`, `identities`, `create`, `edit`, `grant`, `revoke`, `inspect`, `view`, `load`, `update`, `change-passphrase`
- only names that look plausibly worth changing before lock-in:
  - `add-identity` (because semantics are really import)
  - `forget-identity` (because paired naming may want to mirror import)
  - `rotate` (only if wanting future-proof explicitness like `rotate-identity`)

### User
Proposed a hybrid CLI tree to avoid hyphen-heavy multi-word root commands while making local-vs-file boundaries explicit.

Candidate direction:
- keep payload/file work as short root verbs
- group local identity/address-book work under `identity`
- keep `interactive` at root

Confirmed preference after review:
- root payload verbs: `create`, `edit`, `grant`, `revoke`, `inspect`, `view`, `load`, `update`
- grouped identity verbs: `identity setup`, `identity export`, `identity list`, `identity import`, `identity forget`, `identity rotate`, `identity passphrase`
- root `interactive` stays

### Assistant
Persisted this command language into `UBIQUITOUS_LANGUAGE.md` as canonical terminology.
This is now the preferred CLI vocabulary for the boundary spec phase.

### User
Confirmed another naming/boundary preference:
- internal code may use resource-prefixed command names even if user-facing CLI stays short
- example accepted: `runFileCreateCommand`
- asked to persist this and the command-to-core mapping in specs

### Assistant
Persisted in `1-BOUNDARY_API_SPEC.ts`:
- internal CLI command interfaces now use resource prefixes:
  - `runFile*Command`
  - `runIdentity*Command`
  - `runInteractiveCommand`
- shared CLI flows now use resource-prefixed names where command-scoped
- added explicit CLI-command-to-core mapping table
- kept user-facing CLI vocabulary separate from internal interface naming

### User
Accepted lower reusable shell flows as first-class shared-flow interfaces.
Also changed command language in one last pass:
- `setup` should stay root-level, not under `identity`
- wanted aliases persisted:
  - `interactive` => `i`
  - `identity passphrase` => `pw` and `pass`

### Assistant
Persisted in specs:
- `UBIQUITOUS_LANGUAGE.md`
  - root `setup`
  - `interactive` alias `i`
  - `identity passphrase` aliases `pw` / `pass`
- `1-BOUNDARY_API_SPEC.ts`
  - `runSetupCommand()` moved to root command surface
  - added `CLI_COMMAND_ALIASES`
  - expanded `BetterAgeCliSharedFlows` with lower reusable shell flows:
    - file payload target resolution
    - identity reference resolution
    - identity string resolution
    - passphrase retry
    - setup gate
    - file update gate

### User
Confirmed 2 more reusable shell flows should be first-class too:
- passphrase pair confirmation
- editor resolution

### Assistant
Persisted in `1-BOUNDARY_API_SPEC.ts` by extending `BetterAgeCliSharedFlows` with:
- `runPassphrasePairConfirmationFlow`
- `runEditorResolutionFlow`

### User
Accepted grouping shared flows, with one condition:
- each kind must have a clear definition

### Assistant
Persisted grouped shared-flow taxonomy in `1-BOUNDARY_API_SPEC.ts`:
- `BetterAgeCliResolverFlows`
- `BetterAgeCliGateFlows`
- `BetterAgeCliCompositeFlows`
- `BetterAgeCliSessionFlows`
- aggregate `BetterAgeCliSharedFlows`

Each now has explicit semantic definition comments to prevent drift.

### User
Agreed that generic `{ kind: "done" | "back" | "cancel" }` was weird.
Clarified the deeper concern:
- `back` / `cancel` belong to CLI-only navigation and menu/router control
- they are not core semantic results and should not be confused with them
- wanted naming that makes this explicit and avoids future confusion

### Assistant
Locked CLI-only flow-control protocol naming:
- introduced `CliFlow*` signal types in `1-BOUNDARY_API_SPEC.ts`
- added explicit comment that they are shell-internal navigation/orchestration protocol values
- not core results, not user-facing messages, not product outcomes
- settled on:
  - shared generic signals: `CliFlowBack`, `CliFlowCancel`
  - specialized signals: `CliFlowResolved<T>`, `CliFlowProceed`, `CliFlowRetry`, `CliFlowUpdateNow`, `CliFlowCompleted`
- replaced old generic `CliFlowOutcome` usage with these more explicit signal types

### User
Recovered after lost conversation context.

Restated current target:
- rethink CLI/core boundary without implementation changes yet
- make architecture less verbose, more elegant, and easier to onboard
- keep append-only grill log for compaction survival
- clean `.llms/projects/4-cli-core-boundary-hardening`
- trash outdated docs
- continue domain-model grilling toward:
  - 100% API contracts between layers
  - 100% meaningful feature coverage under new command API
  - 100% error kind specification
  - 100% flow description from execution context

Restated canonical target command surface:

```txt
bage create
bage edit
bage grant
bage inspect
bage load --protocol-version=1
bage revoke
bage update
bage view

bage identity export
bage identity forget
bage identity import
bage identity list
bage identity passphrase # aliases: pass, pw
bage identity rotate

bage setup
bage interactive # alias: i
```

Clarified stale vocabulary:
- anything saying `me`, `identities`, `add-identity`, `forget-identity`, root `rotate`, or `change-passphrase` is target-outdated
- current implementation may still use those names, but target spec should not

Clarified non-goals:
- no implementation changes
- no tests
- current implementation may be reverse-engineered for intent only, not treated as target design source of truth

### Assistant
Rebuilt context from:
- current user recovery prompt
- `0-GRILL-ME-cli-architecture-sweet-spot.md`
- `0-PRD_INTERNAL_BOUNDARY_HARDENING.md`
- `1-BOUNDARY_API_SPEC.ts`
- `plans/better-age-internal-boundary-hardening.md`
- `CONTEXT.md`
- `UBIQUITOUS_LANGUAGE.md`
- relevant current README/code file inventory

Cleanup performed:
- rewrote `0-PRD_INTERNAL_BOUNDARY_HARDENING.md` from stale completed-refactor framing into active target-spec charter
- rewrote `plans/better-age-internal-boundary-hardening.md` from stale completed implementation phases into active spec worklist
- updated `1-BOUNDARY_API_SPEC.ts` with explicit two-axis `CliExecutionPolicy`
- added `TARGET_CLI_COMMAND_SURFACE`
- fixed `CLI_COMMAND_TO_CORE_MAPPING` to include the required `interactive.session` mapping

Current locked framing:
- `.llms/projects/4-cli-core-boundary-hardening` is now a spec workspace
- shipped README/current code may remain v1-current and should not be blindly rewritten during this spec-only session
- next grilling branch should start from execution-context policy because it gates every flow spec

Next question should decide whether "exact invocation" means all non-secret operands only, while passphrase remains an interactive secret prompt when terminal is interactive.

### User
Confirmed exact invocation definition:
- exact invocation means all mandatory args/non-secret operands are passed
- example: `grant` requires payload path + identity-ref
- if both are passed, invocation is exact
- if any mandatory operand is missing, invocation is guided
- passphrase is still prompted later if terminal supports it
- truly headless execution should hard-fail with clear explanation if passphrase cannot be acquired

Added UX direction:
- guided flows should maximize smoothness and fail fast when possible
- payload file operations may start by decrypting payload in memory after path selection and passphrase prompt
- this can fail early on wrong passphrase/access/file issues before collecting later inputs
- decrypted in-memory context can improve later prompts
- example `grant` guided flow:
  1. ask payload path with cwd `*.enc` suggestions plus custom path entry
  2. ask passphrase
  3. decrypt/open payload in memory
  4. ask identity to grant using known identities plus already-granted payload recipients
  5. call strict grant with in-memory passphrase/context
  6. persist mutation

### Assistant
Persisted:
- `UBIQUITOUS_LANGUAGE.md`
  - exact/guided invocation now explicitly excludes passphrase from operand completeness
  - exact invocation may still require passphrase prompt
- `1-BOUNDARY_API_SPEC.ts`
  - added `CliMandatoryOperandCompleteness`
  - added `CliCredentialAcquisition`
  - annotated two-axis `CliExecutionPolicy` with credential acquisition
  - added `BetterAgeCliPayloadContextFlows.runOpenPayloadContextFlow`

Current open branch:
- should early decrypted payload context become the default for every payload command that needs payload contents, or only guided mutation flows?

### User
Confirmed early decrypted payload context:
- yes, use early decrypt/open for every payload-content command
- applies to:
  - `inspect`
  - `view`
  - `edit`
  - `grant`
  - `revoke`
  - `update`
  - `load`
- `create` still prompts for passphrase, but never reads an existing file
- from user perspective `create` still follows similar shape:
  - exact: file name is already supplied, then ask passphrase
  - guided: ask file name, then ask passphrase

Concrete `grant` execution policy:
- headless: fail immediately for MVP because no passphrase prompt channel exists
- interactive + exact:
  1. read payload file
  2. ask passphrase
  3. decrypt in memory
  4. continue exact grant path
- interactive + guided:
  1. guide payload path selection
  2. read payload file
  3. ask passphrase
  4. decrypt in memory
  5. use payload context for richer recipient selection

Also caught spec entropy:
- stale `TerminalCapability = "interactive-terminal" | "headless-terminal"` remained next to `CliTerminalMode = "interactive" | "headless"`
- requested removing outdated duplicate vocabulary from specs

### Assistant
Persisted:
- removed stale `TerminalCapability`
- replaced `TerminalCapabilityPort` with `CliTerminalModePort`
- added `PayloadContentCommand`
- added `PayloadCreationCommand`
- added `PayloadCommandOpenPolicy`
- added `runPassphraseAcquisitionFlow`
- updated `runOpenPayloadContextFlow` to receive the payload-content command
- updated `UBIQUITOUS_LANGUAGE.md` with **Payload Context**

Current locked rule:
- all payload-content commands open/decrypt early once path + passphrase are available
- `create` acquires passphrase but does not open an existing payload

### User
Asked to infer current `load` + varlock behavior because prototype already works.

Uncertainty:
- maybe varlock plugin handles interactive flow
- maybe varlock invocation is still interactive
- need clarify exact current needs before over-designing headless credential channel

### Assistant
Inspected only current `load` command, prompt infra, and varlock runtime.

Findings:
- `bage load --protocol-version=1 <path>` calls `Prompt.inputSecret({ message: "Passphrase: " })`
- Node prompt reads from `process.stdin` and writes prompt/newline to `process.stderr`
- prompt requires both `stdin.isTTY` and `stderr.isTTY`
- if unavailable, command maps to `ERR.PASSPHRASE.UNAVAILABLE`
- varlock runtime spawns:
  - command: `bage load --protocol-version=1 <path>`
  - stdio: `["inherit", "pipe", "inherit"]`
- therefore:
  - child stdin is inherited from the varlock process
  - child stdout is piped and captured as env text
  - child stderr is inherited so prompt/errors appear in the invoking shell
  - varlock does not collect or forward passphrase
  - varlock does not implement the interactive flow
- working prototype works because the varlock-run process still has interactive stdin/stderr attached

Spec correction:
- removed `passphrase` from `LoadProtocolRequest`
- added `LoadProtocolProcessContract`
- clarified varlock owns preserving inherited stdin/stderr, not passphrase collection

Current locked interpretation:
- `load` is machine-output but not necessarily headless
- varlock is a machine adapter over stdout, while credential acquisition still happens through inherited interactive TTY
- true non-TTY automation remains unsupported for MVP unless a future credential channel is designed

### User
Confirmed:
- headless means no passphrase prompt is possible
- headless should instantly fail with explicit reason
- even though `load` is for machine use, it requires interactive context in MVP

### Assistant
Locked terminology:
- machine-output does not imply headless execution
- `load` has a machine stdout contract
- `load` requires interactive passphrase acquisition for MVP
- headless `load` fails fast with passphrase-unavailable remediation

Persisted:
- `UBIQUITOUS_LANGUAGE.md`
- `LoadExecutionRequirement` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked whether payload-content commands should always read/validate payload file before passphrase prompt.

Recommended flow:

```txt
exact:
  validate mandatory operands
  read payload file
  if file invalid/missing -> fail before passphrase
  ask passphrase
  decrypt/open Payload Context
  continue command

guided:
  resolve missing path
  read payload file
  if file invalid/missing -> local retry/back/cancel where possible
  ask passphrase
  decrypt/open Payload Context
  continue command
```

Reason:
- avoid asking secret if path/file already doomed
- keep UX smooth

### User
Confirmed.

Also requested keeping this kind of plain-text flow somewhere because it is valuable:
- defines chunks of flow for kinds of actions based on context
- useful as durable source of truth

### Assistant
Created `2-EXECUTION_FLOW_SPEC.md`.

Added reusable flow chunks:
- payload-content command flow
- create payload flow

Updated project PRD/worklist to reference the new flow spec.

### User
Confirmed wrong-passphrase behavior:
- exact + interactive should log failure and retry passphrase
- guided + interactive should also retry passphrase inline
- no need for explicit retry/cancel/back menu
- headless should never reach decrypt
- asked assistant to choose bounded vs indefinite attempts

Example desired copy shape:

```txt
Passphrase: ***
Invalid passphrase. Try again.
Passphrase: ***
Invalid passphrase. 1 attempt left.
Passphrase: ***
Failed to decrypt. Invalid passphrase.
```

### Assistant
Chose 3 total attempts.

Reason:
- enough for typo recovery
- bounded so terminal sessions/scripts do not hang forever
- keeps retry behavior simple and predictable

Persisted:
- `2-EXECUTION_FLOW_SPEC.md`
  - passphrase retry policy
  - inline retry copy shape
  - exact/guided interactive retry rules
- `1-BOUNDARY_API_SPEC.ts`
  - `CliPassphraseRetryPolicy`
- `UBIQUITOUS_LANGUAGE.md`
  - **Passphrase Retry**

### Assistant
Asked guided invalid path recovery:

Recommended:

```txt
show error
return to payload path picker
preserve previous suggestions
allow custom path again
Back/Cancel available from picker
```

Exact invocation:

```txt
show error
exit failure
```

### User
Confirmed.

### Assistant
Persisted:
- `2-EXECUTION_FLOW_SPEC.md`
- `GuidedPayloadPathRecoveryPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked guided `grant` recipient picker shape.

Recommended:
- one merged picker
- known identities
- payload recipients marked already granted
- custom identity string entry
- already-granted visible but disabled or marked
- custom identity string parses into `PublicIdentitySnapshot`
- self identity hidden or disabled

### User
Confirmed one picker.

Specified:
- merge payload granted identities with local known identities and actual user identity
- resolve local alias when available
- render one identity line per identity
- own identity disabled with `[you]`
- already granted identities disabled with `[granted]`
- all others selectable
- include custom identity string path

Raised side note / new ambiguity:
- when payload recipients are discovered, maybe local known identities should be updated/imported
- if known identity has newer snapshot in payload, maybe update local data
- if unknown identity appears, maybe:
  - silently add without alias
  - never import implicitly
  - after MVP add import-from-payload command
  - or on open payload prompt: "this payload contains new identities, import them?"
  - if display-name duplicate, ask for local alias

### Assistant
Persisted grant picker as locked:
- `2-EXECUTION_FLOW_SPEC.md`
- `GrantRecipientPickerEntry`
- `GrantRecipientPickerPolicy`
- `UBIQUITOUS_LANGUAGE.md` **Grant Recipient Picker**

Did not lock payload-recipient auto-import/update yet.

Conflict to resolve:
- existing `CONTEXT.md` says a payload recipient may become a known identity automatically when first seen
- user now reopened whether that should happen, and if so how

### Assistant
Asked payload recipient discovery policy.

Recommended MVP:

```txt
if OwnerId already known:
  if payload snapshot is newer:
    update known identity silently
  else:
    keep local known identity

if OwnerId unknown:
  do not auto-import
  use transiently in current picker/rendering
  later feature: import from payload / import prompt
```

### User
Confirmed.

Added:
- future flow for importing unknown identities from payload is important and should be written down
- possible shape:
  - interactive-only when at least one new identity is detected
  - loop through new identities to import
  - optionally prompt alias if display-name collision
  - bind this flow to existing command flows or add dedicated command later

### Assistant
Persisted MVP rule:
- known identity update from newer payload snapshot is silent
- unknown recipient identities remain transient only
- no auto-import in MVP

Persisted future work:
- `2-EXECUTION_FLOW_SPEC.md`
- `PayloadRecipientDiscoveryPolicy`
- `CONTEXT.md`
- `UBIQUITOUS_LANGUAGE.md`
- `.llms/memory/backlog.txt`

### Assistant
Asked exact `grant` idempotence.

Recommended:

```txt
open Payload Context
resolve identity-ref
if same OwnerId already granted:
  success unchanged
  render "already granted"
  exit 0
```

For newer snapshot:

```txt
treat as grant refresh
rewrite payload recipient snapshot
success updated
```

### User
Confirmed:
- refresh overrides previous old identity snapshot
- agreed with recommendation

### Assistant
Persisted:
- `Grant Recipient Idempotence` in `2-EXECUTION_FLOW_SPEC.md`
- `GrantRecipientIdempotencePolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked exact `grant` self policy.

Recommended:

```txt
fail with CANNOT_GRANT_SELF
exit non-zero
```

Guided picker:
- self is disabled so user cannot select it

### User
Confirmed:
- cannot grant self
- should fail

### Assistant
Persisted:
- `Grant Self Policy` in `2-EXECUTION_FLOW_SPEC.md`
- `GrantSelfPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `revoke` picker and exact policy.

Recommended guided picker:

```txt
payload recipients only
self recipient disabled [you]
other recipients selectable
render alias overlay if known locally
```

Recommended exact behavior:

```txt
resolve identity-ref to OwnerId
if OwnerId == self -> fail CANNOT_REVOKE_SELF
if OwnerId not granted -> success unchanged
else remove recipient, success removed
```

### User
Confirmed.

### Assistant
Persisted:
- `Guided Revoke Recipient Picker`
- `Revoke Recipient Policy`
- `RevokeRecipientPickerEntry`
- `RevokeRecipientPickerPolicy`
- `RevokeRecipientPolicy`

### Assistant
Asked `update` command scope.

Recommended:

```txt
open Payload Context
compute update reasons
if none:
  success unchanged
if reasons exist:
  rewrite payload with current schema + current self recipient
  success updated with reasons
```

Only allowed reasons:
- `payload-format-migration`
- `self-recipient-refresh`

### User
Confirmed.

Added future hardening idea:
- before persisting updated payload, try to reopen it in memory first
- persist only if reopened payload works
- out of MVP

### Assistant
Persisted:
- `Update Payload Policy` in `2-EXECUTION_FLOW_SPEC.md`
- `UpdatePayloadPolicy` in `1-BOUNDARY_API_SPEC.ts`
- future pre-persist verification in `.llms/memory/backlog.txt`

### Assistant
Asked outdated payload write gate policy.

Recommended:

```txt
exact + interactive:
  fail with "run bage update <path>"
  no gate

guided + interactive:
  show gate: Update now / Back / Cancel
  Update now -> run update -> resume original command with same path/passphrase where valid
  Back -> return local previous step
  Cancel -> stop command

headless:
  fail fast with "run bage update <path>"
```

### User
Confirmed.

### Assistant
Persisted:
- `Outdated Payload Write Gate` in `2-EXECUTION_FLOW_SPEC.md`
- `OutdatedPayloadWriteGatePolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `edit` flow.

Recommended:

```txt
open editor with envText
if editor cancel/no save:
  cancel
if edited text identical:
  success unchanged
if edited text invalid .env:
  show validation error
  reopen editor with previous edited text
if valid and changed:
  rewrite payload
  success edited
```

### User
Confirmed exactly.

### Assistant
Persisted:
- `Edit Payload Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `EditPayloadFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `view`, `inspect`, and `load` output contracts.

Recommended:

```txt
view:
  open secure viewer with envText
  never print plaintext to stdout
  viewer close => success

inspect:
  print metadata + env key names + recipients
  no plaintext values

load:
  print raw envText to stdout only
  warnings/notices to stderr
```

Readable-but-outdated:

```txt
view/inspect/load:
  succeed with in-memory migration
  emit update recommended warning/remediation
```

### User
Confirmed exactly.

### Assistant
Persisted:
- `Payload Read Output Flows` in `2-EXECUTION_FLOW_SPEC.md`
- `PayloadReadOutputPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `identity import` flow.

Recommended:

```txt
exact:
  parse identity string
  if self -> fail CANNOT_IMPORT_SELF
  if known same/older -> success unchanged
  if known newer -> update known identity, success updated
  if unknown -> add known identity, success added

guided:
  prompt/paste identity string
  same core behavior
```

Initially recommended no alias prompt in MVP.

### User
Corrected:
- wants alias here for MVP
- otherwise no way to test alias overlay in other flows
- `identity import` should be the one place alias can be prompted if that makes sense

### Assistant
Persisted:
- `Identity Import Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityImportFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`
- `UBIQUITOUS_LANGUAGE.md`: identity import can set/change local alias in MVP

Locked distinction:
- alias prompt belongs in `identity import`
- alias prompt does not happen inside payload-open flows

### Assistant
Asked alias prompt shape.

Recommended:
- empty on new identity = no alias
- empty on existing identity = keep existing alias
- invalid alias = show error and retry
- duplicate alias = show error and retry
- explicit alias removal not in MVP

### User
Confirmed.

Added:
- exact/headless should support optional `--alias`
- invalid or duplicate `--alias` hard-fails
- future post-MVP commands:
  - `identity alias add [<identity-ref>] [<alias>]`
  - `identity alias remove [<identity-ref>]`
  - maybe `rm` alias for remove

### Assistant
Persisted:
- alias input section in `2-EXECUTION_FLOW_SPEC.md`
- alias fields in `IdentityImportFlowPolicy`
- future alias commands in `.llms/memory/backlog.txt`

### Assistant
Asked `identity forget`.

Recommended:
- exact not found = error
- guided picker only shows known identities
- forgetting does not touch payloads

### User
Confirmed all.

### Assistant
Persisted:
- `Identity Forget Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityForgetFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `identity list` output.

Recommended sections:
- self
- known identities
- retired keys

Rules:
- no private key material
- no passphrase
- no payload access
- works headless
- no setup fails with `SELF_IDENTITY_NOT_FOUND` and setup remediation

### User
Confirmed.

### Assistant
Persisted:
- `Identity List Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityListOutputPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `identity export` output.

Recommended:
- identity string to stdout only
- no styling around stdout
- pipe-safe
- warnings/notices to stderr if needed
- works headless
- no passphrase
- no setup fails with setup remediation
- exports current public identity only, never retired keys

### User
Confirmed.

Added:
- should be easy to pipe/copy to clipboard

### Assistant
Persisted:
- `Identity Export Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityExportOutputPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `identity rotate`.

Recommended:
- requires passphrase
- creates new current key for same `OwnerId`
- moves old key to retired keys
- updates self public identity snapshot fields
- does not rewrite payloads
- emits remediation to run `bage update` on payloads where self recipient is stale
- interactive prompts passphrase with 3 retries
- headless fails passphrase unavailable

### User
Confirmed exactly.

### Assistant
Persisted:
- `Identity Rotate Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityRotateFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `identity passphrase`.

Recommended:
- ask current passphrase
- wrong current passphrase retries 3 times
- ask new + confirm
- mismatch retries new/confirm pair
- re-encrypt all local private keys, current + retired

Asked whether retired keys should be re-encrypted too.

### User
Confirmed:
- decrypt with old passphrase and re-encrypt with new passphrase for each key
- includes current and retired keys
- only way to check current passphrase is to try decrypting current key

### Assistant
Persisted:
- `Identity Passphrase Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `IdentityPassphraseFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `setup`.

Recommended:
- if self identity already exists, fail already configured
- display name via `--name` option
- guided interactive prompts display name when missing
- no positional display name
- exact/headless require `--name`
- ask passphrase + confirm
- mismatch retries pair
- create owner id + keypair
- encrypt current private key with passphrase
- persist home state

### User
Confirmed:
- exact/headless require `--name`

### Assistant
Persisted:
- `Setup Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `SetupFlowPolicy` in `1-BOUNDARY_API_SPEC.ts`
- `runSetupCommand({ name? })` in CLI command interface

### Assistant
Asked command exactness table.

Proposed mandatory operands:

```txt
setup: --name for exact/headless; guided may prompt
create: path
edit: path
grant: path + identity-ref
inspect: path
load: path + --protocol-version
revoke: path + identity-ref
update: path
view: path

identity export: none
identity import: identity-string
identity forget: identity-ref
identity list: none
identity passphrase: none
identity rotate: none
interactive: none
```

### User
Confirmed.

### Assistant
Persisted:
- `Command Exactness Table` in `2-EXECUTION_FLOW_SPEC.md`
- `CliMandatoryOperandTable` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked global headless rule.

Credential-required commands:
- `setup`
- `create`
- `edit`
- `grant`
- `inspect`
- `load`
- `revoke`
- `update`
- `view`
- `identity passphrase`
- `identity rotate`

Headless behavior:
- validate mandatory operands enough to give specific missing-arg errors
- then fail passphrase unavailable
- no prompts
- no decrypt
- no mutation

Headless-allowed commands:
- `identity export`
- `identity import` if identity string passed and alias valid
- `identity forget` if identity ref passed
- `identity list`

### User
Confirmed.

### Assistant
Persisted:
- `Headless Credential Rule` in `2-EXECUTION_FLOW_SPEC.md`
- `HeadlessCredentialPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked `interactive` session rule.

Recommended:

```txt
bage interactive / bage i:
  requires interactive terminal
  if headless -> fail INTERACTIVE_UNAVAILABLE
  owns session menus/back/cancel
  routes into same command flows, never separate business logic
  session Back returns previous menu
  session Cancel exits interactive session
```

### User
Confirmed.

### Assistant
Persisted:
- `Interactive Session Flow` in `2-EXECUTION_FLOW_SPEC.md`
- `InteractiveSessionPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked top-level exit mapping.

Recommended:
- success -> `0`
- unchanged success -> `0`
- Ctrl+C abort -> `130`
- menu/editor/user cancel -> `1`, quiet
- Back out of standalone guided command -> `1`
- domain/user error -> `1`
- internal defect -> `1` for MVP

### User
Confirmed.

### Assistant
Persisted:
- `Top-Level Exit Mapping` in `2-EXECUTION_FLOW_SPEC.md`
- `CliProgramExitCode = 0 | 1 | 130`
- `CliExitMappingPolicy`

### Assistant
Asked whether to continue into exhaustive error kinds.

Recommended grouping:
- setup errors
- home state errors
- passphrase/key errors
- payload file/content errors
- payload compatibility/update errors
- identity parse/resolution errors
- grant/revoke domain errors
- prompt/editor/viewer errors
- load protocol/varlock errors
- internal defects

### User
Confirmed exhaustive taxonomy is needed.

### Assistant
Created `3-ERROR_KIND_SPEC.md` with initial taxonomy.

Updated PRD/worklist references.

### Assistant
Asked idempotent non-error cases.

Proposed success-not-error:
- grant already granted same/older
- revoke recipient not granted
- update no reasons
- edit identical content
- identity import known same/older unless alias changed

Exception:
- forget unknown identity remains error because exact ref failed

### User
Confirmed.

### Assistant
Persisted in `3-ERROR_KIND_SPEC.md`.

### Assistant
Asked core vs CLI vs varlock error ownership split.

Recommended:
- core owns domain/app/persistence/crypto/compatibility semantics
- CLI owns missing args, unavailable prompt, editor/viewer, load protocol parsing
- varlock owns process adapter failures

### User
Confirmed.

### Assistant
Persisted `Ownership Classification` in `3-ERROR_KIND_SPEC.md`.

### Assistant
Asked structured error details policy.

Recommended:
- missing: command + operand
- ambiguous: input + candidates
- invalid: safe input/reason
- duplicate: alias + conflicting owner id
- not found: input/path/ref
- compatibility/migration: versions
- payload update required: path + reasons
- passphrase unavailable: required interactive capability
- varlock: launcher/path/exit/cause

Recommended no normal user-facing details for:
- `PASSPHRASE_INCORRECT`
- `PAYLOAD_DECRYPT_FAILED`
- `PAYLOAD_ACCESS_DENIED`
- `PRIVATE_KEY_DECRYPT_FAILED`

### User
Confirmed.

### Assistant
Persisted `Structured Details Policy` in `3-ERROR_KIND_SPEC.md`.

### Assistant
Asked decrypt/security error semantics.

Recommended:
- `PASSPHRASE_INCORRECT`: local private key could not decrypt with supplied passphrase
- `PAYLOAD_ACCESS_DENIED`: passphrase was valid for local key, but none of local keys can decrypt payload
- `PAYLOAD_DECRYPT_FAILED`: payload decrypt failed for non-auth-specific crypto/corruption reason
- `PRIVATE_KEY_DECRYPT_FAILED`: internal/private-key file decrypt failure outside normal user passphrase check

### User
Confirmed.

### Assistant
Persisted decrypt/security semantics in `3-ERROR_KIND_SPEC.md`.

### Assistant
Asked message id style.

Recommended:
- `ERR.<SCOPE>.<REASON>`
- domain scope by default
- command scope only when generic scope loses meaning

Examples:
- `ERR.PAYLOAD.NOT_FOUND`
- `ERR.IDENTITY.STRING_INVALID`
- `ERR.GRANT.CANNOT_GRANT_SELF`
- `ERR.REVOKE.CANNOT_REVOKE_SELF`

### User
Confirmed.

### Assistant
Persisted `Message Id Convention` in `3-ERROR_KIND_SPEC.md`.

### Assistant
Asked warning/info/success message ids.

Recommended:
- stable warning/info ids
- coarse success ids with typed outcome params
- avoid one success id per minor outcome

Example:

```txt
SUCCESS.PAYLOAD.GRANT { outcome: added|updated|unchanged }
SUCCESS.PAYLOAD.REVOKE { outcome: removed|unchanged }
SUCCESS.PAYLOAD.UPDATE { outcome: updated|unchanged }
```

### User
Accepted if assistant thinks clean.

### Assistant
Locked:
- coarse success ids
- typed outcome params

Persisted:
- `Warning / Info / Success Ids` in `3-ERROR_KIND_SPEC.md`
- updated `CliSuccessMessageId` in `1-BOUNDARY_API_SPEC.ts`

### User
Confirmed next focus:
- tighten `1-BOUNDARY_API_SPEC.ts` against locked decisions
- clean old names and API mismatches

### Assistant
Tightened `1-BOUNDARY_API_SPEC.ts`:
- replaced stale `terminal capability` wording with `terminal mode`
- added `CliCommandRunContext` carrying `CliExecutionContext`
- added command run context to every `BetterAgeCliCommands` method
- updated `runSetupCommand` to carry optional `name`
- updated `runIdentityImportCommand` to carry optional `alias`
- changed `runFileRevokeCommand` and revoke composite flow from `OwnerId` input to `IdentityReferenceInput`
- removed obsolete `CliFlowRetry` and `runPassphraseRetryFlow`
- updated passphrase acquisition scope to include setup, identity passphrase, and identity rotate
- updated `createPayload` core input to include `passphrase`
- added create payload passphrase/private-key errors
- added local alias import errors
- added private-key decrypt/reencrypt errors to passphrase change
- removed `RECIPIENT_NOT_GRANTED` from revoke error because it is idempotent success
- updated import outcome to include `alias-updated`
- updated forget outcome to removed-only
- added `PayloadReadModel` to payload context result so read commands can access `envText`
- aligned CLI message ids with `ERR.<SCOPE>.<REASON>` convention
- added `WARN.IDENTITY.SELF_RECIPIENT_STALE_AFTER_ROTATE`

Entropy scan found no remaining stale occurrences for:
- `TerminalCapability`
- `CliFlowRetry`
- `runPassphraseRetryFlow`
- `RECIPIENT_NOT_GRANTED`
- `ERR.HOME_STATE`
- `ERR.IDENTITY_STRING`
- `ERR.PAYLOAD.CANNOT_*`
- `SECURE_VIEWER`
- `INFO.HOME_STATE`
- `USING_DISCOVERED_PATH`
- `initialRecipientOwnerId`

### Assistant
Asked core `createPayload` behavior after adding passphrase.

Proposed:

```txt
createPayload(path, passphrase):
  load self identity
  decrypt current private key with passphrase to prove credential
  create payload for self recipient
  encrypt envText/default empty payload
  persist
```

Asked whether created payload should start empty or CLI should immediately open editor after create.

### User
Confirmed core behavior.

Corrected framing:
- opening editor after create is a CLI flow concern, not core
- core create can create empty payload
- interactive mode opening edit after create may make sense, but not necessarily MVP

### Assistant
Persisted:
- `Core/CLI Split` under `Create Payload Flow` in `2-EXECUTION_FLOW_SPEC.md`
- future CLI follow-up in `.llms/memory/backlog.txt`

### Assistant
Asked whether core should expose a combined payload context query because the CLI payload context currently carried both `readModel` and `inspection`.

### User
Rejected the naming:
- `readModel` and `inspection` are confusing
- API was not well thought through
- asked assistant to redesign it clearly

### Assistant
Redesigned payload-open API:
- removed `PayloadReadModel`
- removed `PayloadInspection`
- added `DecryptedPayload`
- added single core query `openPayload({ path, passphrase })`
- `DecryptedPayload` contains:
  - path
  - payload id
  - timestamps
  - schema version
  - compatibility
  - envText
  - envKeys
  - recipients
- CLI payload context now returns `payload: DecryptedPayload`
- command-to-core mapping now maps `inspect`, `view`, and `load` to `queries.openPayload`

Current interpretation:
- core owns opening/decrypting and returning one coherent decrypted payload
- CLI owns projecting that payload into `view`, `load`, `inspect`, and richer guided prompts

### Assistant
Asked whether mutation commands should accept an already opened payload context to avoid double decrypt.

Suggested option A:
- `grantPayloadRecipient({ openedPayload, recipient })`

Suggested option B:
- `grantPayloadRecipient({ path, passphrase, recipient })`

Initially recommended A.

### User
Pushed back:
- from pure core perspective, write operation accepting opened payload does not feel right
- expected canonical operation to stay `grantPayloadRecipient({ path, passphrase, recipient })`
- early open is CLI convenience only
- wants core solid, with each action stateless

### Assistant
Accepted correction:
- previous recommendation overfit core API to CLI optimization
- stateless path+passphrase commands are better
- avoids stale in-memory payload mutation
- keeps exact input -> exact result
- double decrypt is acceptable

### User
Confirmed this feels better.

### Assistant
Persisted:
- `Core Mutation Statelessness` in `2-EXECUTION_FLOW_SPEC.md`
- `CoreMutationStatelessnessPolicy` in `1-BOUNDARY_API_SPEC.ts`

### Assistant
Asked naming for core decrypted payload query.

Options:
- `decryptPayload`
- `readDecryptedPayload`
- `openPayload`

Recommended:
- `readDecryptedPayload` for stateless core clarity

### User
Confirmed, then corrected:
- `decrypt` is more accurate than `readDecrypted`
- use consistent wording

### Assistant
Renamed core query again for accuracy:
- `readDecryptedPayload` -> `decryptPayload`
- `OpenPayloadErrorCode` -> `DecryptPayloadErrorCode`
- success code -> `PAYLOAD_DECRYPTED`
- command mapping for `inspect`, `view`, and `load` now uses `queries.decryptPayload`

Kept CLI flow name `runOpenPayloadContextFlow` because it describes CLI UX context creation, not core command API.

### Assistant
Asked whether CLI flow should also rename from `runOpenPayloadContextFlow` to `runDecryptPayloadContextFlow`.

Recommended:
- keep `runOpenPayloadContextFlow`
- CLI wording describes UX/session intent
- core wording describes semantic operation

### User
Confirmed:
- CLI wording should be from outside intents
- core wording should be for internal operation

### Assistant
Persisted naming principle in `1-BOUNDARY_API_SPEC.ts` package/layer comments.

### Assistant
Asked core command names.

Recommended:
- keep most names
- rename core `changePassphrase` to `changeIdentityPassphrase`
- CLI remains `identity passphrase`

### User
Agreed.

### Assistant
Renamed in spec:
- `commands.changePassphrase` -> `commands.changeIdentityPassphrase`

### Assistant
Asked core import command name.

Suggested:
- `importKnownIdentity({ identityString, localAlias })`

Reason:
- result is a known identity
- input still clearly says `identityString`

### User
Confirmed.

### Assistant
Renamed in spec:
- `commands.importIdentityString` -> `commands.importKnownIdentity`

### Assistant
Asked export core query name.

Suggested:
- `exportSelfIdentityString`

Reason:
- glossary uses **Self Identity**

### User
Confirmed.

### Assistant
Renamed in spec:
- `queries.exportOwnIdentityString` -> `queries.exportSelfIdentityString`

### Assistant
Asked create/rotate identity core names.

Suggested:
- `createSelfIdentity`
- `rotateSelfIdentity`

Reason:
- glossary uses **Self Identity**, not user identity

### User
Confirmed.

### Assistant
Renamed in spec:
- `CreateUserIdentityErrorCode` -> `CreateSelfIdentityErrorCode`
- `RotateUserIdentityErrorCode` -> `RotateSelfIdentityErrorCode`
- `commands.createUserIdentity` -> `commands.createSelfIdentity`
- `commands.rotateUserIdentity` -> `commands.rotateSelfIdentity`

### Assistant
Asked whether identity list should keep composing primitive queries or add aggregate `listHomeIdentities()`.

Recommended:
- keep composing:
  - `getSelfIdentity`
  - `listKnownIdentities`
  - `listRetiredKeys`

### User
Confirmed:
- prefer small canonical primitives
- convenience thing can call primitives under the hood

### Assistant
Persisted in `IdentityListOutputPolicy`:
- primitive query composition is canonical
- aggregate query is optional convenience over primitives

### User
Confirmed next artifact:
- create mapping spec from errors to message ids, exit behavior, and details

### Assistant
Created `4-ERROR_MESSAGE_MAPPING_SPEC.md`.

Initial coverage:
- setup
- home state
- passphrase/key
- payload
- payload compatibility/update
- identity
- grant/revoke
- prompt/editor/viewer
- load protocol/varlock
- internal

Updated project PRD/worklist references.

### Assistant
Entropy cleanup after context restore:
- PRD/worklist now use `decryptPayload`, `importKnownIdentity`, and `exportSelfIdentityString`.
- mapping spec now uses canonical `SETUP_ALREADY_CONFIGURED`.
- mapping spec now includes `PAYLOAD_UPDATE_REASON_MISSING`, generic identity resolution errors, and identity rotate/passphrase aggregate failures.

### Assistant
Further active-spec cleanup:
- setup flow/spec now uses `SETUP_ALREADY_CONFIGURED`, not `SELF_IDENTITY_ALREADY_EXISTS`.
- create self identity uses `SETUP_NAME_INVALID` and `SETUP_ALREADY_CONFIGURED`.
- core identity success codes use `SELF_IDENTITY_CREATED` / `SELF_IDENTITY_ROTATED`.
- core export success code uses `SELF_IDENTITY_STRING_EXPORTED`.
- core grant mutation now takes exact `PublicIdentitySnapshot`; flexible identity references stay before mutation.
- CLI message id union expanded to match the mapping spec.

### Assistant
Asked next mapping question:

How should `PRIVATE_KEY_DECRYPT_FAILED` map?

Recommended:
- wrong user passphrase is always `PASSPHRASE_INCORRECT`, retryable, maps to `ERR.PASSPHRASE.INCORRECT`.
- `PRIVATE_KEY_DECRYPT_FAILED` means local key material could not be decrypted for a non-normal credential reason after/alongside key access, maps to a dedicated local-state/key-corruption style message, not to passphrase retry.
- add message id `ERR.HOME.PRIVATE_KEY_DECRYPT_FAILED` or `ERR.IDENTITY.PRIVATE_KEY_DECRYPT_FAILED`; prefer `ERR.HOME.PRIVATE_KEY_DECRYPT_FAILED` because encrypted private keys are local home state.

### User
Agreed:
- this distinction makes more sense.

### Assistant
Persisted:
- `PRIVATE_KEY_DECRYPT_FAILED` maps to `ERR.HOME.PRIVATE_KEY_DECRYPT_FAILED`.
- it is not retryable as a wrong-passphrase prompt.
- wrong user credential remains `PASSPHRASE_INCORRECT`.

### Assistant
Asked next mapping question:

Should payload file read/write failures expose the payload path?

Recommended:
- yes, include the user-provided/resolved path for `PAYLOAD_NOT_FOUND`, `PAYLOAD_ALREADY_EXISTS`, `PAYLOAD_READ_FAILED`, and `PAYLOAD_WRITE_FAILED`.
- do not expose raw OS error text by default.
- keep raw cause in debug/diagnostic context only.
- reason: payload path is not secret in this tool's UX model, and hiding it makes exact/guided recovery worse.

### User
Agreed:
- exposing payload path for file errors makes sense.

### Assistant
Persisted:
- payload not found/already exists/read failed/write failed expose the path.
- raw OS cause remains diagnostics-only by default.

### Assistant
Asked next mapping question:

Which editor command details are safe to render?

Recommended:
- render editor command/binary name only when it came from explicit user configuration such as `$EDITOR` or config.
- do not render full temp file path by default.
- render exit code for non-zero exit.
- render no raw stderr by default.
- message examples:
  - `ERR.EDITOR.UNAVAILABLE`: no editor configured/found.
  - `ERR.EDITOR.LAUNCH_FAILED`: could not start editor `<editor>`.
  - `ERR.EDITOR.EXIT_NON_ZERO`: editor exited with code `<code>`.
  - temp file create/read errors stay generic.

### User
Agreed.

### Assistant
Persisted editor detail policy:
- editor command only if explicitly user-configured.
- exit code is safe for non-zero exits.
- temp paths and raw stderr are hidden by default.

### Assistant
Asked next mapping question:

Should low-level crypto/key failures keep mapping to generic `ERR.INTERNAL.DEFECT`, or get dedicated safe message ids?

Recommended:
- use dedicated safe message ids for operation-level failures, not raw causes:
  - `KEY_GENERATION_FAILED` -> `ERR.IDENTITY.KEY_GENERATION_FAILED`
  - `PRIVATE_KEY_PROTECTION_FAILED` -> `ERR.HOME.PRIVATE_KEY_PROTECTION_FAILED`
  - `PRIVATE_KEY_REENCRYPT_FAILED` -> `ERR.HOME.PRIVATE_KEY_REENCRYPT_FAILED`
  - `PAYLOAD_ENCRYPT_FAILED` -> `ERR.PAYLOAD.ENCRYPT_FAILED`
- keep raw crypto/age cause diagnostics-only.
- reserve `ERR.INTERNAL.DEFECT` for impossible states, missing ports, programmer bugs.

### User
Agreed.

### Assistant
Persisted:
- crypto/key operation failures now have dedicated safe message ids.
- raw crypto/age causes are diagnostics-only.
- `ERR.INTERNAL.DEFECT` is reserved for impossible state, programmer bug, or missing port.

### Assistant
Asked next taxonomy question:

Should command aggregate failures like `IDENTITY_ROTATION_FAILED` and `IDENTITY_PASSPHRASE_CHANGE_FAILED` remain in taxonomy?

Recommended:
- remove them as core error kinds.
- core should return precise lower-level semantic failures:
  - passphrase incorrect
  - key generation failed
  - private key protection failed
  - private key reencrypt failed
  - home write failed
- CLI success/error mapping can still be command-contextual by where the error happens.
- reason: aggregate failure kinds hide the actual recovery path and duplicate mapping work.

### User
Agreed:
- removing aggregate command failures makes sense.

### Assistant
Persisted:
- removed `IDENTITY_ROTATION_FAILED` and `IDENTITY_PASSPHRASE_CHANGE_FAILED` from active taxonomy/mapping/message ids.
- documented rule: rotate/passphrase return precise lower-level failures; CLI context shapes copy.

### Assistant
Asked next taxonomy question:

Should `IDENTITY_NOT_FOUND` / `IDENTITY_AMBIGUOUS` and `KNOWN_IDENTITY_NOT_FOUND` / `KNOWN_IDENTITY_AMBIGUOUS` both stay?

Recommended:
- collapse to one public/core resolution vocabulary:
  - `IDENTITY_REFERENCE_NOT_FOUND`
  - `IDENTITY_REFERENCE_AMBIGUOUS`
- use details to say searched scope:
  - `scope: "known-identities" | "payload-recipients" | "known-and-payload-recipients"`
- reason: current split leaks implementation and creates duplicate message ids anyway.

### User
Agreed:
- collapse identity resolution errors.

### Assistant
Persisted:
- replaced `IDENTITY_NOT_FOUND` / `IDENTITY_AMBIGUOUS` and `KNOWN_IDENTITY_NOT_FOUND` / `KNOWN_IDENTITY_AMBIGUOUS` with `IDENTITY_REFERENCE_NOT_FOUND` / `IDENTITY_REFERENCE_AMBIGUOUS`.
- added `IdentityReferenceResolutionScope`.
- forget flow now fails `IDENTITY_REFERENCE_NOT_FOUND`.
- grant core mutation no longer has a known-identity-not-found branch because it receives exact `PublicIdentitySnapshot`.

### Assistant
Asked next taxonomy question:

Should missing operand errors like `PAYLOAD_PATH_MISSING`, `IDENTITY_STRING_MISSING`, and `IDENTITY_REFERENCE_MISSING` be CLI-only errors?

Recommended:
- yes.
- core APIs should receive exact inputs and not model missing argv operands.
- CLI parser/flow owns missing operand detection and guided recovery.
- core can still validate invalid/empty domain values if an adapter somehow passes them.

### User
Agreed.

### Assistant
Persisted:
- missing operand errors are CLI-only.
- core exact-input rule explicitly excludes missing argv operands.
- core still validates invalid exact domain values.

### Assistant
Asked next taxonomy question:

Should `PASSPHRASE_UNAVAILABLE` and `PROMPT_UNAVAILABLE` stay separate?

Recommended:
- yes.
- `PASSPHRASE_UNAVAILABLE`: command requires credential, but execution context cannot acquire one, usually headless.
- `PROMPT_UNAVAILABLE`: CLI expected a human prompt/menu/text input but prompt infra is unavailable or broken.
- reason: first is command capability policy; second is terminal/prompt adapter failure.

### User
Agreed.

### Assistant
Persisted:
- `PASSPHRASE_UNAVAILABLE` and `PROMPT_UNAVAILABLE` remain separate.
- passphrase unavailable is execution capability policy.
- prompt unavailable is prompt adapter/infrastructure failure.

### Assistant
Asked next taxonomy question:

Should `SELF_IDENTITY_NOT_FOUND` stay?

Recommended:
- remove it from active core taxonomy.
- no setup should be `HOME_STATE_NOT_FOUND` -> `ERR.SETUP.REQUIRED`.
- existing home state missing self identity should be `HOME_STATE_INVALID`, not setup-required.
- reason: "home exists but self identity missing" is corrupt local state, not normal first-time setup.

### User
Agreed.

### Assistant
Persisted:
- removed `SELF_IDENTITY_NOT_FOUND` from active specs.
- `HOME_STATE_NOT_FOUND` now means setup required.
- home exists but missing self identity maps to `HOME_STATE_INVALID`.
- core query/command error groups now use `HomeReadErrorCode` for no setup/corrupt home.

### Assistant
Asked next API-shape question:

Should `HOME_STATE_NOT_FOUND` be part of every `HomeReadErrorCode`, or only a global lifecycle/preflight error?

Recommended:
- keep it in `HomeReadErrorCode`.
- command/query APIs can fail directly with setup-required if preflight was not run or if used from tests/internal callers.
- CLI can still run preflight globally first.
- reason: core API remains robust and exact even outside CLI lifecycle.

### User
Agreed.

### Assistant
Persisted:
- `HOME_STATE_NOT_FOUND` stays in `HomeReadErrorCode`.
- setup-required is available from core APIs even if CLI preflight was not run.

### Assistant
Asked next API-shape question:

Should home compatibility errors be part of normal home reads?

Recommended:
- yes, include `HomeCompatibilityErrorCode` in `HomeReadErrorCode`.
- any command/query that reads home state can discover "CLI too old" or "migration path missing".
- preflight is still the normal CLI place to surface/migrate this early.
- reason: core APIs should remain correct if called without global preflight.

### User
Agreed.

### Assistant
Persisted:
- `HomeReadErrorCode` includes `HomeCompatibilityErrorCode`.
- preflight error code reuses `HomeReadErrorCode` plus write errors.

### Assistant
Asked next API-shape question:

Should payload compatibility errors stay separate, or be included in payload read/open errors?

Recommended:
- keep separate type groups, but every payload decrypt/mutation operation should include both repository/content/compatibility/secret groups.
- do not merge compatibility into repository errors.
- reason: repo errors are file IO/existence; compatibility is artifact schema policy.

### User
Delegated high-confidence error-spec decisions:
- stop asking trivial error-taxonomy questions.
- decide on user's behalf unless confidence is below 99%.
- recap decisions in one go so user can object after.

### Assistant
Persisted high-confidence cleanup:
- payload compatibility stays separate from repository/file IO.
- payload decrypt/mutation operations include repository, content, compatibility, and secret error groups.
- `PAYLOAD_UPDATE_REASON_MISSING` removed from active taxonomy/mapping because update with no reasons is success unchanged; programmer mistakes collapse to internal defect.
- open taxonomy/mapping placeholders cleared.
- setup domain errors added to core-owned classification.
- `PASSPHRASE_CONFIRMATION_MISMATCH` reclassified as inline prompt validation, not command failure.
- `PROMPT_ABORTED` is quiet exit 1; Ctrl+C remains exit 130.
- `PRIVATE_KEY_DECRYPT_FAILED` added to payload secret errors and identity rotation errors.
- varlock adapter errors now have a typed `VarlockAdapterFailure` surface in the boundary API spec.

### User
Asked to continue specifying remaining work.

### Assistant
Created `5-CLI_COMMAND_CONTRACT_SPEC.md`.

Covered:
- execution context contract
- operand classes: promptable, protocol, secret
- stdout/stderr/viewer/editor/menu contract
- full command matrix
- shared failure ordering
- per-command core call mapping
- per-command output channel policy
- exact/guided/headless behavior where command-specific

### Assistant
Corrected output channel policy:
- primary inspect/list output goes to stdout.
- machine stdout commands (`load`, `identity export`) stay clean.
- prompts/warnings/errors/hints/status stay stderr for machine-output commands.

### Assistant
Reflected command contracts into `1-BOUNDARY_API_SPEC.ts`:
- added `CliOperandClass` and `CliCommandContract`.
- added `CLI_COMMAND_CONTRACTS`.
- changed `runFileLoadCommand` input to `initialPath?: PayloadPath` while keeping `protocolVersion` explicit/protocol-owned.

### Assistant
Synced `2-EXECUTION_FLOW_SPEC.md` with command-contract terms:
- added operand classes.
- protocol operands fail immediately and are not guided.
- load `--protocol-version` is protocol-owned.
- added shared failure ordering.

### Assistant
Cleaned remaining import naming in `1-BOUNDARY_API_SPEC.ts`:
- `ImportIdentityStringErrorCode` -> `ImportKnownIdentityErrorCode`.
- import success code `IDENTITY_IMPORTED` -> `KNOWN_IDENTITY_IMPORTED`.

### Assistant
Fixed setup-specific home-state semantics:
- `HOME_STATE_NOT_FOUND` is setup-required for normal commands.
- for `setup`, missing home state is expected and not an error.
- added `HomeSetupProbeErrorCode` excluding `HOME_STATE_NOT_FOUND`.
- `CreateSelfIdentityErrorCode` now uses setup probe errors instead of normal `HomeReadErrorCode`.

### Assistant
Tightened payload repository error unions:
- reads use not-found/read-failed.
- create uses already-exists/write-failed.
- mutations use not-found/read-failed/write-failed.
- broad `PayloadRepositoryErrorCode` remains as a grouping term, but command unions use narrower groups.

### Assistant
Filled identity-reference resolver gap:
- added `IdentityReferenceCandidate`.
- added `queries.resolvePayloadRecipient({ reference, recipients })`.
- exact revoke can resolve refs against payload recipients, including unknown-to-local identities.
- identity forget command mapping now explicitly resolves known identity before forgetting.

### Assistant
Filled exact grant resolver gap:
- added `queries.resolveGrantRecipient({ reference, payloadRecipients })`.
- exact grant can resolve known identities, pasted identity strings, and already-granted payload recipients.
- grant command mapping now includes decrypt + resolveGrantRecipient + grant mutation.

### Assistant
Fixed command-to-core mapping drift:
- const values now match interface values.
- edit/update mappings include early `decryptPayload`.
- revoke mapping includes `resolvePayloadRecipient`.
- forget mapping includes `resolveKnownIdentity`.

### Assistant
Created `6-NOTICE_SUCCESS_SPEC.md`.

Covered:
- core notices and CLI mappings.
- CLI-only rotate warning.
- success message ids.
- success outcome params.
- idempotent success cases.
- output channel rules for machine stdout, human stdout, and status-only commands.

### Assistant
Aligned core edit outcome:
- `editPayload` result outcome now uses `edited | unchanged`, not `rewritten | unchanged`.

### Assistant
Specified global home-state preflight:
- applies to all commands except `setup`.
- runs before passphrase prompts and payload reads.
- missing home maps to setup-required.
- successful migration emits `INFO.HOME.STATE_MIGRATED`.
- core APIs still keep home read errors for callers without CLI preflight.

### Assistant
Refined preflight ordering:
- malformed command/protocol errors fail before home preflight.
- headless missing promptable operands fail before home preflight.
- guided interactive prompts happen after home preflight.

### User
Asked whether specification is complete enough.

Proposed implementation rollout:
- park current package CLI as `cli-legacy` so it stops being the active CLI but remains referenceable.
- create a new core package first.
- new core should cover 100% of MVP needs/specs with full edge-case test coverage.
- create the new CLI from scratch on top of the new core and current specs.

Asked whether more grilling is needed.

### Assistant
Answered:
- specs are strong enough to start implementation planning, but not fully done if the goal is "use specs as implementation source of truth."
- remaining grilling should focus on rollout/package strategy, core persistence/port details, test fixture strategy, and CLI presentation contract.
- warned that moving legacy CLI too early can break the published binary/import paths unless the package entrypoints are handled deliberately.

### User
Clarified implementation rollout constraint:
- breaking current local CLI during MVP reimplementation is acceptable.
- nothing will be released until the new version is clean and ready.
- rename current package/folder to `cli-legacy`.
- remove command bin from legacy package.
- mark legacy package private.

### Assistant
Persisted rollout decision:
- `cli-legacy` is source reference only.
- no hidden/public `bage-legacy` binary required.
- package/bin compatibility is not a constraint during reimplementation.

### Assistant
Asked persistence/fixture question:

Should new core own exact persisted document formats now, as versioned schemas with fixtures from day one?

Recommended:
- yes.
- define `HomeStateDocument v1`, `PayloadDocument v1`, and `PublicIdentityString v1`.
- build parse/migrate/read/write fixture tests before CLI work.

### User
Agreed and clarified:
- migration must already exist as a mechanism and be thoroughly tested.
- new rebuild can initialize schemas at v1.
- new MVP does not need compatibility with previous prototype schemas.
- this intentional breaking change is safe because CLI is not distributed yet.

### Assistant
Persisted:
- new persisted formats start at v1.
- legacy/prototype schema compatibility is explicitly out of scope.
- migration mechanism still exists from day one and must be tested.

### Assistant
Asked v1 envelope question:

Recommended every persisted/shareable artifact has:
- explicit `kind`
- explicit `version`

Suggested kinds:
- `better-age/home-state`
- `better-age/payload`
- `better-age/public-identity`

Reason:
- kind prevents parsing wrong artifact type.
- version drives migration.

### User
Agreed:
- sounds neat.

### Assistant
Created `7-PERSISTENCE_SCHEMA_SPEC.md`.

Captured:
- artifact kinds/version policy.
- `HomeStateDocument v1`.
- `PayloadDocument v1` and encrypted plaintext envelope.
- `PublicIdentityString v1`.
- migration contract.
- required fixtures.

### Assistant
Asked encrypted private key storage question:

Recommended:
- `home-state.json` stores metadata + refs.
- `keys/<fingerprint>.age` stores encrypted private key bytes.

Reason:
- passphrase change/rotation can operate per key.
- home document stays readable metadata.
- private key blobs can be fixture-tested independently.
- refs avoid large state doc churn.

### User
Agreed and clarified:
- this matches age's built-in encrypted-key style.
- this is what the project wants.
- better-age should remain just an age wrapper with great UX.

### Assistant
Persisted:
- encrypted private keys are separate age-encrypted blobs.
- no custom outer crypto container.
- added `PrivateKeyPlaintextV1` as plaintext inside the encrypted blob.
- added required encrypted-key fixture categories.

### Assistant
Recommended crypto test split:
- unit tests use fake crypto port for deterministic core logic.
- integration tests use real age adapter fixtures.

Reason:
- core behavior tests stay stable/fast.
- real age compatibility is still proven at adapter boundary.

### User
Agreed and requested:
- mention both integration and unit tests.
- define guidelines/scope.

### Assistant
Created `8-TEST_STRATEGY_SPEC.md`.

Covered:
- core unit tests.
- core integration tests.
- migration fixture tests.
- CLI contract tests.
- varlock integration tests.
- coverage bias by concern.

### Assistant
Ran final core API/persistence alignment checks.

Found and fixed:
- persistence schema existed only in prose, not in `1-BOUNDARY_API_SPEC.ts`.
- added typed v1 document shapes to boundary spec:
  - `HomeStateDocumentV1`
  - `PrivateKeyPlaintextV1`
  - `PayloadPlaintextV1`
  - `PayloadDocumentV1`
  - `PublicIdentityStringV1`
  - `MigrationResult`
- added `EncryptedPrivateKeyRef`.
- typed `saveCurrentHomeStateDocument`.
- typed encrypted private key read/write refs.
- split identity key crypto concerns into `IdentityCryptoPort`.
- made `PayloadCryptoPort` operate over typed payload/private-key plaintexts.
- added private-key artifact kind/version to persistence schema lists.
- updated PRD/worklist stale open-work text now that rollout/test/persistence strategy is captured.

### User
Asked whether specs are good enough and whether to proceed to implementation planning.

Mentioned usual flow:
- synthesize PRD with `to-prd` as markdown only, no GitHub issue.
- break PRD into tracer-bullet phase plan with `prd-to-plan`.

Asked whether a prior macro implementation planning pass is needed because the project is large.

### Assistant
Recommended:
- do one short macro implementation architecture pass before PRD.
- purpose is not another spec/grill phase, but to define build modules, package order, test harness, and migration/fixture strategy so the PRD is implementation-grade.
- then write PRD.
- then use PRD-to-plan for tracer bullets.

### User
Agreed:
- do the macro implementation architecture pass.

### Assistant
Created `9-MACRO_IMPLEMENTATION_ARCHITECTURE.md`.

Captured:
- current workspace reality.
- target packages and rollout.
- dependency direction.
- core deep modules.
- core ports/adapters.
- new CLI macro modules.
- varlock macro module.
- recommended build order.
- first tracer bullet candidate.
- implementation planning guidance.
- risks and PRD readiness.

### User
Asked to lock technology choices before PRD:
- whether to keep EffectTS.
- whether to use `@effect/cli` or another CLI package.

### Assistant
Recommended:
- use `effect` heavily in core.
- use `effect` in CLI for command handlers, ports, wiring, and error mapping.
- use `@effect/cli` for command/subcommand parsing, args/options, help/usage, and prompt primitives where good enough.
- do not treat `@effect/cli` as a full TUI.
- build internal `CliPresenter` for message-id-based rendering.
- do not pick commander/yargs/inquirer unless `@effect/cli` prompt UX proves insufficient.

### User
Agreed and clarified:
- rendered output needs styling, especially interactive mode.
- styling includes emoji, color, bold, etc.

### Assistant
Persisted technology choice:
- `effect` for core.
- `effect + @effect/cli` for CLI.
- internal presenter boundary owns emoji/color/bold/minimal ANSI rendering.
- machine stdout remains unstyled.

### Assistant
Created PRD markdown using `to-prd` workflow:
- `10-PRD_MVP_REIMPLEMENTATION.md`
- one umbrella PRD, not multiple PRDs.
- covers problem, solution, user stories, implementation decisions, testing decisions, out of scope, notes.

### User
Asked to write the implementation plan using `prd-to-plan`.

### Assistant
Prepared proposed tracer-bullet phase breakdown for approval before writing final plan file.

Proposed phases:
- legacy parking and workspace skeleton
- artifact/migration/test harness foundation
- core identity/key lifecycle
- core payload lifecycle
- real adapters integration
- new CLI shell/presenter + identity commands
- new CLI payload create/read/edit/load commands
- new CLI grant/revoke/update guided flows
- varlock load protocol integration
- final contract hardening

### User
Approved proposed tracer-bullet breakdown.

### Assistant
Created final plan:
- `plans/better-age-mvp-reimplementation.md`
- 11 phases.
- each phase includes user stories, what to build, and acceptance criteria.
