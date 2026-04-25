# Implementation Log: Better Age MVP Reimplementation

Status: append-only implementation log.

## 2026-04-25 Phase 1 Start

Goal:

- Park current CLI as private legacy source reference.
- Create new core package skeleton.
- Create new CLI package skeleton.
- Keep implementation resumable after compaction.

Constraints:

- No dev/build/test commands in this session unless explicitly requested.
- Keep changes scoped to Phase 1 workspace/package skeleton work.
- Do not refactor legacy CLI.

Initial decisions:

- `packages/cli` will move to `packages/cli-legacy`.
- legacy package becomes `@better-age/cli-legacy`.
- legacy package becomes private.
- legacy package loses `bin.bage`.
- new `packages/core` starts dependency-light.
- new `packages/cli` starts dependency-light and does not expose `bage` bin until CLI implementation phase.

Actions completed:

- Moved the current implementation from `packages/cli` to `packages/cli-legacy`.
- Created a fresh `packages/cli` skeleton for the future CLI implementation.
- Created a fresh `packages/core` skeleton for the future core implementation.
- Kept new package skeletons intentionally minimal: package metadata, tsconfig, placeholder source, test README.
- Kept legacy source as reference only; no legacy refactor.
- Updated `pnpm-lock.yaml` importers to reflect `packages/cli`, `packages/cli-legacy`, and `packages/core`.

Resulting workspace shape:

- `packages/cli-legacy`: old implementation, private, no command bin.
- `packages/core`: new core package skeleton.
- `packages/cli`: new CLI package skeleton, no command bin yet.
- `packages/varlock`: unchanged.

Verification:

- Read-only status/diff inspection completed.
- `git diff --check` initially found two trailing blank-line issues in new CLI docs; fixed.
- Lockfile importer drift was inspected and patched manually because install commands are outside session constraints.
- No build, test, typecheck, package install, dev server, or deploy command was run.

Known follow-up:

- Decide in Phase 2 whether package-local `devDependencies` should be added or root workspace tooling is enough for new package scripts.

## 2026-04-25 Phase 2 Start

Goal:

- Implement pure v1 artifact parse/encode/migration foundation.
- Add deterministic unit tests before/with implementation.
- Configure new packages with Effect language-service TypeScript checking.

Actions completed:

- Added `effect` runtime dependency to `@better-age/core`.
- Added `effect` and `@effect/cli` runtime dependencies to `@better-age/cli`.
- Added package-local test/typecheck/lint tooling deps to new core and CLI packages.
- Mirrored legacy Effect language-service `tsconfig` plugin config into new core and CLI packages.
- Added Vitest unit config for new core and CLI packages.
- Added `packages/core/src/persistence/ArtifactDocument.ts`.
- Added v1 schemas, parse functions, JSON encode functions, no-op migration functions, and public identity string encode/parse.
- Added canonical v1 artifact fixtures under `packages/core/test/fixtures/artifacts`.
- Added fixture layout documentation.

TDD notes:

- RED: home-state parser/migration test failed because module was absent.
- GREEN: implemented initial home-state schema/parser/migration.
- RED: all-artifact parser/migration test failed on missing functions.
- GREEN: implemented private-key, payload plaintext, payload document, and public-identity documents.
- RED: invalid/future/prototype cases failed on missing error classes/classification.
- GREEN: added parser preflight and structured artifact errors.
- RED: encode and identity-string round-trip test failed on missing functions.
- GREEN: added JSON encoders and shareable identity string parser/encoder.

Verification:

- `pnpm -F @better-age/core test` passed: 7 unit tests.
- `pnpm -F @better-age/core check` passed.
- `pnpm -F @better-age/cli check` passed.
- `pnpm check` initially exposed missing workspace links for `@better-age/varlock`; ran `pnpm install`.
- `pnpm check` then passed for all workspace packages and root Biome.

Notes:

- Root Biome formatted `.llms/projects/4-cli-core-boundary-hardening/1-BOUNDARY_API_SPEC.ts`.
- `packages/core/src/persistence/ArtifactDocument.ts` is intentionally pure: no filesystem, no crypto, no app services.
- Encrypted private key blob crypto round-trips remain Phase 5 real-adapter work.
