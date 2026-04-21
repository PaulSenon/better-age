# Better Age Artifact Migration PRD

## Problem Statement

`better-age` needs to evolve persisted artifacts without breaking users whenever CLI storage or payload formats change. Today, version markers exist in some places, but there is no single migration architecture that makes old artifacts reliably readable by newer CLIs, keeps payload rewrites explicit, keeps home-state rewrites automatic, and keeps identity evolution consistent across identity strings, known identities, payload recipients, and self identity.

Without a solid migration model:
- older persisted artifacts risk becoming unreadable
- command behavior diverges between read and write paths
- identity structure drifts across storage locations
- future breaking changes become risky to ship
- support cutoffs would happen accidentally instead of explicitly

## Solution

Introduce one shared migration engine for versioned artifacts, with artifact-specific migration policies layered on top.

The system should:
- auto-migrate managed `Home State` before any command logic
- keep `Payload` as user-managed state that never auto-rewrites during reads
- allow readable old payloads to be migrated in memory for reads
- require explicit persisted payload update before any payload mutation
- keep one idempotent `bage update <payload>` command that handles both payload format migration and self-recipient refresh
- unify identity evolution around one canonical `Public Identity Snapshot`
- keep local aliases outside the public identity shape in a separate home-local alias map
- keep support for all released schema versions by default through adjacent-step migration chains
- model intentional support cutoffs explicitly with per-artifact hard-break policy tables

## User Stories

1. As a CLI user, I want newer CLIs to keep reading artifacts created by older released CLIs, so that upgrades do not strand my existing data.
2. As a CLI user, I want old payload formats to be migrated forward step-by-step automatically in memory during reads, so that reads remain useful without forcing rewrites.
3. As a CLI user, I want payload writes to stop before mutating an outdated payload, so that the CLI never rewrites my payload without clear intent.
4. As a CLI user in interactive mode, I want a mutating payload command to offer an explicit update prompt first, so that I control when payload bytes change.
5. As a CLI user in interactive mode, I want a readable-but-outdated payload read to succeed and then warn me, so that safe reads do not become blocked by migration prompts.
6. As a CLI user in headless mode, I want readable-but-outdated payload reads to succeed and emit warning text on `stderr`, so that machine consumers still get the read result cleanly.
7. As a CLI user in headless mode, I want mutating payload commands on outdated payloads to hard-fail with remediation, so that automation never performs hidden migrations.
8. As a CLI user, I want `bage update <payload>` to be idempotent, so that I can run it repeatedly without fear of extra unintended changes.
9. As a CLI user, I want `bage update <payload>` to report whether it handled payload format migration, self refresh, both, or nothing, so that I can trust what changed.
10. As a CLI user, I want newer payload versions to hard-fail on older CLIs with “update CLI” remediation, so that the failure mode is explicit and correct.
11. As a CLI user, I want `Home State` to migrate automatically before command logic, so that internal state management feels like normal software maintenance rather than manual data work.
12. As a CLI user, I want unsupported newer home-state versions to fail before anything else runs, so that incompatible managed I/O does not corrupt later flows.
13. As a CLI user, I want the CLI to preserve identity continuity across key rotation, so that aliases and known-identity continuity survive changes to the active key.
14. As a CLI user, I want payload recipients, known identities, self public identity, and identity-string payloads to interoperate losslessly, so that identities can move across boundaries without shape drift.
15. As a CLI user, I want unknown payload recipients to be promotable into known identities without information loss, so that discovering identities through payloads stays coherent.
16. As a CLI user, I want local aliases to remain local-only overlays, so that my personal naming does not leak into payloads or shareable identity strings.
17. As a CLI user, I want aliases to survive rename and key rotation, so that aliases stay attached to the identity continuity key rather than a transient key snapshot.
18. As a CLI user, I want handles and fingerprints to be derived consistently instead of stored redundantly, so that identity rendering stays simple and less migration-heavy.
19. As a CLI user, I want exported identity strings to always emit the latest supported format, so that outbound sharing stays canonical.
20. As a CLI user, I want importing old identity strings to keep working forever by default, so that old shared strings remain useful after upgrades.
21. As a maintainer, I want every artifact to expose one explicit stable schema version marker, so that migration routing is deterministic rather than heuristic.
22. As a maintainer, I want migration steps to exist only as adjacent hops, so that each step stays small, testable, and understandable.
23. As a maintainer, I want migration pipelines to normalize only to the current runtime shape, so that the engine stays simple and does not grow arbitrary target-version complexity.
24. As a maintainer, I want one shared migration engine with per-artifact policy layers, so that version handling is uniform while behavior differences remain explicit.
25. As a maintainer, I want payload migration to own payload container evolution only, so that nested identity evolution is not reimplemented there.
26. As a maintainer, I want home migration to own home container evolution only, so that embedded identity migration and alias-map evolution are clearly separated.
27. As a maintainer, I want one global home-migration preflight and one shared payload-migration preflight, so that command behavior does not re-implement version branching ad hoc.
28. As a maintainer, I want explicit hard-break policy tables per artifact, so that future support cutoffs are deliberate, reviewable, and documented.
29. As a maintainer, I want cleanup of identity structures to happen before the full migration engine rollout, so that migration implementation lands on a cleaner data model.
30. As a maintainer, I want tests to cover deep edge cases around support windows, unsupported versions, migration chaining, and no-partial-mutation guarantees, so that future breaking changes can ship with confidence.
31. As a maintainer, I want readable-but-outdated payload behavior to be identical across commands except where policy intentionally differs, so that users can reason about the system consistently.
32. As a maintainer, I want machine-facing `Load Protocol` versioning to stay separate from persisted artifact migration, so that caller compatibility remains a clean independent boundary.
33. As a maintainer, I want future schema cutoffs to fail with artifact-specific remediation rather than generic parse crashes, so that de-support decisions remain user-comprehensible.
34. As a maintainer, I want public identity structure to be trivial to reason about, so that future identity-related changes do not require chasing multiple partially overlapping shapes.
35. As a maintainer, I want support for all released versions to be the default promise, so that backward readability erodes only when we explicitly choose to narrow it.
36. As a CLI user, I want payload version detection to happen from one explicit version marker after decrypt, so that migration routing is deterministic and not based on shape guessing.
37. As a maintainer, I want home-state auto-migration to remain allowed even during flows that are otherwise read-only, so that managed internal state compatibility never depends on command kind.
38. As a maintainer, I want intentional support cutoffs to remain explicit policy rather than incidental code drift, so that old versions are never dropped silently.

## Implementation Decisions

- Introduce one shared migration engine used by all versioned artifacts.
- Separate migration engine concerns from migration policy concerns.
- Keep artifact-specific policy for home, payload, and identity encodings above the shared engine.
- Use explicit schema version markers, not shape inference, for migration routing.
- Normalize every artifact only to the current runtime shape of the running CLI.
- Author migrations only as adjacent version hops.
- Keep support for every released schema version by default.
- Add explicit per-artifact hard-break policy tables for intentional de-support decisions.
- Treat `Home State` as managed internal state with one global migration preflight before any command logic.
- Treat `Payload` as user-managed state with one shared payload migration preflight before command-specific logic.
- Keep payload reads in-memory only when outdated but still readable.
- Require explicit persisted payload update before any payload mutation.
- Keep one user-facing `bage update <payload>` command that handles both payload format migration and payload self refresh.
- Make explicit payload update idempotent and reason-reporting.
- Keep payload `schemaVersion` only inside the encrypted payload envelope.
- Detect payload schema version only after decrypt, since the version marker lives inside the encrypted envelope.
- Keep `Load Protocol` versioning separate from persisted artifact migration.
- Center identity evolution on one canonical `Public Identity Snapshot`.
- Set the current target persisted public identity fields to `ownerId`, `publicKey`, `displayName`, and `identityUpdatedAt`.
- Derive `handle` from `displayName + ownerId` rather than persisting it.
- Derive `fingerprint` from `publicKey` rather than persisting it.
- Keep local aliases outside the public identity shape in a separate alias map keyed by `ownerId`.
- Model known identities as public identity snapshots keyed by `ownerId` plus a separate alias overlay.
- Model self identity as public identity snapshot plus local/private fields only.
- Reuse identity migration inside home and payload rather than letting those migrators define public-identity evolution themselves.
- Allow managed home-state migration even in flows that are otherwise read-only, because payload mutability rules do not apply to managed internal state.
- Start implementation with a cleanup/re-alignment phase for public identity structures before the full migration engine rollout.

Major modules to build or reshape:
- public identity snapshot core model
- identity adapters/encodings for identity-string, payload-recipient, known-identity, and self-public-core use cases
- shared migration engine
- per-artifact policy tables including hard-break policies
- home migration preflight
- payload migration preflight
- explicit payload update orchestrator
- local alias map / known-identity storage realignment
- historical schema registries and adjacent migration chains
- migration-aware user-facing remediation and status reporting

## Testing Decisions

- Tests should verify external behavior and contract outcomes, not implementation details.
- A good migration test proves:
  - correct classification of current vs readable-but-outdated vs unsupported
  - correct adjacent migration chaining
  - correct persisted vs in-memory behavior
  - correct no-partial-mutation guarantees
  - correct user-facing remediation/result semantics
- Tests should be deep and edge-case heavy.
- Priority modules to test:
  - shared migration engine
  - public identity snapshot adapters and migrations
  - home migration preflight
  - payload migration preflight
  - explicit payload update orchestrator
  - hard-break policy behavior
- Edge cases that must be covered include:
  - every supported historical version path
  - multi-hop migrations
  - already-current artifacts
  - unsupported newer versions
  - intentionally hard-broken known old versions
  - invalid bytes claiming a version
  - read vs write policy divergence
  - interactive vs headless policy divergence
  - accepted vs refused interactive update prompts
  - idempotent repeated `update`
  - no payload mutation after refused prompt
  - no payload mutation on headless write failure
  - read success plus warning for outdated-but-readable payloads
  - home migration happening before downstream command logic
  - nested identity migration inside home and payload
  - alias survival across rename and key rotation
  - auto-promotion of unknown payload recipients into known identities once structures are aligned
- Prior art should come from the repo’s existing style of:
  - domain-level behavior tests
  - app-service tests
  - command-flow and command-result tests
- Tests should stay exhaustive because the whole point of this feature is shipping future breaking schema changes safely.
- Tests should also prove that support cutoffs happen only through explicit hard-break policy, not accidental missing branches.

## Out of Scope

- Backward compatibility with artifacts produced by future newer CLIs when opened by older CLIs.
- Arbitrary migrate-to-version-N workflows.
- Downgrade migrations.
- Silent payload rewrites during read flows.
- Recovering corrupted bytes that only superficially resemble historical versions.
- Broad semver compatibility guarantees unrelated to artifact schema versions.
- Bundling `Load Protocol` versioning into persisted artifact migration logic.
- Final implementation plan and task slicing for this work.

## Further Notes

- This PRD should be read together with the settled architecture spec and ADR for artifact migration.
- The current target identity cleanup is intentionally part of this work because it materially reduces migration complexity and ambiguity.
- The migration architecture is intended as a durable platform for future schema evolution, not just a one-off patch for the next payload or home change.
- If implementation later reveals a need to narrow the migration support window, that should be treated as a deliberate documented policy change, not as incidental code drift.
