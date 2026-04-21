# Plan: better-age Internal Boundary Hardening

> Source PRD: [PRD_INTERNAL_BOUNDARY_HARDENING.md](../0-PRD_INTERNAL_BOUNDARY_HARDENING.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Packaging**: keep one `better-age` package; no public SDK, no multi-package split.
- **Boundary direction**: app layer owns semantic use-cases and typed outcomes; CLI layer owns prompts, guided navigation, retries, back/cancel semantics, final rendering, and exit mapping.
- **Failure model**: use one generic command-failure model carrying structured metadata such as command name and failure reason.
- **User-facing copy**: final stderr/stdout copy is renderer-owned and driven by stable issue identifiers; low-level adapter text is not default UX.
- **Guided control model**: shared guided flows must distinguish `done`, `back`, and `cancel`.
- **Mutation orchestration**: `edit`, `grant`, and `revoke` should share one orchestration shape through deep CLI flow modules rather than duplicating orchestration in each command handler.
- **Interactive ownership**: the interactive session runner belongs to CLI, not app.
- **Load contract**: `load` keeps current machine-facing contract, including warning on update-needed with successful output.
- **Runtime wiring**: keep Effect Layer-based composition, but group layers into coarse bundles to reduce assembly sprawl.
- **Type discipline**: remove cast escape hatches where a stronger typed adapter boundary can express the same contract cleanly.

---

## Phase 1: Docs + Contract Sync

**User stories**: 17, 18, 19

### What to build

Bring package docs and drift-tracking documents back in sync with actual behavior and the approved internal-boundary direction. This slice should correct stale statements first, so later implementation work starts from an accurate written contract.

### Acceptance criteria

- [x] Package docs describe `load` as warning-and-success when payload update is recommended.
- [x] Drift/spec docs stop reporting already-fixed behavior as still broken.
- [x] Internal-boundary target is described consistently across maintained package docs.
- [x] No product behavior changes are required to complete this slice.

---

## Phase 2: Shared Command Failure + Renderer Boundary

**User stories**: 6, 7, 8, 9, 16, 23

### What to build

Introduce a single CLI command-failure model and a clearer renderer-owned user-facing issue contract. The slice should reduce top-level exit-handling repetition and stop normal user-facing branches from depending directly on low-level error text.

### Acceptance criteria

- [x] Top-level CLI exit mapping uses one generic command-failure model instead of many per-command failure classes.
- [x] User-facing warnings/errors are rendered through a central issue-driven renderer contract.
- [x] Normal command stderr output no longer depends on raw adapter/app `message` text in targeted migrated branches.
- [x] Existing machine-facing output behavior remains intact.

---

## Phase 3: Real Update Gate Semantics

**User stories**: 10, 11, 12, 13, 14

### What to build

Implement real semantic handling for update-gated guided flows. The update gate must stop pretending that `Back` exists while actually aborting. This slice should make the gate reusable and make each command honor `Back` and `Cancel` distinctly.

### Acceptance criteria

- [x] Guided update-gated mutation flows distinguish `Update now`, `Back`, and `Cancel`.
- [x] `Back` returns to the previous local step rather than aborting the entire command.
- [x] `Cancel` exits the command cleanly without pretending it was a local back-navigation event.
- [x] Exact-mode mutation behavior stays explicit and does not silently convert into guided recovery.

---

## Phase 4: Mutation Flow Deep Modules

**User stories**: 2, 4, 5, 13, 15, 24

### What to build

Extract deep CLI flow modules that own the repeated orchestration shape for `edit`, `grant`, and `revoke`. Each command should become a thin end-to-end adapter over shared guided orchestration rather than a large bespoke control-flow implementation.

### Acceptance criteria

- [x] `edit`, `grant`, and `revoke` are driven by shared deep flow modules for the repeated orchestration shape.
- [x] Command handlers are substantially thinner and read primarily as command adapters.
- [x] Shared mutation flow modules are testable at the flow boundary without depending on command-file implementation details.
- [x] User-facing behavior remains consistent with pre-existing semantics except where Phase 3 intentionally changed control behavior.

---

## Phase 5: Interactive Ownership Move

**User stories**: 1, 3

### What to build

Move the interactive session runner fully into CLI ownership. The slice should remove upward imports from app into CLI and clarify that interactive navigation is a CLI surface over shared command semantics, not an app-layer service.

### Acceptance criteria

- [x] Interactive session runner no longer lives in or depends upward from app layer.
- [x] App layer does not import CLI command modules or CLI shared-flow modules.
- [x] Interactive navigation still exposes the same product surface after relocation.
- [x] The new ownership boundary is obvious from code organization and tests.

---

## Phase 6: Infra Type Boundary Cleanup + Layer Grouping

**User stories**: 20, 21, 22

### What to build

Tighten adapter typing and simplify runtime composition. Remove practical cast escape hatches, then group runtime layers into coarse bundles so composition remains understandable without changing overall runtime behavior.

### Acceptance criteria

- [x] Targeted infrastructure adapters no longer rely on the current cast escape hatches where a typed boundary can replace them cleanly.
- [x] Runtime layer composition is grouped into coarse bundles with clearer responsibilities.
- [x] Behavior remains unchanged apart from clearer typing and cleaner assembly.
- [x] The package remains single-package and ready for future segmentation without introducing a premature package split.
