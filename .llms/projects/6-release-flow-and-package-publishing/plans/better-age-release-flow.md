# Plan: Better Age Release Flow

> Source PRD: [1-BETTER_AGE_RELEASE_FLOW_PRD.md](../1-BETTER_AGE_RELEASE_FLOW_PRD.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Published packages**: only `@better-age/cli` and `@better-age/varlock` are publishable npm packages in the current monorepo.
- **Versioning model**: publishable packages stay in one shared `changesets` `fixed` version group.
- **Stable release authority**: stable release remains manual and PR-centered. An admin triggers release preparation, one canonical release PR is created or updated, and merging that PR is the final human gate.
- **Stable publish source of truth**: stable publish runs from the merged release PR commit. Package versions, package changelogs, git tag, and GitHub Release all derive from that exact commit.
- **Stable publish ordering**: publish packages first; only then create tag and GitHub Release.
- **Failure policy**: partial publish failures fail hard. No automatic rollback or unpublish logic.
- **Prerelease policy**: keep a lightweight opt-in prerelease path using npm dist-tag `next` and SemVer prerelease identifiers. Do not build a full beta/canary/nightly program now.
- **Security/auth**: use npm trusted publishing via GitHub Actions OIDC, with minimal workflow permissions and admin-only release dispatch.
- **Contributor contract**: release-worthy PRs must include a changeset; docs/CI/internal-only work must not require one.
- **Monorepo boundary**: future docs/apps stay `private: true`, use separate workflows, and never participate in package release preparation unless explicitly promoted later.
- **Testing strategy**: keep release decisions in testable scripts/modules where practical instead of burying all logic in workflow YAML.

---

## Phase 1: Release Foundations

**User stories**: 7, 10, 11, 12, 20, 21, 22, 23, 30, 31, 32, 33, 34, 39, 40

### What to build

Introduce the monorepo release foundation:

- add `changesets` to the repo
- define the shared-version package group for publishable packages
- establish the publishable-package boundary
- document contributor expectations for when a changeset is required
- set up any small testable release-policy modules needed to avoid hiding all behavior in YAML

This slice should make release intent explicit in the codebase before any GitHub publish automation exists.

### Acceptance criteria

- [ ] The repo has a working `changesets` configuration with `@better-age/cli` and `@better-age/varlock` in one shared `fixed` version group.
- [ ] The repo clearly distinguishes publishable packages from non-publishable future apps/docs.
- [ ] Contributors have a documented happy path for `pnpm changeset`.
- [ ] The documented rule for “changeset required vs not required” is explicit and reviewable in repo docs/templates.
- [ ] Any release-policy logic that would otherwise become opaque workflow branching is extracted into testable repo-owned logic where practical.

---

## Phase 2: Stable Release Pipeline

**User stories**: 1, 2, 3, 4, 5, 6, 9, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 37, 38

### What to build

Build the stable release path end-to-end:

- admin-triggered release preparation
- clean no-op when nothing is pending
- one canonical release PR that updates in place
- shared version bumps and per-package changelog generation
- stable publish triggered by merging the release PR
- stable npm publish before tag and GitHub Release creation
- fail-hard behavior when publish does not complete fully

This slice should make one full stable release path demoable from pending changesets to successful npm publication and public release metadata.

### Acceptance criteria

- [ ] An admin can manually trigger stable release preparation.
- [ ] If no pending changesets exist, release preparation exits successfully without opening a PR.
- [ ] If pending changesets exist, one canonical release PR is created or updated instead of spawning duplicates.
- [ ] The release PR contains shared version bumps for both publishable packages and per-package changelog updates.
- [ ] Merging the release PR triggers stable publish from that merged commit.
- [ ] Stable publish publishes packages before creating the git tag and GitHub Release.
- [ ] If package publish fails partway through, the workflow fails loudly and does not create the tag or GitHub Release.

---

## Phase 3: `next` Prerelease Pipeline

**User stories**: 25, 26, 27, 28, 29, 35, 36

### What to build

Add the lightweight prerelease/test-release path:

- admin-triggered prerelease publish
- prerelease version derivation using `next`
- npm publish to dist-tag `next`
- explicit separation from stable `latest`

This slice should allow real registry/OIDC/publish validation without polluting the stable user install path.

### Acceptance criteria

- [ ] An admin can manually trigger a prerelease publish path without going through the stable release PR flow.
- [ ] Prerelease versions use a SemVer prerelease form with `next`.
- [ ] Prerelease publishes land on npm with dist-tag `next`, not `latest`.
- [ ] Stable users installing without a tag continue to receive only stable `latest` versions.
- [ ] The prerelease path does not alter or bypass the stable release flow.

---

## Phase 4: Operator Docs, External Setup, And Recovery

**User stories**: 20, 21, 22, 23, 30, 37, 38, 39, 40

### What to build

Document the whole operator model in repo markdown, including:

- one-time GitHub and npm setup
- npm trusted publishing/OIDC setup
- branch protection and permissions expectations
- first-publish notes for scoped public packages
- exact stable release process
- exact prerelease/test-release process
- expected workflow behavior
- failure and recovery playbook

This slice should make the release system operable by reading repo docs alone, including the first-time setup and the unhappy path.

### Acceptance criteria

- [ ] The repo contains an operator-facing release document describing one-time npm and GitHub setup outside the codebase.
- [ ] The release document explains the contributor flow from adding a changeset to merging the release PR.
- [ ] The release document explains the prerelease/test-release path and how it differs from stable.
- [ ] The release document explains expected stable publish behavior, including version/changelog/tag/GitHub Release ordering.
- [ ] The release document explains partial publish failure handling and the intended recovery path.
- [ ] The release document explains how docs/apps remain isolated from package release behavior.
