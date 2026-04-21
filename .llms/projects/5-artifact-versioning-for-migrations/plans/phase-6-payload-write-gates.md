# Plan: Phase 6 Payload Write Gates

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 6: Payload Write Gates`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 6 applies payload migration policy to all mutating payload commands.

Phase 6 exists to make `edit`, `grant`, and `revoke` respect the already-built payload read/update boundaries. Readable-but-outdated payloads should no longer leak into ad-hoc per-command behavior. Interactive mutation flows should ask for explicit update acceptance, persist the update, then continue original intent only after update succeeds. Headless mutation commands should hard-fail with remediation and never partially mutate.

Target result:
- one shared mutation-gate contract for payload writes
- interactive write flows prompt before persisted update
- accepted prompt updates then resumes original write intent
- refused prompt aborts cleanly with no payload mutation
- headless writes hard-fail with remediation instead of auto-updating
- no mutating command partially executes after a gate failure

## Durable decisions for this phase

- payload is user-managed; mutating commands must not auto-migrate silently
- explicit persisted update happens before write intent, never interleaved with it
- interactive mode may offer `update now / back / cancel`
- headless mode never prompts
- headless outdated payload remediation is `Run: bage update <path>`
- unsupported newer payload versions hard-fail with update-CLI remediation, same as phase 4/5
- existing explicit `bage update <payload>` remains the only persisted update primitive
- phase 6 wires policy around existing mutation commands; it does not replace phase-5 update orchestration
- exhaustive matrix across all commands/modes remains phase 7

## Public interfaces to converge on

These are the behaviors phase 6 should make explicit and stable:

- define one shared payload-write gate decision seam that starts from command open/result state:
  - current payload -> continue original mutation
  - readable-but-outdated interactive -> prompt for explicit update acceptance
  - readable-but-outdated headless -> fail with remediation
  - unsupported newer -> fail with update-CLI remediation
- define one stable interaction contract for interactive payload mutation flows:
  - `update now` -> run `UpdatePayload`, then retry original mutation flow
  - `back` -> return to prior mutation-step boundary
  - `cancel` -> abort flow
- define one stable error/remediation contract for non-interactive mutation entrypoints:
  - no prompt
  - no update side effect
  - no partial original mutation

## Deep modules to create or reshape

- **Shared payload mutation gate**
  - small interface
  - owns update-required branching, prompt/no-prompt policy, and retry/back/cancel routing
- **Interactive mutation flows**
  - `edit`, `grant`, `revoke` guided flows should all reuse same gate contract
  - avoid each flow inventing its own update prompt semantics
- **Headless command boundaries**
  - direct command entrypoints should translate `UpdateRequiredError` into user-facing remediation
  - no headless command should call `UpdatePayload` implicitly
- **No-partial-mutation guard**
  - ensure original write action does not start before update gate resolves

These should stay deeper than callers:
- command handlers should not branch on schema version directly
- prompt copy/options should not be duplicated per flow
- flows should not manually compose `UpdatePayload` retry logic in several places

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 6:
- interactive edit/grant/revoke on outdated-but-readable payload prompts before mutation
- accepting prompt updates then continues original intent
- choosing back returns control without mutation
- choosing cancel aborts without mutation
- headless edit/grant/revoke on outdated-but-readable payload fails with `bage update <path>` remediation
- unsupported newer payload still fails with update-CLI remediation
- no encrypt/write for original mutation occurs before successful update gate resolution

Good tests for this phase:
- integration-style tests at flow/command boundaries
- assert prompt output/options and final user-visible behavior
- assert mutation side effects happen only after update acceptance
- reuse existing command/flow seams instead of testing helpers directly

Bad tests for this phase:
- asserting internal helper call order
- retesting phase-5 payload-update rewrite details
- retesting phase-4 read-warning behavior
- exhaustive cross-product matrix beyond tracer-bullet proof

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Interactive edit prompts before mutation on outdated payload

**Behavior to prove**
- guided `edit` on readable-but-outdated payload does not mutate immediately
- user is prompted to update first

**RED**
- add one integration-style test at interactive edit flow boundary

**GREEN**
- route `EditPayloadUpdateRequiredError` through shared mutation gate

**REFACTOR**
- keep prompt policy in one shared gate seam

### Slice 2: Accepting interactive edit prompt updates then resumes edit

**Behavior to prove**
- choosing `update now` runs `UpdatePayload`
- after update succeeds, original edit intent resumes
- no duplicate prompt loop for same stale state after successful retry

**RED**
- add one behavior test for `edit` happy path through prompt -> update -> retry

**GREEN**
- wire update-then-retry flow for interactive edit

**REFACTOR**
- shape retry logic so grant/revoke can reuse it

### Slice 3: Back/cancel interactive edit exits without mutation

**Behavior to prove**
- choosing `back` returns to prior path-selection boundary
- choosing `cancel` aborts
- neither choice mutates payload

**RED**
- add one behavior test for `back`
- add one behavior test for `cancel`

**GREEN**
- use existing payload-mutation flow step contract to route both outcomes

**REFACTOR**
- keep navigation semantics independent from edit-specific logic

### Slice 4: Interactive grant/revoke reuse same gate behavior

**Behavior to prove**
- guided `grant` and `revoke` prompt exactly like guided `edit`
- accepted update resumes original mutation
- no per-command policy drift

**RED**
- add one integration-style test for `grant`
- add one integration-style test for `revoke`

**GREEN**
- move/update shared mutation gate seam so all guided mutation flows reuse it

**REFACTOR**
- remove duplicated gate wiring across mutation flows

### Slice 5: Headless mutation commands hard-fail on outdated payload

**Behavior to prove**
- direct `edit/grant/revoke <path>` style invocations do not prompt
- they fail with `Run: bage update <path>` remediation
- original mutation does not happen

**RED**
- add one command-level behavior test for one headless mutation command

**GREEN**
- translate update-required branch into remediation failure at headless boundary

**REFACTOR**
- share remediation rendering across headless mutation commands

### Slice 6: Unsupported newer payload preserves update-CLI remediation

**Behavior to prove**
- mutating commands on newer payload hard-fail
- remediation says update CLI, not payload
- no mutation starts

**RED**
- add one command/flow test for unsupported newer payload in mutation path

**GREEN**
- map newer-version branch cleanly through mutation gates

**REFACTOR**
- keep outdated-readable vs unsupported-newer branches explicit and separate

### Slice 7: No-partial-mutation guarantee

**Behavior to prove**
- if update gate fails, aborts, or is refused, original mutation side effects never start
- if update succeeds, original mutation starts only after update completion

**RED**
- add one high-signal regression test around side-effect ordering

**GREEN**
- tighten orchestration boundary so mutation actions happen only after gate resolution

**REFACTOR**
- make orchestration small enough that phase-7 matrix can extend it safely

## Suggested test order

Write tests in this order:

1. interactive edit prompts before mutation
2. accepting interactive edit prompt updates then resumes edit
3. back/cancel interactive edit exits without mutation
4. interactive grant/revoke reuse same gate behavior
5. headless mutation commands hard-fail on outdated payload
6. unsupported newer payload preserves update-CLI remediation
7. no-partial-mutation guarantee

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-6 edge cases worth testing

These are still phase-6 relevant because they protect write-gate contract:

- prompt should not appear for already-current payloads
- prompt should not appear in headless mode
- `update now` failure should surface update error and stop original mutation
- `back` should preserve current path when appropriate and reprompt path when appropriate
- `cancel` should stay quiet where guided flow already treats cancel as non-error
- direct path mutation should render remediation using resolved path
- no mutation command should write partial payload contents before update gate resolves

## Explicit non-goals for phase 6

Do not pull these into phase 6:

- changing phase-5 explicit update rewrite semantics
- changing phase-4 read-warning behavior
- exhaustive all-commands x all-modes x all-version-paths matrix
- support-cutoff policy expansion beyond needed mutation-path proof
- home migration behavior

## Definition of done

Phase 6 is done when:

- all mutating payload commands share one consistent migration gate policy
- interactive mutation flows prompt before explicit update on outdated-but-readable payloads
- accepting prompt updates then resumes original mutation
- refusing prompt aborts/backs without mutation
- headless mutation commands hard-fail with `bage update <path>` remediation
- unsupported newer payloads still fail with update-CLI remediation
- no mutating command partially executes after gate failure
- the phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

- Does phase 6 keep `UpdatePayload` as the only persisted update primitive?
- Are interactive and headless mutation policies clearly separated?
- Do guided mutation flows reuse one gate contract?
- Does remediation distinguish outdated-readable vs unsupported-newer?
- Is no-partial-mutation guaranteed?
