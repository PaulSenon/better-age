# Plan: Phase 2 Shared Migration Engine Skeleton

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 2: Shared Migration Engine Skeleton`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 2 is not command integration yet.

Phase 2 exists to introduce one shared migration engine contract and one explicit artifact-policy boundary so later home/payload flows can depend on one stable migration model instead of each flow inventing its own version logic.

Target result:
- one shared migration engine for versioned artifacts
- one explicit artifact definition shape with current version + adjacent steps
- one explicit artifact policy shape with hard-break cutoffs
- one deterministic classification model: current / legacy / unsupported
- one deterministic normalization model: migrate only to current runtime shape

## Durable decisions for this phase

- explicit schema version markers, no shape inference
- adjacent migrations only
- normalize only to current runtime shape
- support all released versions by default
- intentional de-support only through explicit per-artifact hard-break policy table
- unsupported newer versions and intentional hard-breaks must stay distinguishable
- no command UX wiring yet
- no home preflight yet
- no payload preflight yet

## Public interfaces to converge on

These are the behaviors phase 2 should make explicit and stable:

- define one versioned artifact with:
  - artifact id
  - current schema version
  - explicit adjacent migration steps
  - version reader
- define one artifact policy with:
  - default allow support
  - optional hard-break cutoffs / denied versions
  - remediation metadata hook surface
- classify an input artifact version against:
  - current runtime version
  - artifact policy
- migrate a legacy artifact step-by-step to current shape
- fail deterministically for:
  - unsupported newer artifact
  - intentionally hard-broken older artifact
  - missing migration path

## Deep modules to create or reshape

- **Migration Engine core**
  - small interface
  - owns classification + multi-hop execution
- **Artifact Definition**
  - one artifact’s version reader, current version, and adjacent steps
- **Artifact Policy**
  - hard-break support window rules only
- **Migration Result model**
  - explicit machine-readable status for current / migrated / unsupported / broken

These should stay deeper than callers:
- artifact-specific code should declare versions and steps, not orchestrate chain execution
- home/payload flows should later consume results, not implement version math
- policy should remain data/config shaped, not distributed conditionals

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 2:
- current artifact is classified as current and not rewritten
- legacy artifact with full adjacent path migrates to current
- multi-hop migration executes in version order only
- missing adjacent step fails clearly
- newer unsupported version fails distinctly from hard-break policy failure
- hard-break policy failure is explicit and policy-driven, not incidental

Good tests for this phase:
- read like migration contract specs
- use one fake versioned artifact through public engine interface
- assert final classification/result, not internal helper calls
- prove path ordering through observable final value/history

Bad tests for this phase:
- asserting internal loop structure
- asserting exact helper names
- mixing command UX/remediation text into engine tests
- mixing home/payload file IO into engine tests

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Current artifact classification

**Behavior to prove**
- an artifact already at current schema version is classified as current
- engine returns current shape unchanged and does not report migration steps

**RED**
- add one domain-level behavior test for a fake artifact at current version

**GREEN**
- introduce minimal artifact definition + engine entrypoint needed to classify current version

**REFACTOR**
- keep version comparison and result-shape logic local to engine core

### Slice 2: Single-hop adjacent migration

**Behavior to prove**
- a legacy artifact one version behind migrates through one explicit adjacent step and ends as current

**RED**
- add one behavior test for `v1 -> v2`

**GREEN**
- add minimal adjacent-step execution support

**REFACTOR**
- hide step lookup/execution behind artifact definition contract

### Slice 3: Multi-hop migration chain

**Behavior to prove**
- a legacy artifact several versions behind migrates strictly through ordered adjacent hops until current

**RED**
- add one behavior test for `v1 -> v2 -> v3`

**GREEN**
- extend engine to iterate adjacent steps only

**REFACTOR**
- centralize chain walking so artifacts never implement multi-hop orchestration themselves

### Slice 4: Missing-path failure

**Behavior to prove**
- if a required adjacent step is missing, engine fails deterministically as unsupported migration path

**RED**
- add one behavior test for artifact `v1`, current `v3`, with only `v2 -> v3` registered

**GREEN**
- add minimal missing-path failure result/error branch

**REFACTOR**
- make path-resolution failure explicit and separate from policy failure

### Slice 5: Newer-version unsupported classification

**Behavior to prove**
- if artifact version is newer than runtime current version, engine fails as cli-too-old / newer-artifact branch

**RED**
- add one behavior test for artifact `v4` when runtime current is `v3`

**GREEN**
- add minimal unsupported-newer classification branch

**REFACTOR**
- keep newer-version detection independent from hard-break policy logic

### Slice 6: Hard-break policy table

**Behavior to prove**
- a legacy artifact that would otherwise be migratable is rejected only when explicit policy marks it unsupported

**RED**
- add one behavior test where path exists but policy intentionally blocks old version

**GREEN**
- introduce minimal artifact policy contract + hard-break evaluation

**REFACTOR**
- keep policy data-driven and external to migration-step registration

### Slice 7: Distinct failure semantics

**Behavior to prove**
- engine distinguishes:
  - current artifact
  - migrated legacy artifact
  - newer unsupported artifact
  - hard-broken old artifact
  - missing migration path

**RED**
- add one integration-style engine test matrix over one fake artifact family

**GREEN**
- fill smallest remaining gaps in result model until all branches are explicit

**REFACTOR**
- collapse duplicate branch-shaping into one result/error layer

## Suggested test order

Write tests in this order:

1. current version classifies as current
2. single-hop adjacent migration works
3. multi-hop migration works in order
4. missing adjacent path fails clearly
5. newer artifact fails as unsupported newer
6. hard-break policy blocks otherwise migratable old artifact
7. one small matrix test proves branch distinctions stay explicit

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-2 edge cases worth testing

These are still phase-2 relevant because they protect the engine contract:

- no-op current version does not report fake migration
- multi-hop chain never skips versions
- artifacts cannot register direct jump as substitute for missing adjacent hop
- missing step failure is distinct from newer-version failure
- hard-break failure is distinct from missing-path failure
- default policy remains allow when no cutoff configured
- engine result includes enough machine-readable state for later home/payload policy layers

## Explicit non-goals for phase 2

Do not pull these into phase 2:

- real home-state migration wiring
- real payload migration wiring
- payload read/write UX
- CLI remediation copy
- decrypt/read persisted payload files
- persist migrated artifacts to disk
- historical schemas for real artifacts beyond the minimum fake/test artifact needed to prove engine behavior

## Definition of done

Phase 2 is done when:

- one shared migration engine contract exists
- one artifact definition contract exists with explicit adjacent steps
- one policy contract exists for intentional hard-break cutoffs
- engine normalizes legacy artifacts only to current runtime shape
- engine distinguishes current / migrated / unsupported-newer / hard-broken / missing-path
- phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

Before starting implementation, verify:

- [ ] each planned test describes behavior, not implementation
- [ ] each slice is independently completable
- [ ] no slice smuggles in home/payload command integration
- [ ] hard-break policy remains explicit and data-driven
- [ ] adjacent-step-only rule stays enforced
- [ ] normalize-to-current remains the only destination
