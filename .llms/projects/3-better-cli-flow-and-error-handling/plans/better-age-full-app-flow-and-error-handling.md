# Plan: Better Secrets Full App Flow And Error Handling

> Source PRD: [packages/cli/PRD_FULL_APP_FLOW_AND_ERROR_HANDLING.md](../packages/cli/PRD_FULL_APP_FLOW_AND_ERROR_HANDLING.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Command model**: direct commands stay first-class; `interactive` is a guided hub over the same underlying command semantics, not a separate product.
- **Invocation axes**: every human command is reasoned about through `exact` vs `guided` invocation and `interactive-terminal` vs `headless-terminal` capability.
- **Outcome model**: every top-level command ends as exactly one of `OK`, `CANCEL`, or `ERROR`.
- **Navigation semantics**: `Back` is local navigation; `Cancel` stops intentionally; standalone guided final `Back` maps to `CANCEL`.
- **Argument authority**: explicit args are authoritative and must never be reinterpreted or fall back to chooser flows.
- **Maintenance semantics**: exact mutation commands never auto-run maintenance; guided mutation commands may offer an explicit update gate.
- **Secure input semantics**: human passphrase entry always uses secure prompts; no plaintext passphrase path in target human flows.
- **Machine load contract**: `load` remains exact-only, requires secure interactive passphrase input, is impossible in headless mode, and may warn on update-needed while still succeeding.
- **Message contract**: user-facing failures render from a central error catalog; raw exception messages and implementation details must not leak to users.
- **Sink rules**: success/info use stdout, errors/warnings/remediation use stderr, viewer/menu remain distinct interaction surfaces.
- **Shared behavior strategy**: setup gate, update gate, payload target resolution, identity ref resolution, passphrase policy, and error rendering should become deep reusable modules.
- **Identity intake strategy**: grant-like identity entry must use one canonical intake flow that accepts local alias, display name, handle, and full identity string; full identity strings may upsert known identity state before the original action continues.
- **Reference set**: implementation converges toward the interaction flow spec, error message spec, and append-only decision log.

---

## Phase 0: Drift Inventory And Contract Map

**User stories**: 38, 39, 41

### What to build

Create an explicit current-state-to-target-state drift inventory before changing runtime behavior. This slice should compare every command and shared flow family against the target interaction and error-message contracts, then freeze a concrete implementation order based on highest-risk drift.

The result is a maintained drift matrix that identifies:
- missing target branches
- incorrect branch behavior
- missing guided recovery loops
- wrong sink usage
- generic/raw error rendering
- missing tests by branch family

### Acceptance criteria

- [x] Every command is mapped against target-state flow expectations.
- [x] Every shared flow family is mapped against target-state flow expectations.
- [x] Error rendering drift is categorized by message quality, sink choice, and missing remediation.
- [x] Test coverage drift is categorized by branch family, not by file count.
- [x] The rest of the phases can reference a stable drift inventory instead of rediscovering current behavior ad hoc.

---

## Phase 1: Core Outcome And Message Rendering

**User stories**: 7, 36, 37, 39, 40

### What to build

Build the central runtime contract for top-level outcomes, warning/error rendering, and sink behavior. This slice should make the CLI capable of expressing `OK`, `CANCEL`, and `ERROR` consistently and route all user-facing failures through one normalized renderer instead of scattered raw `.message` output.

This slice should also establish the warning contract for non-fatal stderr output and ensure intentional cancel paths do not surface as noisy errors.

### Acceptance criteria

- [x] A central renderer exists for user-facing errors and warnings.
- [x] Generic/raw error text no longer leaks from covered paths in this phase’s scope.
- [x] Success/info and error/warning sink behavior follow the target contract.
- [x] Intentional cancel/abort paths can be represented without masquerading as errors.
- [x] A first end-to-end path demonstrates the normalized outcome + renderer stack working together.

---

## Phase 2: Shared Runtime Gates And Passphrase Policies

**User stories**: 13, 14, 15, 16, 17, 18, 22, 40

### What to build

Implement the reusable runtime gates and secure-input policies that multiple commands depend on: setup gate, update gate, one-shot secure passphrase input, guided passphrase retry, and passphrase-pair entry.

This slice should make setup-required and update-required flows converge on one shared behavior model and ensure secure input behavior is consistent across human commands.

### Acceptance criteria

- [x] Setup gate behavior matches the target contract for exact vs guided and interactive vs headless.
- [x] Update gate behavior matches the target contract for guided human mutation commands.
- [x] Guided passphrase retry loops are centralized and reusable.
- [x] Exact passphrase behavior remains strict and non-looping.
- [x] Wrong-passphrase and blocked-by-setup/update paths are demoable through one covered command each.

---

## Phase 3: Shared Payload Target Resolution

**User stories**: 3, 4, 5, 9, 10, 11, 12, 40

### What to build

Implement the shared payload target-resolution system for both existing-payload commands and create/new-target flows. This slice should make payload-path behavior consistent across exact and guided usage while preserving the explicit-args-are-authoritative rule.

It should also fully separate existing-payload resolution from new-payload resolution so create no longer shares inappropriate discovery logic with read/mutation commands.

### Acceptance criteria

- [x] Existing-payload target resolution is shared across all relevant commands.
- [x] New-payload target resolution is shared across create flows only.
- [x] Exact path behavior never falls back to chooser logic.
- [x] Guided existing-payload flows can discover, select, or manually enter a path.
- [x] Guided create flows support explicit overwrite choice without silent overwrite.

---

## Phase 4: Shared Identity Resolution And Recovery

**User stories**: 28, 29, 30, 31, 32, 33, 40

### What to build

Implement the shared identity resolution layer for identity refs and identity strings. This slice should unify explicit refs, chooser flows, typed refs, pasted identity strings, ambiguity handling, and self-forbidden cases across grant, revoke, forget, and add-identity behavior.

It should also establish the guided recovery menus for invalid identity input, ambiguous matches, and self-forbidden identity paths.

### Acceptance criteria

- [x] Identity-ref resolution behavior is shared across the commands that need it.
- [x] Ambiguous identity refs never auto-select a candidate.
- [x] Guided typed-input ambiguity and invalid-input recovery match the target contract.
- [x] Self-forbidden identity paths use explicit command-appropriate messaging.
- [x] Grant can accept identity strings directly and refresh local known identities as part of the same flow.

---

## Phase 5: Read-Path Command Convergence

**User stories**: 1, 2, 6, 19, 20, 21, 23, 24, 25, 27, 41, 42

### What to build

Converge the read-oriented command paths onto the target interaction model: `me`, `identities`, `inspect`, `view`, and `load`.

This slice should make read-path commands consistent in setup handling, passphrase policy, output pause behavior, viewer behavior, warning behavior, and exact-vs-guided behavior where applicable.

### Acceptance criteria

- [x] `me` and `identities` expose the intended distinct read surfaces.
- [x] `inspect` follows the target guided/direct behavior and output acknowledgment behavior.
- [x] `view` opens the secure viewer directly after prerequisites and no longer uses redundant reveal confirmation.
- [x] `load` follows the exact-only secure-passphrase model and warning-on-update contract.
- [x] Read-path command behavior is consistent with the shared gates, target resolution, and renderer modules.

---

## Phase 6: Mutation And Identity-Maintenance Command Convergence

**User stories**: 1, 2, 6, 15, 16, 17, 18, 28, 29, 30, 31, 32, 33, 34, 35, 41, 42

### What to build

Converge the mutation and identity-maintenance command paths onto the target interaction model: `setup`, `create`, `edit`, `grant`, `revoke`, `update`, `add-identity`, `forget-identity`, `rotate`, and `change-passphrase`.

This slice should make mutation flows share setup/update gating, secure input handling, explicit-arg strictness, idempotent unchanged-success behavior, edit retry behavior, and normalized failure rendering.

### Acceptance criteria

- [x] `setup` follows the final exact vs guided alias/passphrase policy.
- [x] `create` follows the final new-target-only guided path and strict exact overwrite rule.
- [x] `edit` supports reopen/discard/cancel on invalid env with preserved temp contents.
- [x] `grant` and `revoke` follow the final update-gated and identity-resolution behavior.
- [x] `update` remains explicit maintenance with structured success reasons.
- [x] Identity-maintenance commands follow final success/error handling and no-op semantics.

---

## Phase 7: Interactive Session Convergence

**User stories**: 8, 25, 26, 27, 41, 42

### What to build

Converge `interactive` into a pure navigation shell over the already-converged command flows. This slice should wire the root menu, files menu, identity menu, pause-vs-no-pause behavior, and session-return semantics onto the shared command flows without inventing separate business behavior.

### Acceptance criteria

- [x] `interactive` requires an interactive terminal and follows the target setup-on-entry policy.
- [x] Root/files/identity menus match the approved final menu structure.
- [x] Running a flow from `interactive` reuses command semantics instead of duplicating divergent logic.
- [x] Subflow `Back`/`Cancel` returns to the correct menu rather than ending the whole session.
- [x] Interactive read outputs and short status outputs follow the final acknowledgment rules.

---

## Phase 8: Spec-To-Test Closure

**User stories**: 38, 39, 41, 42

### What to build

Close the gap between the target documents and the test suite. This slice should turn the flow spec coverage checklist and error-message contract into concrete command, integration, and e2e verification coverage so future drift becomes visible quickly.

This is where the implementation becomes defendable as “matches spec”, not just “seems right”.

### Acceptance criteria

- [x] Every top-level command has coverage for `OK`, `CANCEL` where reachable, and `ERROR`.
- [x] Shared gate and resolution flows have isolated coverage for their branch families.
- [x] Guided recovery loops have explicit coverage.
- [x] Warning rendering and sink behavior are covered, including `load` update warning.
- [x] The remaining uncovered branches, if any, are explicitly listed and justified.

---

## Phase 9: Unified Identity Intake And Collision Handling

**User stories**: 28, 29, 30, 31, 43, 44, 45

### What to build

Replace the split grant identity-entry model with one canonical identity-intake flow. This slice should remove the current overlapping `Paste/import identity string` vs `Enter ref` distinction and make one input path accept:
- local alias
- display name
- handle
- full identity string

This slice must classify entered text centrally:
- if it is a full identity string, decode and upsert known identity state first
- if it is not a full identity string, resolve it against alias/display name/handle

When a full identity string is newer than local state, refresh the known identity. When it is already current, reuse that identity immediately for the original action. When guided interactive import would create a visible-label collision, prompt for a unique local alias before saving the upserted identity. Exact flows must still accept the identity string without blocking on alias prompt.

Implementation details:
- replace grant menu branch pair with one `Enter identity` action
- extract one shared identity-intake classifier module
- move identity-string decode/upsert + optional guided alias collision handling behind that module
- keep command-specific self-forbidden and ambiguity rendering at the boundary
- update guided prompt copy and tests to stop assuming separate paste/ref branches
- refresh spec/test closure docs after this phase because Phase 8 coverage predates the refined identity-intake contract

### Acceptance criteria

- [x] Grant no longer exposes separate `Paste/import identity string` and `Enter ref` menu branches.
- [x] One shared identity-intake flow accepts alias, display name, handle, and full identity string.
- [x] Full identity string intake auto adds, refreshes, or reuses known identity state before the original action continues.
- [x] Guided interactive flow prompts for a unique local alias only when imported visible label would collide with self or another known identity visible label.
- [x] Exact flow still accepts full identity strings without blocking on alias prompt.
- [x] Grant tests and flow spec reflect the unified identity-intake contract.
