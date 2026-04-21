# Plan: Phase 7 Support-Cutoff and Exhaustive Test Matrix

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 7: Support-Cutoff and Exhaustive Test Matrix`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 7 locks the migration architecture against future drift.

Phases 1-6 already built the runtime behavior. Phase 7 exists to prove the support promise stays true over time: all supported historical versions remain migratable by default, explicit hard-break policy is the only valid cutoff mechanism, remediation copy stays correct per branch, and write flows never partially mutate when blocked by migration policy.

Target result:
- exhaustive historical-version tests for supported artifact chains
- explicit hard-break policy tests at artifact integration level
- command-matrix tests proving remediation stays correct
- no-partial-mutation regression tests across payload write flows
- confidence that future breaking changes can ship with controlled cutoffs

## Durable decisions for this phase

- phase 7 is primarily test coverage and regression proofing, not new product behavior
- default support promise remains: all released versions forward-migratable unless explicit policy blocks them
- explicit hard-break tables remain the only legitimate cutoff mechanism
- unsupported newer and hard-broken older are different branches and must stay different
- payload read/write, interactive/headless, and home/payload policy differences must stay contractually proven
- no-partial-mutation remains a top-level invariant for payload writes

## Public interfaces to converge on

These are the behaviors phase 7 should make explicit and stable through tests:

- supported historical artifacts normalize to current through adjacent chains
- explicit hard-break policy flips a migratable artifact into hard-fail only when declared
- home preflight auto-migrates managed state while payload writes remain gated
- payload reads vs payload writes preserve different remediation/continuation rules
- interactive vs headless payload writes preserve different gate behavior
- unsupported newer branches always remediate with update-CLI, never update-payload

## Deep modules to create or reshape

- **Historical version fixtures**
  - canonical legacy docs/envelopes per released version
  - enough realism to catch actual migration drift
- **Artifact support-policy specs**
  - home integration-level cutoff tests
  - payload read/update/write cutoff tests
- **Command behavior matrix specs**
  - read/write x interactive/headless x outdated-readable/unsupported-newer
- **No-partial-mutation regression harness**
  - assert mutation side effects never start before gate resolution

These should stay deeper than callers:
- avoid scattering ad-hoc legacy fixtures through many tests
- avoid re-explaining behavior with duplicated near-identical assertions
- keep matrix proof compact but explicit

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 7:
- every supported historical payload/home path migrates to current
- explicit hard-break cutoff blocks old versions that would otherwise migrate
- unsupported newer branches keep update-CLI remediation
- outdated-readable payload reads still succeed with warning semantics
- outdated-readable payload writes still require explicit update or hard-fail headless
- no partial mutation occurs across edit/grant/revoke when gate rejects or fails

Good tests for this phase:
- integration-style tests around real artifact definitions and command seams
- table-driven tests where matrix is inherently list-shaped
- explicit fixture-per-version coverage for released schema history
- regression tests that encode contract, not internal helper calls

Bad tests for this phase:
- re-testing low-level migration helper internals already covered in earlier phases
- huge horizontal bulk tests with weak assertions
- tests that duplicate same branch at too many layers without adding coverage

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Supported legacy chains stay migratable by default

**Behavior to prove**
- each released legacy payload/home version still normalizes to current when no cutoff policy applies
- multi-hop chains work end-to-end with real artifact definitions

**RED**
- add one table-driven integration test for supported payload legacy versions
- add one table-driven integration test for supported home legacy versions

**GREEN**
- add missing fixtures/helpers needed to express released-version coverage cleanly

**REFACTOR**
- centralize legacy fixtures so future versions extend one obvious place

### Slice 2: Explicit hard-break policy is the only valid cutoff

**Behavior to prove**
- a migratable legacy artifact fails only when explicit hard-break policy blocks it
- same artifact succeeds when policy does not block it

**RED**
- add one integration test pair around payload cutoff
- add one integration test pair around home cutoff

**GREEN**
- wire any missing artifact-level policy injection seams needed by tests

**REFACTOR**
- keep cutoff-vs-default-support assertions symmetric and easy to extend

### Slice 3: Unsupported newer vs hard-broken older stay distinct

**Behavior to prove**
- newer artifact => update-CLI remediation
- hard-broken older artifact => no-longer-supported migration remediation
- branches stay distinguishable at app/command boundary

**RED**
- add one high-signal test per branch at payload read or update boundary

**GREEN**
- tighten any message/result mapping if tests expose drift

**REFACTOR**
- avoid collapsing different failure causes into one generic path

### Slice 4: Payload read/write matrix stays contractually correct

**Behavior to prove**
- read interactive: succeeds + warning
- read headless: succeeds + stderr warning
- write interactive outdated-readable: prompt gate
- write headless outdated-readable: `bage update <path>` remediation

**RED**
- add one compact matrix-style test set at command/flow boundary

**GREEN**
- only patch assertions or seams if phase-6 policy drift is exposed

**REFACTOR**
- keep matrix compact; avoid duplicating same behavior per command unless signal differs

### Slice 5: No-partial-mutation invariant across write commands

**Behavior to prove**
- `edit`, `grant`, and `revoke` never start original mutation side effects when gate rejects, cancels, fails, or unsupported-version branch triggers

**RED**
- add one side-effect-order regression test per command family or one shared harness if viable

**GREEN**
- patch orchestration only if side-effect ordering drift appears

**REFACTOR**
- hide duplicated side-effect harness setup behind minimal test helpers

### Slice 6: Update command remains deterministic across all reasons

**Behavior to prove**
- explicit `bage update` still reports `nothing / format / self / both`
- rerun remains idempotent even with legacy fixtures from full history set

**RED**
- add one regression set that reuses full-history fixtures against explicit update command

**GREEN**
- patch fixture coverage or result mapping if needed

**REFACTOR**
- keep update-command regression table aligned with phase-5 public contract

### Slice 7: Final contract sweep

**Behavior to prove**
- current matrix is complete enough to block silent drift on support policy and migration behavior

**RED**
- add one “matrix completeness” spec comment/table test only if a real uncovered branch remains

**GREEN**
- fill the smallest missing branch only

**REFACTOR**
- prune overlap; keep final suite high-signal

## Suggested test order

Write tests in this order:

1. supported legacy chains stay migratable by default
2. explicit hard-break policy is the only valid cutoff
3. unsupported newer vs hard-broken older stay distinct
4. payload read/write matrix stays contractually correct
5. no-partial-mutation invariant across write commands
6. update command remains deterministic across all reasons
7. final contract sweep

Only after these pass:
- prune redundant tests exposed by the final matrix

## Phase-7 edge cases worth testing

These are still phase-7 relevant because they protect long-term support guarantees:

- payload/current fixtures should not accidentally bypass persisted-schema checks
- home cutoff should not interfere with normal current-state startup
- hard-broken old artifact should not be misreported as unsupported-newer
- missing-path should stay distinguishable from intentional hard-break if a migration step is removed accidentally
- explicit update should not become a hidden downgrade/target-version tool
- warning vs remediation wording should stay stable enough for scripts and docs

## Explicit non-goals for phase 7

Do not pull these into phase 7:

- new migration behavior not already justified by failing regression tests
- adding arbitrary target-version migration
- redesigning command UX already settled in phases 4-6
- expanding artifact scope beyond home/payload/public-identity chain

## Definition of done

Phase 7 is done when:

- supported released versions are covered by explicit regression fixtures
- explicit hard-break policy is proven to be the only cutoff mechanism
- unsupported newer vs hard-broken older branches are both tested and distinct
- read/write x interactive/headless policy differences are proven by tests
- no-partial-mutation invariant is proven across payload write flows
- explicit update command remains deterministic across full supported history
- final suite meaningfully raises confidence for future breaking changes

## Review checklist

- Does the suite prove default support promise, not just happy paths?
- Are cutoffs tested at real artifact integration points, not just engine unit level?
- Is unsupported-newer distinct from hard-broken older everywhere it matters?
- Is no-partial-mutation proven, not assumed?
- Is the final matrix high-signal rather than bloated?
