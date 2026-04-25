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

## 2026-04-25 Phase 5 Start

Track check:

- Phase 1 workspace split is done.
- Phase 2 artifact/migration foundation is done.
- Phase 3 identity/key lifecycle over fake ports is done.
- Phase 4 payload lifecycle over fake ports is done.
- Phase 5 is the correct next slice from `plans/better-age-mvp-reimplementation.md`.
- Work remains inside `@better-age/core`; CLI/varlock remain untouched for later phases.

Goal:

- Add real filesystem and age-backed core adapters.
- Prove v1 file layout, age-native encrypted key blobs, encrypted payload files, passphrase change, rotation, grant, and revoke through focused integration tests.

Actions completed:

- Added `age-encryption` dependency to `@better-age/core`.
- Split core test scripts into unit and integration configs.
- Added `packages/core/src/infra/RealCoreAdapters.ts`.
- Added node home repository adapter:
  - `home-state.json`
  - `keys/<fingerprint>.age`
  - atomic writes
- Added node payload repository adapter with atomic writes.
- Added age identity crypto adapter:
  - hybrid identity generation
  - public recipient derivation
  - passphrase-protected private key blobs
  - protected private key decrypt/parse
- Added age payload crypto adapter:
  - recipient encryption
  - identity decryption
  - armored age payloads
- Added `packages/core/test/integration/real-adapters/RealCoreAdapters.integration.test.ts`.
- Fixed payload decrypt/open behavior to try current plus retired local keys, so rotated identities can still decrypt old payloads.

TDD notes:

- RED: real adapter integration test failed on missing `RealCoreAdapters`.
- GREEN: added node fs adapters and age crypto adapters.
- RED: rotation/passphrase integration exceeded default test timeout.
- GREEN: raised integration-only timeout to 30s.
- RED: rotated identity could not decrypt payload encrypted to retired key.
- GREEN: changed payload decrypt/open to load current + retired key blobs.
- RED: grant/revoke real-recipient proof added.
- GREEN: existing grant/revoke behavior worked with real age adapters after retired-key decrypt fix.

Verification:

- `pnpm -F @better-age/core test` passed:
  - 20 unit tests.
  - 3 integration tests.
- `pnpm -F @better-age/core check` passed.
- `pnpm check` passed.

Notes:

- Integration tests intentionally remain focused and do not duplicate unit branch coverage.
- Age passphrase crypto is slow enough that integration tests need a longer timeout.
- Real adapter work validates encrypted key and payload files use age armor.

## 2026-04-25 Phase 6 Start

Track check:

- Phase 1 workspace split is done.
- Phase 2 artifact/migration foundation is done.
- Phase 3 identity/key lifecycle over fake ports is done.
- Phase 4 payload lifecycle over fake ports is done.
- Phase 5 real core adapters are done.
- Phase 6 is the correct next slice from `plans/better-age-mvp-reimplementation.md`.
- Scope remains identity CLI only; payload CLI flows stay Phase 7+.

Goal:

- Build the first new CLI identity slice.
- Cover setup, identity export/import/list/forget, prompt policy, presenter output, stdout/stderr split, and headless/interactive behavior.

Actions completed:

- Added `@better-age/core` workspace dependency to `@better-age/cli`.
- Added explicit core package entrypoint exports for the core factory, ports, summaries, and real adapters.
- Added `packages/cli/src/cli/runCli.ts` as the public identity command runner.
- Added `packages/cli/src/cli/presenter.ts` for human success/error/list rendering and machine-clean identity export output.
- Added `packages/cli/src/cli/nodeCli.ts` to wire the runner to real core adapters with a default `~/.better-age` home.
- Added CLI contract tests for:
  - exact interactive setup.
  - guided interactive setup.
  - headless setup missing `--name`.
  - headless setup passphrase unavailable.
  - setup passphrase confirmation retry.
  - machine-clean `identity export`.
  - headless `identity import --alias`.
  - interactive alias retry on duplicate alias.
  - human `identity list`.
  - `identity forget` resolving local alias to owner id.
- Fixed core `importKnownIdentity` alias semantics so omitted alias preserves an existing local alias; explicit alias removal remains out of MVP.

TDD notes:

- RED: CLI contract test failed on missing `runCli`.
- GREEN: added minimal runner with parser, prompt policy, command dispatch, identity reference resolution, and stdout/stderr split.
- RED: core alias regression test failed because omitted alias cleared the existing alias.
- GREEN: core import now defaults omitted alias to existing alias when present.
- REFACTOR: moved human rendering into a presenter boundary without changing contracts.
- RED: acceptance gaps added for headless missing setup name and passphrase confirmation retry.
- GREEN: existing runner behavior covered those cases.

Verification:

- `pnpm -F @better-age/cli test:unit` passed: 6 tests.
- `pnpm -F @better-age/cli check` passed.
- `pnpm -F @better-age/core check` passed.
- `pnpm test` passed.
- `pnpm check` passed.
- `git diff --check` passed.

Notes:

- The new CLI runner is intentionally small and contract-first; there is no `bage` bin yet.
- `@effect/cli` remains the chosen CLI dependency, but this phase did not yet replace the runner's tiny argv parser with an `@effect/cli` command tree. That should be handled before packaging/help/completions work, or in the next CLI infrastructure pass.

## 2026-04-25 Phase 7 Start

Track check:

- Phase 6 is complete.
- Phase 7 is the correct next slice from `plans/better-age-mvp-reimplementation.md`.
- Scope is new CLI payload create/read/edit only.
- Sharing and maintenance commands (`grant`, `revoke`, `update`) remain Phase 8.

Goal:

- Add `create`, `inspect`, `view`, `load`, and `edit` to the new CLI runner.
- Preserve command contracts: machine-clean stdout for `load`, no plaintext stdout for `view`, readable inspect output, prompt-policy correctness, and editor/viewer boundaries.

Actions completed:

- Extended the new CLI core contract with payload primitives:
  - `commands.createPayload`
  - `commands.editPayload`
  - `queries.decryptPayload`
- Added optional `payloadPathExists` preflight hook to `runCli`.
- Wired `createNodeCli` to pass the real payload repository existence check.
- Added payload path resolution for exact and guided interactive modes.
- Added shared payload context opening:
  - validates payload path before passphrase when `payloadPathExists` is available.
  - fails headless before decrypt.
  - retries wrong passphrase inline without returning to path selection.
  - routes payload update notices to stderr.
- Added `create` flow:
  - target existence checked before passphrase.
  - headless fails without creating.
  - success/error uses presenter.
- Added `inspect` flow:
  - renders payload metadata, env key names, and recipients.
  - never prints env values.
- Added `load --protocol-version=1` flow:
  - validates protocol before prompt/decrypt.
  - prints raw env text only to stdout.
  - routes warnings to stderr.
- Added `view` flow:
  - opens plaintext only through `terminal.openViewer`.
  - never prints plaintext to stdout.
- Added `edit` flow:
  - opens editor with current env text.
  - cancel returns cancelled.
  - unchanged returns success without mutation.
  - invalid `.env` reports error and reopens editor with previous edited text.
  - valid changed content calls core `editPayload`.
- Tightened core `decryptPayload` success typing by preserving literal `kind: "success"` and `code: "PAYLOAD_DECRYPTED"` for package-boundary compatibility.

TDD notes:

- RED: `create` contract failed because command was unknown.
- GREEN: added create flow and target-existence preflight hook.
- RED: `inspect` contract failed because command was unknown.
- GREEN: added payload context opening and inspect presenter.
- RED: `load` protocol/clean stdout contract failed because command was unknown.
- GREEN: added protocol gate and raw env stdout behavior.
- RED: `view` contract failed because command was unknown.
- GREEN: added viewer port and view command.
- RED: `edit` contract failed because command was unknown.
- GREEN: added editor port, invalid env retry loop, cancel/unchanged/changed handling.
- RED: mode/passphrase test added for headless and guided retry.
- GREEN: shared payload context covered mode policy.
- REFACTOR: no broad refactor; kept runner contract-first and presenter-owned output.

Verification:

- `pnpm -F @better-age/cli test:unit` passed: 12 tests.
- `pnpm -F @better-age/cli check` passed.
- `pnpm -F @better-age/core check` passed.
- `pnpm test` passed.
- `pnpm check` passed.
- `git diff --check` passed.

Notes:

- `@effect/cli` command-tree/parser integration is still pending; runner remains a small contract-first argv parser.
- There is still no `bage` bin.
- Real editor/viewer implementations are not introduced yet; Phase 7 defines the ports and tests CLI behavior through them.

## 2026-04-25 Phase 8 Start

Track check:

- Phase 7 is complete.
- Phase 8 is the correct next slice from `plans/better-age-mvp-reimplementation.md`.
- Scope is new CLI sharing/maintenance: `grant`, `revoke`, and `update`.
- Identity security commands remain Phase 9.

Goal:

- Add grant/revoke/update flows to the new CLI.
- Cover exact identity resolution, guided pickers, self/already-granted disabled states, outdated write gates, update-now resume, and idempotent success output.

Actions completed:

- Extended CLI core contract with:
  - `commands.grantPayloadRecipient`
  - `commands.revokePayloadRecipient`
  - `commands.updatePayload`
- Added `parseIdentityString` dependency to `runCli` for exact/custom identity-string grant flows.
- Added `terminal.selectOne` port for guided recipient pickers and update gate prompts.
- Added exact `grant` flow resolving:
  - known identity refs.
  - payload recipient refs.
  - identity strings through `parseIdentityString`.
- Added guided `grant` picker:
  - self visible and disabled `[you]`.
  - already-granted recipients visible and disabled `[granted]`.
  - known ungranted identities selectable.
  - custom identity string selectable.
- Added exact `revoke` flow resolving payload recipients only.
- Added guided `revoke` picker:
  - payload recipients only.
  - self visible and disabled.
- Added `update` flow rendering updated/unchanged outcomes as success.
- Added outdated payload write gate:
  - exact write commands fail with `PAYLOAD_UPDATE_REQUIRED`.
  - guided write commands can select update-now, run `updatePayload`, then resume.
  - covered guided edit and guided grant.
- Added idempotent success rendering for grant/revoke/update unchanged outcomes.
- Extended core `PayloadRecipientSummary` to expose `publicKey` and `identityUpdatedAt`, so CLI can pass exact payload-recipient public identity snapshots back to core without reconstructing incomplete identities.

TDD notes:

- RED: grant/revoke/update contracts failed as unknown commands.
- GREEN: added command dispatch and minimal flows.
- RED: guided picker assertions failed until picker choices matched spec labels/disabled states.
- GREEN: grant and revoke pickers now render disabled self/already-granted rows.
- RED: update gate/idempotent tests exposed missing guided edit gate and unchanged wording.
- GREEN: guided edit runs the same update gate and idempotent outcomes render as success.
- RED: core payload summary test drifted after adding public recipient fields.
- GREEN: updated expected core decrypted recipient shape.

Verification:

- `pnpm -F @better-age/cli test:unit` passed: 17 tests.
- `pnpm test` passed.
- `pnpm check` passed.
- `git diff --check` passed.

Notes:

- `@effect/cli` command-tree/parser integration is still pending.
- There is still no `bage` bin.
- Real prompt/editor/viewer implementations are still ports only; command behavior is contract-tested.
