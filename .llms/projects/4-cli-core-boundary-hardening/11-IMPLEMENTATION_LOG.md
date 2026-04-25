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

## 2026-04-25 Phase 3 Start

Goal:

- Build core identity and key lifecycle over fake ports.
- Keep behavior test-first through public core APIs.
- Cover setup, export, import/list/forget, rotation, and passphrase change.

Actions completed:

- Added `packages/core/src/identity/BetterAgeCore.ts`.
- Added fakeable core ports: home repository, identity crypto, clock, random ids.
- Added public `createBetterAgeCore(...)` factory with command/query groups.
- Implemented self identity setup with protected current key metadata.
- Implemented public identity export with no private key material.
- Implemented known identity import with alias overlay and outcomes: `added`, `updated`, `unchanged`, `alias-updated`.
- Implemented duplicate/invalid alias checks.
- Implemented self import and self forget guards.
- Implemented known identity listing and forgetting by owner id.
- Implemented self identity and retired key read models.
- Implemented identity rotation under same owner id, retiring previous key.
- Implemented passphrase change by decrypting and re-protecting current plus retired key blobs.

TDD notes:

- RED: setup/export test failed on missing core module.
- GREEN: added minimal core factory, setup, export.
- RED: import/list failed on missing methods.
- GREEN: added identity string import, alias overlay, known identity persistence/listing.
- RED: reimport outcome test failed because existing imports always returned `updated`.
- GREEN: added unchanged/alias-updated/updated classification.
- RED: self/list/forget test failed on missing methods.
- GREEN: added self summary, retired key summary, exact forget behavior.
- RED: rotation test failed on missing method.
- GREEN: added current-key decrypt check, new protected key write, retired key metadata update.
- RED: passphrase change test failed on missing method.
- GREEN: added re-protection loop across current and retired refs.
- RED: invalid setup test failed because empty display name was accepted.
- GREEN: added minimal setup name validation.

Verification:

- `pnpm -F @better-age/core test` passed: 15 unit tests.
- `pnpm -F @better-age/core check` passed.
- `pnpm check` passed.

Notes:

- Phase 3 uses fake crypto/home ports only; real filesystem and age adapter proofs remain Phase 5.
- Current handle/fingerprint derivation for known identities is intentionally deterministic and local to this fake-port core slice.

## 2026-04-25 Phase 4 Start

Track check:

- Phase 1 workspace split is done.
- Phase 2 artifact/migration foundation is done.
- Phase 3 identity/key lifecycle over fake ports is done.
- Phase 4 is the correct next slice from `plans/better-age-mvp-reimplementation.md`.
- Work remains inside `@better-age/core`; CLI/varlock remain untouched for later phases.

Goal:

- Build core payload lifecycle over fake ports.
- Cover create, decrypt, edit, grant, revoke, stale self-recipient notice, update gate, update refresh, and semantic failures.

Actions completed:

- Added fakeable payload repository and payload crypto ports to `createBetterAgeCore`.
- Added `createPayload`.
- Added `decryptPayload` read model with env keys, recipient summaries, compatibility state, and update recommendation notice.
- Added `editPayload` with `.env` validation and `edited|unchanged` outcomes.
- Added `grantPayloadRecipient` with self guard and `added|updated|unchanged` outcomes.
- Added `revokePayloadRecipient` with self guard and `removed|unchanged` outcomes.
- Added stale self-recipient write gate returning `PAYLOAD_UPDATE_REQUIRED`.
- Added `updatePayload` self-recipient refresh with `updated|unchanged` outcomes.
- Added payload semantic failures: duplicate create, missing payload, wrong passphrase.
- Added `packages/core/src/identity/BetterAgeCore.payload.test.ts`.

TDD notes:

- RED: create/decrypt payload test failed on missing `createPayload`.
- GREEN: added payload ports, create, decrypt.
- RED: edit test failed on missing `editPayload`.
- GREEN: added env validation, payload open/write helpers, edit outcomes.
- RED: grant/revoke test failed on missing methods.
- GREEN: added exact recipient mutations, self guards, idempotent outcomes.
- RED: stale self test failed because grant was allowed on outdated payload.
- GREEN: added update-required write gate and `updatePayload`.
- RED: edge case pass added for duplicate create/missing payload/wrong passphrase.
- GREEN: existing behavior already mapped those semantic failures.

Verification:

- `pnpm -F @better-age/core test` passed: 20 unit tests.
- `pnpm -F @better-age/core check` passed.
- `pnpm check` passed.

Notes:

- Payload crypto remains fake-port only; real encrypted payload proof remains Phase 5.
- Payload schema migration remains current-v1/no-op; only self-recipient refresh is exercised as an update reason in Phase 4.
