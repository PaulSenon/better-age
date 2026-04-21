# Plan: Better Secrets Effect Base

> Source PRD: `../1-BETTER_AGE_EFFECT_BASE_PRD.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Scope**: refactor the existing `setup` vertical slice only; do not add broader product capability.
- **Delivery surface**: CLI-only. Prompting and rendering stay at the CLI edge.
- **Top-level shape**: layered package structure remains, with feature-oriented internal modules where that increases cohesion.
- **Application pattern**: use-cases are first-class `Effect.Service` services with explicit dependencies and named methods.
- **Port pattern**: the current home-state, crypto, and prompt boundaries become `Effect.Service` services too.
- **Schema policy**: runtime schemas are the source of truth for value objects, persisted state, and errors.
- **Domain value objects**: brand identity alias, key fingerprint, recipient, encrypted private key payload, and private key relative path.
- **Absence model**: domain and application layers use `Option`; boundary layers perform nullish conversion.
- **Error model**: infrastructure errors are specific and fine-grained; application services remap them into use-case-level errors before CLI handling.
- **Runtime inputs**: config and time are injected, not read implicitly from application code.
- **Observability**: service methods use `Effect.fn`; structured logging and light span annotations are part of the default pattern.
- **CLI contract**: non-success cases exit non-zero; `setup` fails when an active key already exists.
- **Testing model**: domain/unit tests, app/service tests with `@effect/vitest`, and hermetic black-box CLI tests.

---

## Phase 1: Canonical Schema-First Setup Slice

**User stories**: 1, 2, 3, 4, 6, 7, 8, 13, 15, 23, 24

### What to build

Rebuild the existing identity-creation slice around schema-backed value objects and a canonical application-service shape while preserving the user-facing `setup` command as the only end-to-end behavior in scope.

Implementation details:
- define the runtime schemas and branded value objects that the slice will rely on
- redesign the persisted home-state model to use schema-backed types and `Option` for absence semantics in the core model
- replace throw-based alias validation with schema-backed construction and explicit failure handling
- create the canonical application service for the identity-creation use case, including injected time and the rollback semantics already present in the current slice
- keep the current end-to-end user intent intact: a user can still run `setup` to create the first active identity

### Acceptance criteria

- [ ] The current `setup` slice still works end-to-end after the refactor.
- [ ] Core identity and home-state data are represented by runtime schemas rather than unchecked TypeScript-only shapes.
- [ ] The approved string concepts are branded value objects.
- [ ] Domain and application code use `Option` instead of `null`.
- [ ] The identity-creation use case is exposed through a first-class application service with injected time.
- [ ] Rollback semantics for partial persistence remain part of the slice contract.

---

## Phase 2: Serviceify The Boundaries And Error Ownership

**User stories**: 5, 9, 11, 12, 14, 16, 20

### What to build

Convert the current boundary modules into first-class services, split the error taxonomy by layer, and make the application layer the owner of use-case-level failure semantics.

Implementation details:
- promote the current persistence, crypto, and prompt boundaries into `Effect.Service` modules
- split adapter failures into specific schema-backed infrastructure errors
- define application-level error shapes for the identity-creation slice
- remap boundary failures inside the application service so CLI code no longer depends on low-level adapter details
- inject typed config for home-resolution behavior and remove implicit runtime reads from application code
- add lightweight observability to the canonical service path using named `Effect.fn` methods and minimal span context

### Acceptance criteria

- [ ] The current persistence, crypto, and prompt boundaries are represented as first-class services.
- [ ] Infrastructure failures are no longer grouped into generic adapter-error buckets.
- [ ] The application layer exposes use-case-level failures instead of leaking adapter failures to the CLI.
- [ ] Config needed by the slice is injected through a typed boundary.
- [ ] Named service methods provide the observability baseline for the slice.

---

## Phase 3: Harden The CLI Contract Around The New Core

**User stories**: 4, 9, 10, 12, 24

### What to build

Rewire the `setup` command so it becomes a strict CLI shell around the new canonical core, with clear responsibility boundaries for prompting, message rendering, and exit-code behavior.

Implementation details:
- restrict CLI orchestration to argument handling, interactive input, output formatting, and error-to-exit mapping
- keep prompt-specific concerns at the edge and pass already-resolved inputs into the application service
- make stdout and stderr responsibilities explicit and stable
- make handled failure cases still terminate non-zero
- treat “active key already exists” as a failed create attempt rather than a successful no-op

### Acceptance criteria

- [ ] The CLI layer depends on application-level contracts rather than low-level adapter internals.
- [ ] Success and failure output channels are clearly separated.
- [ ] The command returns non-zero for handled failures, including an already-existing active key.
- [ ] Interactive prompting remains decoupled from the domain and application core.
- [ ] The visible command behavior is stricter without increasing product scope.

---

## Phase 4: Rebuild The Test Scaffold As The Architecture Example

**User stories**: 17, 18, 19, 20, 23

### What to build

Reshape the test suite so it teaches and enforces the approved architecture. The package should end this phase with one obvious testing pattern for domain rules, application services, and CLI contracts.

Implementation details:
- create pure domain tests for schema-backed value objects and rule behavior
- move application-service testing to `@effect/vitest` with layered dependency injection
- preserve the current real-adapter identity-creation verification, but express it through the approved test architecture
- rebuild the CLI contract test to remain black-box and hermetic without relying on a prebuilt artifact from an external step
- expand coverage to include failure paths that define the scaffold contract: invalid input, decode failure, rollback behavior, and strict exit semantics

### Acceptance criteria

- [ ] Domain tests cover schema-backed value construction and rule failures.
- [ ] Application-service tests use `@effect/vitest` and layer-based composition.
- [ ] CLI integration tests verify stdout, stderr, exit codes, and observable persisted results.
- [ ] CLI tests are hermetic and do not require a prior build artifact to exist.
- [ ] The test suite covers the key failure-path contracts of the scaffold, not only the happy path.

---

## Phase 5: Lock The Scaffold Into Contributor Guidance

**User stories**: 1, 20, 21, 22

### What to build

Update the package guidance so contributors can follow the scaffold rules deliberately rather than discovering them only by reading code.

Implementation details:
- document the canonical layered structure and where feature-oriented modules should live
- document the service pattern, schema-first rule, error ownership rule, and CLI boundary rule
- document the approved test tiers and what each tier is responsible for proving
- document any required tooling or editor support that materially strengthens the Effect development workflow for this package

### Acceptance criteria

- [ ] Contributor-facing guidance describes the scaffold rules in concrete terms.
- [ ] The docs explain how new use cases, ports, errors, and tests should be shaped.
- [ ] The package exposes one coherent architecture story across code and docs.
- [ ] A new contributor could reasonably copy the scaffold for the next feature without reverse-engineering hidden conventions.
