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
