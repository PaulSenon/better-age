# PRD: Internal Boundary Hardening And CLI Flow Deepening

## Problem Statement

`better-age` is already feature-rich and broadly coherent, but its internal architecture has started drifting away from its intended boundaries.

From the maintainer perspective, the current pain is not missing product behavior. The pain is that similar CLI mutation flows are implemented differently, user-facing copy is not fully centralized, and some app-layer code depends upward on CLI-layer orchestration. This makes the package harder to evolve safely, harder to reason about, and harder to segment cleanly later if a real SDK boundary becomes desirable.

From the user perspective, this creates 4 concrete problems:

1. Similar human flows like `edit`, `grant`, and `revoke` feel related but are not driven by one shared orchestration model.
2. Some commands still expose low-level internal error text instead of one stable product voice.
3. Some guided controls such as `Back` are presented in the UI but are not fully honored semantically.
4. Internal structure makes future changes riskier than they need to be, because flow policy, prompt policy, and message policy are spread across large command handlers.

The product need is an internal refactor that keeps the package single-package and user-visible behavior mostly stable, while making the codebase cleaner, deeper, and easier to extend.

## Solution

Refactor `better-age` around a harder internal boundary:

- keep one package
- keep current command surface
- keep current product model
- move interactive and guided orchestration fully into CLI-owned flow modules
- keep app use-cases focused on semantic operations and typed outcomes
- centralize final user-facing messages and warnings
- normalize mutation-flow control semantics such as `Back`, `Cancel`, update gating, and command failure

From the user perspective, the result should feel like a cleanup, not a rewrite:

- commands keep same intent
- guided flows become more predictable
- warnings/errors become more consistent
- `Back` means local back, not hidden abort
- `interactive` becomes clearly a CLI navigation surface over shared command semantics

This delivery is specifically an internal-boundary hardening project, not a public SDK extraction and not a multi-package split.

## User Stories

1. As a maintainer, I want app-layer services to stop depending on CLI modules, so that architectural direction stays coherent.
2. As a maintainer, I want guided interaction policy to live in one layer, so that flow changes do not require editing many unrelated command files.
3. As a maintainer, I want the `interactive` session to be CLI-owned, so that product navigation does not leak into app use-cases.
4. As a maintainer, I want mutation commands to compose shared flow modules, so that `edit`, `grant`, and `revoke` stop re-implementing the same orchestration shape.
5. As a maintainer, I want command handlers to become thinner, so that reading a command file reveals intent quickly.
6. As a maintainer, I want user-facing copy to be centralized, so that docs, tests, and runtime UX align.
7. As a maintainer, I want low-level adapter messages not to become accidental UX contract, so that internal implementation can evolve safely.
8. As a maintainer, I want command failure handling to be uniform, so that top-level process exit mapping is simple and obvious.
9. As a maintainer, I want one generic command-failure model with structured reason metadata, so that failure plumbing stays small without losing meaning.
10. As a maintainer, I want `Back` and `Cancel` to be modeled distinctly in shared flow outcomes, so that control flow becomes explicit.
11. As a CLI user, I want `Back` to return me to the previous chooser or step, so that guided navigation feels honest.
12. As a CLI user, I want `Cancel` to stop the current command cleanly, so that I can exit without noisy failure text.
13. As a CLI user, I want update-required mutation flows to behave consistently across commands, so that I do not need to relearn the same gate every time.
14. As a CLI user, I want update-gate choices to have real semantics, so that the menu never lies.
15. As a CLI user, I want similar failure situations to produce similarly phrased messages, so that the tool feels deliberate.
16. As a CLI user, I want machine-facing and human-facing output contracts to stay distinct, so that automation remains stable.
17. As a CLI user, I want `load` to keep its current warning-but-success behavior when update is recommended, so that machine use stays unblocked.
18. As a maintainer, I want the docs to match implemented behavior, so that contributors do not chase stale assumptions.
19. As a maintainer, I want spec drift documents to be corrected when implementation is already right, so that docs remain useful product references.
20. As a maintainer, I want infrastructure adapters to preserve branded/type-safe boundaries, so that type discipline remains trustworthy.
21. As a maintainer, I want cast-based escape hatches removed where practical, so that runtime boundaries are explicit instead of hand-waved.
22. As a maintainer, I want layer composition grouped into coarse bundles, so that dependency assembly is understandable.
23. As a maintainer, I want top-level runtime wiring to stop using long repetitive failure ladders, so that CLI bootstrap stays maintainable.
24. As a maintainer, I want new guided command work to slot into a known structure, so that future changes stay incremental.
25. As a maintainer, I want this refactor to avoid premature package extraction, so that we do not pay packaging cost before the internal boundary is stable.

## Implementation Decisions

- Keep the work strictly internal to the existing package.
- Do not introduce a public SDK package in this project.
- Treat this as a boundary-hardening refactor, not a product redesign.
- Preserve the existing command surface and current core product semantics.
- Move the interactive session runner out of the app layer and into the CLI layer.
- Keep app use-cases focused on semantic operations, typed outcomes, and reusable domain-level policies.
- Keep CLI responsible for:
  - prompts
  - guided menus
  - retry loops
  - back/cancel navigation
  - final message rendering
  - command exit semantics
- Introduce shared CLI flow modules for the repeated mutation orchestration shape:
  - resolve target
  - collect passphrase
  - handle update-required gate
  - recover from guided ambiguity or guided retry branches
  - render final success/warning/error
- Model shared guided flow control explicitly with semantic outcomes instead of implicit exception-only branching.
- Distinguish at least these guided outcomes:
  - done
  - back
  - cancel
- Make update-gate behavior real:
  - `Update now` performs update path
  - `Back` returns to previous local step
  - `Cancel` aborts command cleanly
- Keep exact-mode commands strict. Exact mode must not silently re-enter guided recovery unless that behavior is already an intentional part of the command contract.
- Adopt one generic command-failure type for top-level CLI exit handling.
- Give generic command failures structured metadata such as command name and failure reason.
- Keep quiet cancel distinct from noisy user-facing failure in command outcome plumbing, even if both currently map to exit code `1` or similar internal handling.
- Centralize user-facing rendering around stable issue identifiers rather than raw low-level error strings.
- Hide low-level adapter/app error text by default.
- Preserve underlying technical causes on error objects for future diagnostics, but do not make them default stderr copy.
- Do not add a `--debug` surface in this project unless a real support/debug workflow appears later.
- Expand the warning model alongside the error model so warnings remain intentionally distinct from errors.
- Keep machine-facing output contracts stable, especially for `load`.
- Treat `load` warn-plus-success behavior as correct current behavior.
- Update package docs and drift reports to align with implemented `load` behavior and with any clarified flow semantics delivered by this refactor.
- Remove cast-based type escape hatches in infrastructure adapters where a stronger typed adapter boundary can replace them cleanly.
- Group runtime layer assembly into coarse bundles such as:
  - infra layers
  - core app layers
  - CLI flow layers
  - runtime/main composition
- Favor deeper internal modules with small public interfaces over more shallow helper extraction.
- Avoid introducing a fake internal SDK boundary before the CLI/app split is actually hardened.

## Testing Decisions

- Good tests should assert external behavior, not helper internals.
- Prefer tests that validate:
  - control-flow outcome
  - user-visible stdout/stderr behavior
  - guided `Back` / `Cancel` semantics
  - warning vs error distinction
  - stable command exit mapping
- Test new shared CLI flow modules directly because they will carry most orchestration behavior.
- Test the interactive session after relocation as a CLI behavior surface, not as an app-layer business use-case.
- Add or update command tests for:
  - update gate with true `Back`
  - update gate with `Cancel`
  - shared mutation flow success
  - shared mutation flow unchanged/no-op
  - renderer-driven user-facing error output
  - renderer-driven warning output
- Add tests proving low-level internal error text is not emitted directly in normal user-facing branches.
- Add tests for the generic command-failure model at top-level CLI bootstrap.
- Update doc/spec assertions or fixture expectations where previous behavior assumptions were stale.
- Reuse existing package testing style:
  - command-level tests for CLI behavior
  - app-layer tests for semantic use-cases
  - integration tests for real adapter seams where the boundary matters
- Avoid over-testing internal layer composition details or exact helper call graphs.

## Out of Scope

- Splitting `better-age` into multiple packages.
- Publishing a public SDK.
- Redesigning the domain model.
- Changing the command surface in a major way.
- Reworking encryption, payload format, or recipient semantics beyond what is needed for boundary cleanup.
- Adding a debug CLI surface.
- Replacing Effect, CLI framework, or layer model.
- Large product-level UX redesign outside the specific consistency fixes described here.

## Further Notes

- The intended implementation order should be incremental:
  1. align docs with current implemented behavior where docs are stale
  2. make update-gate control semantics real
  3. extract shared mutation flow modules
  4. relocate interactive session ownership into CLI
  5. centralize final user-facing rendering more fully
  6. simplify top-level failure and layer composition
- The package should remain easy to split later if needed, but that future possibility should not drive the structure prematurely now.
- The desired end state is a single package with a clear internal separation between semantic use-cases and CLI-owned orchestration.
- This project should reduce risk and cognitive load more than it changes visible product behavior.
