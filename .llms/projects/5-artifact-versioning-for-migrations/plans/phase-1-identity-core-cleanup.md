# Plan: Phase 1 Identity Core Cleanup

> Parent plan: [artifact-migration-architecture.md](./artifact-migration-architecture.md)
> Source phase: `Phase 1: Identity Core Cleanup`
> TDD mode: red-green-refactor, one behavioral slice at a time

## Goal

Phase 1 is not the migration engine.

Phase 1 exists to realign identity structures first so later migration work lands on one clear public identity model instead of several overlapping shapes.

Target result:
- one canonical `Public Identity Snapshot`
- one separate `Local Alias Map`
- self identity reuses the same public core
- identity string, payload recipient, known identity, and self-public-core can all map to the same public identity shape without information loss
- derived fields stop being persisted in the public identity model

## Durable decisions for this phase

- `Public Identity Snapshot` persisted fields are:
  - `ownerId`
  - `publicKey`
  - `displayName`
  - `identityUpdatedAt`
- `handle` is derived from `displayName + ownerId`
- `fingerprint` is derived from `publicKey`
- local aliases are separate home-local overlay state keyed by `ownerId`
- `Self Identity` embeds the same public identity core plus only local/private fields
- phase 1 is a cleanup/re-alignment slice, not full migration implementation

## Public interfaces to converge on

These are the behaviors phase 1 should make explicit and stable:

- create/read one canonical public identity value
- derive `handle` from a public identity value
- derive `fingerprint` from a public identity value
- convert identity-string payload <-> public identity value
- convert payload recipient <-> public identity value
- convert known identity storage <-> public identity value plus alias overlay
- convert self identity storage <-> public identity value plus local/private fields

## Deep modules to create or reshape

- **Public Identity Snapshot core**
  - small interface
  - owns public identity shape and derived field behavior
- **Identity adapters**
  - conversions between public identity and its containers/encodings
- **Local Alias Map**
  - separate owner-scoped alias overlay
- **Self Identity envelope**
  - public core + local/private fields only

These should stay deeper than the callers:
- import/export logic should consume adapters, not duplicate field mapping
- payload/home code should depend on public identity semantics, not raw shape coincidence

## Testing strategy

Test only observable behavior through stable interfaces.

Priority behaviors to test in phase 1:
- public identity can be created from current representations without losing meaning
- derived handle/fingerprint are consistent and not treated as persisted source-of-truth
- identity-string round-trip preserves the public identity shape
- payload recipient can become the same public identity shape as a known identity
- known identity storage keeps alias separate from public identity
- self identity exposes the same public core as every other identity representation

Good tests for this phase:
- read like identity behavior specs
- use public adapters and public constructors
- survive refactors of internal storage/layout

Bad tests for this phase:
- asserting private mapping helpers
- asserting internal step order
- freezing transitional internal field names

## Tracer-bullet sequence

Follow this exactly as vertical red-green-refactor slices.
Do not write all tests first.

### Slice 1: Public identity canonical shape

**Behavior to prove**
- one canonical public identity value can represent today’s shared public identity information
- `handle` and `fingerprint` are derived behavior, not persisted inputs

**RED**
- add one domain-level behavior test that builds a public identity from primitive persisted fields and verifies derived handle/fingerprint externally

**GREEN**
- introduce the minimal public identity core needed to satisfy that behavior

**REFACTOR**
- remove duplicate derived-field calculations that become obviously local to this core

### Slice 2: Identity string uses public identity core

**Behavior to prove**
- encoding/decoding an identity string preserves the canonical public identity value
- latest exported format still works, but public identity is now the real payload meaning

**RED**
- add one behavior test that round-trips public identity through identity-string encoding/decoding

**GREEN**
- adapt identity-string payload logic to consume/produce public identity

**REFACTOR**
- remove stored-handle/stored-fingerprint dependence from this path where possible

### Slice 3: Payload recipient maps losslessly to public identity

**Behavior to prove**
- payload recipient data can be converted into the same public identity value as identity-string data

**RED**
- add one domain-level behavior test proving payload recipient -> public identity mapping is lossless for the public fields

**GREEN**
- introduce the minimal payload-recipient adapter

**REFACTOR**
- centralize payload-recipient/public-identity conversion instead of repeating field mapping

### Slice 4: Known identity splits public core from alias overlay

**Behavior to prove**
- known identity storage can persist the same public identity shape while alias remains separate overlay state keyed by owner id

**RED**
- add one behavior test showing alias overlay does not alter the public identity value

**GREEN**
- introduce the minimal alias-map representation and known-identity storage shape needed to pass

**REFACTOR**
- remove embedded-alias assumptions from identity core APIs

### Slice 5: Self identity embeds public core

**Behavior to prove**
- self identity exposes the same public core as all other identity representations while retaining local/private fields

**RED**
- add one behavior test that extracts the self public core and proves it matches canonical public identity behavior

**GREEN**
- reshape self identity storage/model just enough to embed the public core cleanly

**REFACTOR**
- remove duplicated self public fields or duplicated derivation logic

### Slice 6: Cross-representation interoperability

**Behavior to prove**
- identity-string payload, payload recipient, known identity, and self public core all converge on the exact same public identity semantics

**RED**
- add one integration-style domain/app test that compares all these representations through the public adapters

**GREEN**
- fill the smallest remaining gaps in adapters/storage shapes

**REFACTOR**
- collapse any remaining duplicate conversion logic into the identity adapter layer

## Suggested test order

Write tests in this order:

1. Public identity derives handle/fingerprint from persisted public fields
2. Identity string round-trips canonical public identity
3. Payload recipient converts to canonical public identity
4. Known identity stores canonical public identity separately from alias
5. Self identity exposes canonical public identity plus local/private fields
6. Cross-representation interoperability test

Only after these pass:
- add narrow regression tests for edge cases discovered during refactor

## Phase-1 edge cases worth testing

These are still phase-1 relevant because they protect the cleanup:

- alias lookup keyed by `ownerId`, not by display name or fingerprint
- rename changes derived handle but not identity continuity
- key rotation changes derived fingerprint but not identity continuity
- identity-string decode does not require persisted handle/fingerprint as source-of-truth
- payload recipient and known identity can represent the same public identity exactly
- self identity public core does not drift from canonical public identity shape

## Explicit non-goals for phase 1

Do not pull these into phase 1:

- shared migration engine implementation
- historical schema registries
- adjacent-step migration chains
- home migration preflight
- payload migration preflight
- payload command update gates
- hard-break runtime policy behavior beyond shape decisions needed for phase 1

## Definition of done

Phase 1 is done when:

- one canonical public identity model exists
- derived public fields are no longer treated as persisted source-of-truth in the public model
- alias is separate overlay state keyed by `ownerId`
- self identity reuses the public core
- identity string, payload recipient, known identity, and self-public-core all map through the same public identity semantics
- the phase is covered by behavior-first tests that would survive internal refactors

## Review checklist

Before starting implementation, verify:

- [ ] each planned test describes behavior, not implementation
- [ ] each slice is independently completable
- [ ] no slice smuggles in migration-engine work
- [ ] public identity remains the only public-core truth
- [ ] alias overlay remains local-only state
