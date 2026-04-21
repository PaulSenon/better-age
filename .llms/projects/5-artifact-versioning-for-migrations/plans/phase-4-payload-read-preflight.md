# Plan: Phase 4 Payload Read Preflight

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 4: Payload Read Preflight`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 4 is the first payload artifact integration.

Phase 4 exists to make payload reads version-aware without introducing persisted payload mutation. The runtime should decrypt the payload first, read the payload schema marker from the decrypted envelope, classify the payload through the shared migration engine, normalize readable legacy payloads in memory only, and preserve the agreed read UX differences between interactive and headless entrypoints.

Target result:
- one payload migration definition for read-time normalization
- one shared payload read preflight seam inside payload-open/read flow
- readable legacy payloads migrate in memory only
- unsupported newer payloads fail before read logic continues
- interactive/headless read callers surface the right warning behavior without prompting

## Durable decisions for this phase

- payload is user-managed; read flows must not persist payload migration
- payload schema version is read only after decrypt because it lives inside encrypted envelope
- payload read preflight always normalizes to current runtime shape only
- payload migration owns payload container shape only
- embedded recipient/public identity evolution reuses shared identity migration
- interactive reads complete first, then warn only
- headless reads complete first, then warn on `stderr` only
- unsupported newer payload versions hard-fail with update-CLI remediation
- explicit persisted payload update remains phase 5
- payload write gating remains phase 6
- existing home-managed behavior may still persist home-side effects; this phase is only about payload migration policy

## Public interfaces to converge on

These are the behaviors phase 4 should make explicit and stable:

- define one payload migration artifact definition using the shared migration engine
- define one shared payload read preflight seam that:
  - decrypts payload envelope bytes
  - reads payload schema version from decrypted envelope
  - classifies current / legacy / unsupported
  - returns normalized current payload envelope in memory only
- define one fail-fast result/error shape for unsupported newer payload versions on read
- define one warning contract that read callers can translate into:
  - interactive read warning after success
  - headless `stderr` warning after success

## Deep modules to create or reshape

- **Payload migration definition**
  - payload schema version reader
  - current version
  - adjacent payload-container steps
- **Payload read preflight**
  - small interface
  - owns decrypt -> classify -> normalize-in-memory -> return normalized envelope + warning state
- **Payload migration adapters**
  - migrate embedded recipient public identities by delegating to shared identity migration
  - keep payload-specific update reasons separate from phase-5 persisted update orchestration
- **Read-call-site warning boundary**
  - interactive callers warn after successful read
  - headless callers warn on `stderr` after successful read

These should stay deeper than callers:
- `ReadPayload` and `InspectPayload` should not branch on versions themselves
- command handlers should not reimplement version routing
- payload migration logic should not be mixed with phase-5 persisted update logic

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 4:
- current payload reads without migration noise
- readable legacy payload normalizes in memory and read succeeds
- multi-hop legacy payload read normalizes through adjacent steps
- unsupported newer payload version fails on read
- interactive read warns after success and does not prompt
- headless read warns on `stderr` after success and does not prompt
- embedded recipient identities normalize through shared identity migration

Good tests for this phase:
- read like payload-read behavior specs
- exercise real payload-open/read seams through public interfaces
- verify no payload persistence occurs during read preflight
- keep warning assertions at the command boundary, not deep inside migration helpers

Bad tests for this phase:
- asserting internal migration helper call order
- asserting encryption internals beyond public payload-open behavior
- mixing persisted payload update behavior into read tests
- testing write-command prompting in this phase

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Current payload passes read preflight unchanged

**Behavior to prove**
- current payload reads through the shared seam unchanged
- no payload persistence rewrite happens
- downstream read logic receives normalized current envelope

**RED**
- add one behavior test for current-version payload read through the public payload-open/read seam

**GREEN**
- introduce minimal payload migration definition + read preflight pass-through

**REFACTOR**
- keep decrypt/version/classify logic inside one shared seam, not callers

### Slice 2: Legacy payload reads through in-memory migration

**Behavior to prove**
- one-version-behind payload migrates to current runtime shape in memory only
- read succeeds
- no payload rewrite happens

**RED**
- add one behavior test for one-version-behind payload read

**GREEN**
- wire one-hop payload migration path into read preflight

**REFACTOR**
- hide classify/migrate/return orchestration behind one payload read preflight module

### Slice 3: Multi-hop legacy payload read

**Behavior to prove**
- several-versions-behind payload migrates through ordered adjacent steps and read succeeds

**RED**
- add one behavior test for `payload v1 -> v2 -> v3` read normalization

**GREEN**
- extend payload migration definition to support multi-hop through shared engine

**REFACTOR**
- keep payload artifact versioning declarative; no custom hop loop in payload code

### Slice 4: Unsupported newer payload read fails fast

**Behavior to prove**
- newer payload version than runtime current fails before read logic continues
- remediation branch is explicit and distinct

**RED**
- add one behavior test where read preflight sees newer payload version and fails

**GREEN**
- map shared engine `unsupported-newer` branch into payload-read fail-fast branch

**REFACTOR**
- keep fail-fast mapping explicit and separate from readable-legacy handling

### Slice 5: Interactive read warns after success, never prompts

**Behavior to prove**
- interactive read of outdated-but-readable payload completes successfully
- user sees warning after success
- no update prompt appears

**RED**
- add one integration-style test around one interactive read-style boundary

**GREEN**
- add minimal warning propagation from payload read preflight to interactive caller

**REFACTOR**
- keep interactive warning policy at caller boundary, not deep inside migration engine

### Slice 6: Headless read warns on stderr after success, never prompts

**Behavior to prove**
- headless read of outdated-but-readable payload completes successfully
- warning is written to `stderr`
- no prompt path is touched

**RED**
- add one integration-style test around one headless read command boundary

**GREEN**
- add minimal warning propagation from payload read preflight to headless caller

**REFACTOR**
- keep headless warning path explicit and separate from interactive caller behavior

### Slice 7: Nested recipient identity migration delegation

**Behavior to prove**
- migrating legacy payload envelopes upgrades embedded recipient public identities by reusing shared identity migration logic
- payload read callers see normalized current recipient identity shape

**RED**
- add one behavior test with a legacy payload snapshot containing old embedded recipient identities

**GREEN**
- hook payload migration steps to shared identity migration adapters

**REFACTOR**
- isolate payload-container migration from nested recipient identity migration details

## Suggested test order

Write tests in this order:

1. current payload passes read preflight unchanged
2. one-hop legacy payload reads via in-memory migration
3. multi-hop legacy payload read normalization
4. unsupported newer payload fails fast
5. interactive read warns after success without prompting
6. headless read warns on `stderr` after success without prompting
7. nested recipient identity migration is delegated

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-4 edge cases worth testing

These are still phase-4 relevant because they protect the payload read policy contract:

- current payload read does not report outdated warning
- readable legacy payload read does not persist payload rewrite
- readable legacy payload read still returns current normalized envelope to downstream code
- unsupported newer payload fails before env parsing/display logic continues
- interactive read path never falls into update prompt behavior
- headless read warning uses `stderr`, not `stdout`
- payload migration can surface missing-path distinctly if ever encountered
- recipient identities normalize to current public identity shape after read migration

## Explicit non-goals for phase 4

Do not pull these into phase 4:

- explicit `bage update <payload>` persisted rewrite flow
- payload self refresh persistence behavior
- mutating payload command prompt gates
- headless write hard-fail behavior
- exhaustive historical-version matrix beyond a minimal read-path proof
- support-cutoff matrix beyond the minimal unsupported-newer read branch needed here

## Definition of done

Phase 4 is done when:

- one shared payload read preflight exists
- readable legacy payloads normalize in memory only and read successfully
- unsupported newer payloads fail before read logic continues
- interactive reads warn after success without prompting
- headless reads warn on `stderr` after success without prompting
- nested recipient public identities migrate through shared identity migration, not payload-specific duplication
- the phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

Before starting implementation, verify:

- [ ] each planned test describes behavior, not implementation
- [ ] each slice is independently completable
- [ ] no slice smuggles in persisted payload update behavior
- [ ] payload read preflight remains in-memory only
- [ ] interactive/headless warning differences stay at caller boundaries
- [ ] nested recipient identity migration stays delegated to shared identity migration
