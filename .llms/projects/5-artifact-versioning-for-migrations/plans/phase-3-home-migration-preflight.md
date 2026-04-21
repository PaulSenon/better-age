# Plan: Phase 3 Home Migration Preflight

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 3: Home Migration Preflight`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 3 is the first real artifact integration.

Phase 3 exists to wire `Home State` through one global preflight that runs before all command logic, auto-migrates legacy managed state, persists migrated home state eagerly, and fails fast when runtime/home compatibility is impossible.

Target result:
- one global home preflight entrypoint
- home state classified via shared migration engine
- legacy home state auto-migrated and persisted before command logic
- unsupported newer home state hard-fails before downstream logic
- embedded public identities migrate via shared identity migration, not home-specific identity logic

## Durable decisions for this phase

- home is managed internal state, not user-managed payload
- home preflight runs before any command-specific behavior
- home preflight may auto-persist even when downstream command is read-only
- unsupported newer home state must fail before command logic starts
- home container migration owns home shape only
- embedded self/known public identities reuse shared identity migration chain
- alias-map evolution stays local to home migration
- no payload preflight yet
- no payload UX/prompt logic yet

## Public interfaces to converge on

These are the behaviors phase 3 should make explicit and stable:

- define one home migration artifact definition using the shared migration engine
- define one home preflight service/use-case that:
  - loads home state
  - classifies current / legacy / unsupported
  - persists migrated legacy state
  - returns normalized current home state
- define one fail-fast result/error shape for unsupported newer home state
- define one integration point so app/CLI startup can require home preflight before command behavior runs

## Deep modules to create or reshape

- **Home migration definition**
  - home schema version reader
  - current version
  - adjacent home container steps
- **Home preflight service**
  - small interface
  - owns load -> classify -> migrate -> persist -> return normalized state
- **Home migration adapters**
  - migrate self / known public identity snapshots by delegating to shared identity migration
  - keep alias map local
- **CLI/App preflight boundary**
  - one place that enforces home compatibility before downstream command code

These should stay deeper than callers:
- command handlers should later assume compatible normalized home state
- callers should not do version branching themselves
- nested identity migration should not be reimplemented inside home steps

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 3:
- current home state passes through without persistence rewrite
- legacy home state auto-migrates and persists before command logic continues
- unsupported newer home state fails before command logic
- home preflight still runs in otherwise read-only flows
- embedded self/known identities are migrated via shared identity migration path
- alias map survives home migration as local-only state

Good tests for this phase:
- read like startup/preflight behavior specs
- exercise real preflight service through public interface
- verify persistence effects only through repository contract
- use one or two fake historical home versions, not broad matrix yet

Bad tests for this phase:
- asserting internal migration helper call order
- testing CLI prompt copy
- mixing payload artifact behavior into home tests
- asserting implementation details of repository internals

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Current home passes preflight unchanged

**Behavior to prove**
- current home state passes global preflight
- no persistence rewrite happens
- normalized state is returned for downstream use

**RED**
- add one behavior test for current-version home state through a public home preflight entrypoint

**GREEN**
- introduce minimal home migration definition + preflight service returning current state unchanged

**REFACTOR**
- keep current/pass-through logic inside preflight, not in callers

### Slice 2: Legacy home auto-migrates and persists

**Behavior to prove**
- legacy home state is migrated to current runtime shape and persisted before preflight returns

**RED**
- add one behavior test for one-version-behind home state

**GREEN**
- wire minimal legacy migration path + persistence writeback

**REFACTOR**
- hide classify/migrate/persist orchestration behind preflight service

### Slice 3: Multi-hop legacy home migration

**Behavior to prove**
- several-versions-behind home state migrates through ordered adjacent steps and persists current shape only

**RED**
- add one behavior test for `home v1 -> v2 -> v3`

**GREEN**
- extend home migration definition to support multi-hop through shared engine

**REFACTOR**
- keep home artifact versioning declarative; no custom hop loop in home code

### Slice 4: Unsupported newer home fails fast

**Behavior to prove**
- newer home state than runtime current fails before downstream command logic starts

**RED**
- add one behavior test where preflight sees newer home version and returns explicit unsupported error/result

**GREEN**
- map shared engine `unsupported-newer` branch into home preflight fail-fast branch

**REFACTOR**
- keep fail-fast mapping explicit and separate from legacy migration handling

### Slice 5: Preflight runs before command logic

**Behavior to prove**
- command/app entrypoint runs home preflight first
- if preflight fails, command-specific logic never runs
- if preflight succeeds, command sees normalized home state

**RED**
- add one integration-style test around one small app/CLI boundary

**GREEN**
- insert minimal preflight hook at one shared startup boundary

**REFACTOR**
- keep one enforcement point; avoid sprinkling preflight across commands

### Slice 6: Read-only downstream flow still allows auto-migration

**Behavior to prove**
- home preflight may persist migrated home state even when the eventual command is otherwise read-only

**RED**
- add one behavior test with a read-style downstream flow

**GREEN**
- ensure preflight path is independent of command mutability

**REFACTOR**
- make home-managed-state policy explicit in preflight docs/types if needed

### Slice 7: Nested identity migration delegation

**Behavior to prove**
- migrating legacy home state upgrades embedded self/known public identities by reusing shared identity migration logic
- alias map remains local and separate

**RED**
- add one behavior test with a legacy home snapshot containing old embedded public identities

**GREEN**
- hook home migration steps to shared identity migration adapters

**REFACTOR**
- isolate home-container migration from nested identity migration details

## Suggested test order

Write tests in this order:

1. current home passes unchanged
2. one-hop legacy home auto-migrates and persists
3. multi-hop legacy home migration persists current shape
4. unsupported newer home fails fast
5. global boundary runs home preflight before command logic
6. read-only downstream flow still allows home auto-migration
7. nested identity migration is delegated, alias map remains local

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-3 edge cases worth testing

These are still phase-3 relevant because they protect the home policy contract:

- no-op current home does not trigger save
- migrated home persists once, not repeatedly during same preflight
- unsupported newer home prevents downstream command side effects
- missing migration path is surfaced distinctly if ever encountered for home
- read-only command path still performs home auto-migration
- alias map survives home migration untouched except for explicit home-local evolution
- nested self and known identities both normalize through shared identity migration

## Explicit non-goals for phase 3

Do not pull these into phase 3:

- payload decrypt/version routing
- payload read/write command behavior
- payload update command
- payload CLI/headless remediation copy
- exhaustive historical-version matrix for home
- support-cutoff test matrix beyond the minimal home fail-fast branch needed here

## Definition of done

Phase 3 is done when:

- one global home preflight exists
- legacy home state auto-migrates and persists before command logic
- unsupported newer home state fails before command logic
- downstream code can rely on normalized compatible home state after preflight
- nested public identities migrate through shared identity migration, not home-specific duplication
- the phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

Before starting implementation, verify:

- [ ] each planned test describes behavior, not implementation
- [ ] each slice is independently completable
- [ ] no slice smuggles in payload preflight behavior
- [ ] home auto-persist policy remains explicit
- [ ] one shared startup boundary enforces preflight
- [ ] nested identity migration stays delegated to shared identity migration
