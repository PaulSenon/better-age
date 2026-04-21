# GRILL_ME_AUDIT_EFFECT

Append-only notes for `packages/cli` base restructure.
Goal: strict canonical vertical slice for future features.
Scope: CLI-only app, but CLI interactivity decoupled from core domain/app logic.

---

## 2026-04-12 - Seed

### User intent

- Audit current `packages/cli` scaffold.
- Use `effect-best-practices` skill as baseline.
- Stress-test structure so it becomes example to copy for all next features.
- No edits at first; audit + recommendations only.

### Codebase slice reviewed

- Domain:
  - `src/domain/error/BetterAgeError.ts`
  - `src/domain/identity/Identity.ts`
  - `src/domain/identity/IdentityAlias.ts`
  - `src/domain/home/HomeState.ts`
- Ports:
  - `src/port/HomeRepository.ts`
  - `src/port/Crypto.ts`
  - `src/port/Prompt.ts`
- App:
  - `src/app/usecase/createUserIdentity.ts`
- Infra:
  - `src/infra/fs/nodeHomeRepository.ts`
  - `src/infra/crypto/typageCrypto.ts`
  - `src/infra/prompt/nodePrompt.ts`
- CLI:
  - `src/cli/command/setupUserKey.ts`
  - `src/cli/program.ts`
  - `src/cli/main.ts`
- Tests:
  - `test/unit/createUserIdentity.test.ts`
  - `test/integration/createUserIdentity.integration.test.ts`
  - `test/integration/setupUserKey.cli.test.ts`
  - `test/support/inMemoryHomeRepository.ts`
  - `test/support/runSandboxedCli.ts`

### External refs checked

- Effect docs: `Effect.fn`, layers, `@effect/vitest`
- Effect language-service repo/docs
- Local skill refs:
  - service patterns
  - error patterns
  - effect primitives
  - otel patterns
  - typescript patterns
  - test patterns

### Audit verdict

- Verdict: `NEEDS WORK`
- Score: `6/10`

### Main findings

#### Critical

- Errors use `Data.TaggedError`, not `Schema.TaggedError`.
- Errors lack consistent `message` field and rich typed context shape.
- FS boundary trusts `JSON.parse(raw) as HomeState`; no runtime decode at persistence boundary.
- CLI catches expected failures, prints, then likely exits `0`; bad for scripting.
- CLI integration test depends on prebuilt `dist/cli.cjs`; not hermetic from clean checkout.

#### Warning

- Ports are `Context.GenericTag` + manual layers; not `Effect.Service`.
- Use case is plain exported function, not canonical app service.
- Domain uses raw strings and nullable fields; no branded types / `Option`.
- Validation/config still manual (`throw`, regex, direct `process.env`).
- Tests use plain `vitest`, not `@effect/vitest`.
- Failure-path coverage too thin for canonical slice.

#### Solid parts worth keeping

- Clear layer split: `domain -> port -> app -> infra -> cli`.
- Core use case mostly independent from CLI interactivity.
- Save rollback deletes written private key on save failure.
- In-memory repo + sandboxed CLI support are good fixture directions.

### Initial recommendations

- Make runtime schemas first-class across domain + persistence.
- Migrate errors to `Schema.TaggedError`.
- Introduce canonical app service per use case with declared deps.
- Strong domain value objects / branded types.
- Typed config boundary.
- CLI should map failures to non-zero exit codes.
- Move tests to `@effect/vitest` and cover rollback/error semantics.

---

## 2026-04-12 - Grill session

### Q1

- Question: should there be one canonical service boundary per use-case?
- Recommended answer: `yes`
- Reason:
  - makes app layer the obvious copy pattern
  - keeps CLI concerns outside core
  - enforces explicit deps and method naming

### A1

- User answer: `yes ?`
- Interpreted decision: `yes`

### Current agreed constraints

- Strict base wanted, to shape future code by copy.
- CLI-only scope.
- CLI interactivity must stay decoupled from core domain/app logic.
- If `Effect.Service` is better than tags for ports, user is open to move there.

### Pending branches

- Canonical shape for app services
- Whether ports also become `Effect.Service`
- Error model strictness
- Schema/decode boundaries
- Domain value object strategy
- CLI exit-code strategy
- Test architecture strategy

### Q2

- Question: should all 3 current ports become `Effect.Service`?
- Recommended answer: `yes`
- Reason:
  - uniform service pattern everywhere
  - `Default` layers + declared deps
  - less split brain between tag definition and live layer
  - easier copy template

### A2

- User answer: `yes migrate to service`
- Interpreted decision: `yes, all current ports`

### Q3

- Question: should base go all-in on `Schema`, including internal CLI-only boundaries?
- Recommended answer: `yes`
- Reason:
  - no TS-only/runtime-trust split
  - one copyable pattern across domain, persistence, errors
  - removes unsafe `JSON.parse(...) as X`

### A3

- User answer: `yes`
- Interpreted decision: `yes, strict schema-first base`

### Q4

- Question: should meaningful strings become branded value objects?
- Recommended answer: `yes, selective`
- Recommended set:
  - `IdentityAlias`
  - `KeyFingerprint`
  - `Recipient`
  - `EncryptedPrivateKey`
  - `PrivateKeyRelativePath`
- Keep plain:
  - user-facing messages
  - raw prompt input before decode
  - infra-local root dirs unless needed cross-layer

### A4

- User answer: `yes for the subset you suggested`
- Interpreted decision: `yes, selective branded value objects`

### Q5

- Question: should domain/app use `Option`, not `null`?
- Recommended answer: `yes`
- Reason:
  - explicit absence
  - consistent Effect idiom
  - stronger template for future code

### A5

- User answer: `yes`
- Interpreted decision: `yes, strict Option in domain/app`

### Q6

- Question: should infra errors be split into explicit tagged failures instead of generic adapter errors?
- Recommended answer: `yes`
- Examples:
  - `HomeStateLoadError`
  - `HomeStateDecodeError`
  - `HomeStateSaveError`
  - `PrivateKeyWriteError`
  - `PrivateKeyDeleteError`
  - `IdentityGenerationError`
  - `PromptReadAbortedError`
  - `PromptUnavailableError`

### A6

- User answer: `yes, split them`
- Interpreted decision: `yes, explicit fine-grained error taxonomy`

### Q7

- Question: should app services remap infra errors into app/domain errors before CLI sees them?
- Recommended answer: `yes, mostly`
- Pattern:
  - domain errors = business invariants
  - app errors = orchestration/use-case failures
  - infra errors remain internal unless boundary needs exact adapter distinction

### A7

- User answer: `yes that's perfect`
- Interpreted decision: `yes, app owns remapping boundary`

### Q8

- Question: should validation use schema as single source of truth, with tiny helpers around decode instead of handwritten throwing validators?
- Recommended answer: `yes`
- Pattern:
  - schema/brand owns rules
  - helper wraps decode
  - use-case maps decode failure into domain/app error
  - no throw-based validation helper

### A8

- User answer: `yes`
- Interpreted decision: `yes, schema-first constructors/helpers`

### Q9

- Question: should typed config + Effect time be injected in canonical slice?
- Recommended answer: `yes`
- Concrete:
  - use Effect time / Clock, not `new Date()`
  - home/config path via typed config service
  - keep username/hostname at CLI edge if only for prompt defaults

### A9

- User answer: `yes`
- Interpreted decision: `yes, typed config + Effect time`

### Q10

- Question: should CLI use strict exit/result mapping?
- Recommended answer: `yes`
- Rule:
  - exit `0` only on real success
  - non-zero on validation/prompt/config/app/infra failure
  - stdout for success/info
  - stderr for failure
- Specific recommendation:
  - `setup` with active key already existing => non-zero failure

### A10

- User answer: `yes`
- Interpreted decision: `yes, strict exit codes; existing active key is failure`

### Q11

- Question: should tests be strict architectural template too?
- Recommended answer: `yes`
- Recommended 3-tier shape:
  - domain/unit
  - app/service with `@effect/vitest` + `it.layer(...)`
  - cli black-box integration
- Extra strict rules:
  - no plain `vitest` for Effect service tests
  - no prebuilt artifact dependency for CLI tests

### A11

- User answer: `yes`
- Interpreted decision: `yes, strict 3-tier test template`

### Q12

- Question: should canonical slice include lightweight observability by default?
- Recommended answer: `yes`
- Baseline:
  - `Effect.fn("Service.method")`
  - span annotations for key ids/context
  - structured logs only
  - no heavy OTEL infra yet

### A12

- User answer: `yes`
- Interpreted decision: `yes, lightweight observability mandatory`

### Q13

- Question: should top-level structure stay layered, with feature-oriented subfolders inside layers?
- Recommended answer: `yes`
- Shape:
  - layered top-level for readability in small CLI
  - feature-oriented modules within `app/`, `domain/`, `cli` as needed
  - avoid full top-level vertical explosion too early

### A13

- User answer: `yes perfect`
- Interpreted decision: `yes, layered top-level + feature-oriented internals`

---

## 2026-04-12 - PRD and plan generation

### User request

- infer PRD with `write-a-prd`
- infer plan with `prd-to-plan`
- scope:
  - clean current super-minimal project structure implementation
  - do not add more core package functionality
  - make current first vertical slice the best-practice scaffold to copy next

### Outputs created

- PRD: `BETTER_AGE_EFFECT_BASE_PRD.md`
- Plan: `plans/better-age-effect-base.md`

### Synthesis notes

- PRD centers on strict Effect/DDD scaffold refactor, not feature expansion
- plan phases chosen:
  1. canonical schema-first setup slice
  2. serviceify boundaries and error ownership
  3. harden CLI contract around new core
  4. rebuild test scaffold as architecture example
  5. lock scaffold into contributor guidance

---

## 2026-04-12 - Implementation pass

### User request

- proceed to implementation of plan

### Main implementation outcomes

- removed old minimal scaffold files:
  - legacy `BetterAgeError`
  - legacy plain `createUserIdentity` use-case function
- introduced schema-first core:
  - branded value objects for alias, fingerprint, recipient, encrypted private key, private key relative path
  - schema-backed `StoredIdentityRecord`
  - schema-backed `HomeState` with `OptionFromNullOr`
- introduced layered error model:
  - domain errors
  - app/use-case errors
  - boundary/config/prompt/crypto/home-repository errors
- migrated current boundaries to `Effect.Service` service contracts
- introduced canonical app service:
  - `CreateUserIdentity`
  - named `Effect.fn("CreateUserIdentity.execute")`
  - injected Effect time via `Clock.currentTimeMillis`
  - rollback on save failure preserved
- introduced typed config boundary and node live config layer
- rewired CLI `setup` command:
  - prompt kept at CLI edge
  - app service invoked from CLI
  - strict non-zero exit behavior for handled failures
  - existing active key now treated as failure
- rewired program layer composition to new live layers
- rewrote tests:
  - domain tests
  - app tests with `@effect/vitest` + layered services
  - integration test with real crypto
  - sandbox CLI tests execute TS source via Node strip-types, not prebuilt bundle
- updated docs:
  - package README current-status note
  - CONTRIBUTING scaffold rules, test model, source-first CLI test rule
- added `@effect/language-service` dev dependency
- enabled tsconfig plugin for Effect language service

### Known limitation of this pass

- no `pnpm check`
- no `pnpm test`
- no runtime verification performed in-turn due repo instruction not to run build/test/dev commands unless explicitly asked

## 2026-04-12 follow-up: check/test stabilization
- User asked to run `check`, `test`, and typecheck after initial scaffold refactor left breakage.
- Verified `pnpm -F @better-age/cli check` now passes (`tsc --noEmit`).
- Verified `pnpm -F @better-age/cli test` now passes (5 files, 10 tests).
- Main fixes applied:
  - corrected `Effect.Service` port placeholder typing to avoid `never` inference
  - fixed `CreateUserIdentity` so it captures `Crypto` and `HomeRepository` during service construction instead of leaking deps into method call time
  - corrected layer composition in `src/program/layer.ts`
  - fixed CLI contract because `@effect/cli Command.run` discards handler return values; command now fails with a dedicated handled CLI error and `runCli` maps that to exit code `1`
  - fixed `nodePrompt` to use live `process.stdin/stdout/stderr` instead of module-level imports so tests can override stdin
  - replaced brittle `secure-exec`-based CLI harness with temp-dir host-process harness that transpiles source to `.test-dist` and runs the CLI without a prebuilt artifact
- Result: scaffold is typecheck-clean and test-clean again.
- Follow-up correction: `.test-dist` was an incorrect temporary transpiled test artifact; e2e CLI harness is now pointed back at built output `dist/cli.cjs` and should only be rerun after a fresh build.
- Correction after user feedback: restored `secure-exec` as a package dev dependency and switched `test/e2e/cli/fixtures/runBuiltCli.ts` back to a real sandboxed built-CLI runner using `createKernel` + `createNodeRuntime` + in-memory FS. The earlier unsandboxed host-spawn runner was incorrect for the intended e2e contract.
