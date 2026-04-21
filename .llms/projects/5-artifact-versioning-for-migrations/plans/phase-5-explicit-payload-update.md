# Plan: Phase 5 Explicit Payload Update

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 5: Explicit Payload Update`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 5 turns payload rewrite into one explicit persisted command boundary.

Phase 5 exists to make `bage update <payload>` the only place where payload format migration is persisted without also pulling in phase-6 write gating. The command should open the payload through the existing read preflight, decide whether persisted rewrite is needed for payload format migration and/or self refresh, rewrite once when needed, stay idempotent when rerun, and report exactly what it handled.

Target result:
- one explicit persisted payload-update seam
- payload format migration can be persisted explicitly
- payload self refresh can be persisted explicitly
- both reasons can be handled in one rewrite
- rerunning update on current payload is a no-op
- command result reports `format migration`, `self refresh`, `both`, or `nothing`

## Durable decisions for this phase

- `bage update <payload>` is the explicit persisted rewrite boundary for payloads
- payload update may persist both payload format migration and payload self refresh in one invocation
- payload update stays idempotent
- payload update always rewrites to current runtime payload shape only
- payload update must not require callers to pick granular rewrite reasons
- payload update should reuse payload read preflight for decrypt + version routing
- payload update should persist only after payload is known readable by current CLI
- unsupported newer payload versions hard-fail with update-CLI remediation
- payload write gating for other mutating commands remains phase 6
- exhaustive support-window matrix remains phase 7

## Public interfaces to converge on

These are the behaviors phase 5 should make explicit and stable:

- define one update-payload orchestration seam that:
  - opens payload through shared read preflight
  - computes persisted rewrite reasons from persisted schema version + normalized envelope + current self identity
  - returns unchanged when no rewrite is needed
  - rewrites once when one or more reasons are present
- define one stable success contract that distinguishes:
  - unchanged
  - updated for format migration only
  - updated for self refresh only
  - updated for both reasons
- define one fail-fast error branch for unsupported newer payload versions on update

## Deep modules to create or reshape

- **UpdatePayload orchestration**
  - small interface
  - owns open -> classify rewrite reasons -> rewrite once -> report handled reasons
- **Persisted payload-update state**
  - schema-outdated stays driven by persisted schema version, not normalized runtime envelope
  - self-refresh stays driven by normalized envelope vs current self identity
- **Rewrite synthesis**
  - build one next envelope that reflects all required changes before persist
  - avoid separate rewrite paths for format-only vs self-only vs both
- **Result/report contract**
  - callers should not infer handled reasons by diffing payload contents
  - update command should state exactly what it did

These should stay deeper than callers:
- command handler should not branch on payload version itself
- command handler should not compute rewrite reasons itself
- read-preflight version routing should not be duplicated inside update flow

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 5:
- already-current payload returns unchanged and does not rewrite
- outdated-format-only payload rewrites once and reports format migration
- self-stale-only payload rewrites once and reports self refresh
- payload needing both rewrites once and reports both reasons
- rerunning update after rewrite is idempotent
- unsupported newer payload fails before rewrite
- rewritten payload persists current schema version and normalized recipients

Good tests for this phase:
- exercise `UpdatePayload.execute` through its public interface
- assert persistence or no-persistence through repository/crypto side effects
- assert returned success variant / reasons instead of internal helper calls
- keep warning/prompt behavior out of scope

Bad tests for this phase:
- asserting internal migration helper call order
- duplicating phase-4 read-warning tests here
- testing write-command prompt gates here
- testing every historical version path here

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Already-current payload is unchanged

**Behavior to prove**
- current payload with no self refresh need returns unchanged
- no rewrite happens
- reported reasons are empty

**RED**
- add one behavior test for current payload through `UpdatePayload.execute`

**GREEN**
- keep or minimally reshape current unchanged path to pass through explicit update contract

**REFACTOR**
- keep unchanged decision behind one update-state seam

### Slice 2: Format-migration-only update persists once

**Behavior to prove**
- payload with persisted legacy schema but readable current runtime shape rewrites once
- payload persists current schema version
- success reports format migration only

**RED**
- add one behavior test for outdated-format-only payload update

**GREEN**
- wire persisted schema-outdated reason into `UpdatePayload`
- synthesize one rewritten current envelope and persist it

**REFACTOR**
- keep persisted-version reasoning explicit and separate from self-refresh reasoning

### Slice 3: Self-refresh-only update persists once

**Behavior to prove**
- current-schema payload with stale self recipient rewrites once
- self recipient is replaced by current self snapshot
- non-self recipients are preserved
- success reports self refresh only

**RED**
- add one behavior test for self-stale-only payload update

**GREEN**
- keep or minimally reshape current self-refresh rewrite path

**REFACTOR**
- make self-refresh rewrite synthesis compose cleanly with format migration

### Slice 4: Both reasons collapse into one rewrite

**Behavior to prove**
- payload with legacy persisted schema and stale self recipient rewrites once
- rewritten payload is current schema and current self snapshot
- success reports both reasons

**RED**
- add one behavior test for combined format-migration + self-refresh update

**GREEN**
- compose both reasons into one synthesized next envelope and one persisted rewrite

**REFACTOR**
- avoid multiple write passes or branching rewrite implementations

### Slice 5: Duplicate self recipients normalize during explicit update

**Behavior to prove**
- duplicate self recipients are collapsed to one current self snapshot during update
- update still reports self refresh when that is the effective rewrite reason

**RED**
- add one behavior test for duplicate-self normalization within explicit update

**GREEN**
- preserve existing normalization behavior inside new unified rewrite synthesis

**REFACTOR**
- keep duplicate-self handling as part of self-refresh normalization, not a separate public mode

### Slice 6: Rerun is idempotent

**Behavior to prove**
- rerunning update after successful rewrite returns unchanged
- no second rewrite happens

**RED**
- add one behavior test for running update twice on same payload

**GREEN**
- ensure rewritten payload shape feeds back into unchanged path cleanly

**REFACTOR**
- simplify reason computation until idempotence falls out naturally

### Slice 7: Unsupported newer payload fails before rewrite

**Behavior to prove**
- payload newer than current CLI hard-fails on explicit update
- no rewrite happens
- remediation is update CLI, not payload

**RED**
- add one behavior test for newer payload on `UpdatePayload.execute`

**GREEN**
- map phase-4 version-preflight failure into update-specific fail-fast branch

**REFACTOR**
- keep unsupported-version branch explicit and separate from readable legacy handling

## Suggested test order

Write tests in this order:

1. already-current payload is unchanged
2. format-migration-only update persists once
3. self-refresh-only update persists once
4. both reasons collapse into one rewrite
5. duplicate self recipients normalize during explicit update
6. rerun is idempotent
7. unsupported newer payload fails before rewrite

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-5 edge cases worth testing

These are still phase-5 relevant because they protect explicit persisted-update contract:

- format-only update should not mutate recipient list beyond normalization to current schema shape
- self-refresh-only update should not report schema migration
- both-reasons update should still perform exactly one encrypt + one write
- unchanged path should not encrypt or write
- no-self-identity failure should still short-circuit before rewrite
- unsupported newer payload should fail before any encrypt or write
- rewritten payload should persist current payload schema marker
- duplicate self recipients should not survive rewrite

## Explicit non-goals for phase 5

Do not pull these into phase 5:

- interactive prompt gates for other mutating payload commands
- headless hard-fail behavior for mutating payload commands other than explicit update
- read-warning UX already covered in phase 4
- home migration behavior already covered in phase 3
- exhaustive historical-version matrix beyond minimal explicit-update proof
- intentional hard-break cutoff matrix beyond minimal unsupported-newer update branch needed here

## Definition of done

Phase 5 is done when:

- `UpdatePayload` is the explicit persisted payload rewrite boundary
- format migration can be persisted explicitly
- self refresh can be persisted explicitly
- both reasons can be applied in one persisted rewrite
- rerunning update is idempotent
- unsupported newer payloads fail before rewrite
- handled reasons are reported explicitly by update results
- the phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

- Does explicit update own persisted payload rewrite without pulling in phase-6 write gates?
- Does reason computation distinguish persisted schema migration from self refresh?
- Does combined update rewrite exactly once?
- Does unchanged rerun avoid encrypt/write side effects?
- Does newer-payload failure preserve update-CLI remediation?
