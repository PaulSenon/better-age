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
