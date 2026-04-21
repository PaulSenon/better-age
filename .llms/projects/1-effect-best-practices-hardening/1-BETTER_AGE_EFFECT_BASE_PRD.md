## Problem Statement

The current `better-age` package has a minimal first vertical slice, but it is not yet strong enough to serve as the canonical example for future work. The base currently mixes modern Effect patterns with weaker scaffolding choices: runtime data is trusted without schema decoding, ports are plain tags instead of first-class services, errors are too generic and not schema-backed, CLI failure semantics are too loose, and the test stack does not yet enforce the architecture we want contributors to copy.

This creates a risk that every future feature will inherit inconsistent boundaries, weak runtime guarantees, and ad hoc testing patterns. The problem is not missing product functionality. The problem is that the project foundation is too permissive for a codebase that wants strict DDD and state-of-the-art Effect practices from the first slice onward.

## Solution

Refactor the existing `setup` vertical slice into a strict canonical scaffold for a CLI-only Effect application. The result should keep the current feature scope intentionally small while making the implementation shape exemplary:

- schema-first domain and persistence boundaries
- `Effect.Service` for application services and current ports
- branded domain value objects for the important string types
- explicit layered error taxonomy with remapping at the app boundary
- strict separation between CLI interaction and core application logic
- typed config and injected time
- strict CLI exit-code policy
- mandatory lightweight observability
- test architecture that demonstrates the approved pattern contributors should copy

The refactor should not expand `better-age` into more product capability. It should make the existing minimal slice the correct template for all next slices.

## User Stories

1. As a future contributor, I want one obvious application-service pattern to copy, so that new use cases do not drift into ad hoc Effect shapes.
2. As a maintainer, I want runtime schemas to define the truth for persisted state and important value objects, so that TypeScript-only assumptions do not leak into production behavior.
3. As a maintainer, I want the existing `setup` slice to remain the smallest complete example, so that contributors can learn the architecture from one real end-to-end path.
4. As a CLI user, I want interactive prompting to stay outside the core use case, so that the business logic remains testable and reusable.
5. As a future developer, I want current ports to be first-class services with explicit dependencies, so that service composition is uniform across the codebase.
6. As a maintainer, I want value objects such as identity alias and key fingerprint to be branded, so that accidental string mixups are prevented by construction.
7. As a maintainer, I want absence to be represented with `Option` in domain and app code, so that nullable behavior is explicit and consistent.
8. As a maintainer, I want validation to come from schemas and schema-backed constructors, so that domain rules are not duplicated between ad hoc helper logic and runtime decode logic.
9. As a CLI user, I want `setup` failures to return non-zero exit codes, so that shell automation can trust command outcomes.
10. As a CLI user, I want stdout and stderr responsibilities to be clear, so that scripts can safely consume command output.
11. As a maintainer, I want infrastructure failures to be split into specific tagged errors, so that failures are diagnosable and recoverable without generic adapter buckets.
12. As a maintainer, I want application services to remap infrastructure failures into use-case-level errors, so that CLI behavior does not depend on adapter internals.
13. As a maintainer, I want home-state loading to decode and validate stored data before it reaches domain logic, so that corrupt or outdated local state is rejected explicitly.
14. As a future contributor, I want a typed config boundary for home directory resolution and similar runtime inputs, so that global process state does not quietly leak into core code.
15. As a future contributor, I want injected time in the application layer, so that business behavior does not depend on direct `new Date()` calls.
16. As a maintainer, I want lightweight tracing and structured logging built into the base service pattern, so that observability is default rather than optional retrofit work.
17. As a test author, I want application-service tests to use `@effect/vitest` layers, so that tests model the same dependency story as production code.
18. As a maintainer, I want CLI integration tests to be black-box and hermetic, so that the contract is verified without hidden build prerequisites.
19. As a test author, I want a clear split between domain tests, app/service tests, and CLI tests, so that each test type has a stable purpose.
20. As a reviewer, I want errors, schemas, and services to follow one naming and ownership model, so that architecture reviews are fast and objective.
21. As a maintainer, I want the top-level package structure to stay readable while still supporting feature-oriented growth, so that the project can scale without a premature folder explosion.
22. As a future contributor, I want contributor-facing docs to describe the scaffold rules, so that new work starts from the intended architecture instead of reverse-engineering it.
23. As a maintainer, I want rollback behavior in the current slice to remain explicit and tested, so that future mutation flows inherit safe persistence semantics.
24. As a CLI user, I want the current `setup` command to preserve its basic user intent while tightening semantics, so that the scaffold improves architecture without inventing unrelated product scope.

## Implementation Decisions

- The refactor targets the existing `setup` vertical slice only. The purpose is to harden structure, not to add new end-user capabilities.
- The package remains CLI-only in scope. There is no requirement to design for HTTP, RPC, or UI surfaces in this task.
- The top-level package structure stays layered for readability, while internal modules may become feature-oriented where it improves local cohesion.
- The application layer adopts one canonical pattern: each use case is represented by a first-class `Effect.Service` with explicit dependencies and named methods.
- Current ports are promoted to first-class `Effect.Service` modules instead of plain tags. This includes the home-state persistence boundary, cryptography boundary, and prompt boundary.
- CLI interaction remains a boundary concern. Prompting, user messaging, and exit-code mapping stay in the CLI layer and do not move into domain or application services.
- Runtime schemas become the source of truth for important data models. Persisted home state and important domain value objects are no longer trusted through unchecked casts.
- Important string-based concepts become branded value objects. The approved initial set is identity alias, key fingerprint, recipient, encrypted private key payload, and private key relative path.
- Domain and application code use `Option` for absence. Null-like states are converted at the boundaries instead of being carried through the core model.
- Domain validation uses schema-backed constructors or decode helpers. Throwing validation helpers are replaced by explicit decode or effectful construction paths.
- The error model is split by layer:
  - domain errors represent business invariants and domain rule violations
  - application errors represent orchestration and use-case-level failures
  - infrastructure errors represent fine-grained adapter failures
- Application services own remapping from infrastructure failures into use-case-level failures before CLI rendering.
- The home-state persistence boundary must decode local state on read and encode the canonical schema on write.
- Config and time are injected. Runtime environment lookup and current time are not read directly from the application layer.
- Observability is part of the base pattern. Service methods use `Effect.fn` names and may annotate key identifiers or operation context where useful.
- CLI contracts become strict:
  - success exits with code `0`
  - handled failures still exit non-zero
  - stdout is reserved for success/info that callers may consume
  - stderr is reserved for diagnostics and failure messages
  - an existing active key during `setup` is treated as a failure, not a silent success
- The scaffold must preserve and clarify rollback behavior for partially completed writes during identity creation.
- The refactor includes contributor-facing guidance updates so the intended scaffold rules are discoverable without reading implementation code line-by-line.

## Testing Decisions

- A good test verifies external behavior and durable contracts, not incidental implementation details or private helper structure.
- The test strategy is intentionally part of the scaffold design, not an afterthought.
- The approved test tiers are:
  - domain/unit tests for schema-backed value objects and pure domain rules
  - application-service tests using `@effect/vitest` and layer-based dependency injection
  - black-box CLI integration tests that assert stdout, stderr, exit codes, and observable filesystem behavior
- The current identity-creation flow and rollback semantics must remain covered by tests after the refactor.
- The typed persistence boundary must be tested against valid and invalid stored state conditions.
- CLI tests should remain hermetic and should not depend on a prebuilt artifact existing from an unrelated step.
- Test modules should demonstrate the same layering and dependency patterns contributors should use for future features.
- Prior art in the current codebase includes:
  - the existing unit test for identity creation behavior
  - the integration test using the real crypto adapter with an in-memory repository
  - the sandboxed CLI contract test for `setup`
- Those tests are useful as behavior seeds, but they should be reshaped to match the new architecture and testing conventions.

## Out of Scope

- Adding new end-user commands or broader v0 functionality beyond the current minimal `setup` slice
- Expanding the product into non-CLI delivery surfaces
- Redesigning the cryptographic product concept beyond what is required to fit the strict scaffold
- Implementing future domain features such as payload handling, sharing flows, editing flows, rotation flows, or identity registry expansions beyond what the current slice already needs
- Reworking the broader repository outside the package and its directly relevant contributor guidance
- Optimizing for the smallest possible amount of code if that conflicts with establishing a stronger canonical architecture

## Further Notes

- This refactor is intentionally foundational. It is expected to add some ceremony compared with the current minimal scaffold because the primary deliverable is a safer and more consistent template for future work.
- The key evaluation criterion is not “did the package gain more user-visible capability?” but “does the current end-to-end slice now demonstrate the exact architecture future slices should follow?”
- The target result should make architecture review easier by replacing subjective style debates with explicit scaffold rules.
