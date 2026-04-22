# Better Age Release Flow PRD

## Problem Statement

`better-age` has two publishable npm packages today:

- `@better-age/cli`
- `@better-age/varlock`

The repo does not yet have a durable npm release system.

The maintainer wants a release flow that is:

- secure
- reliable
- mostly versioned in code
- simple to reason about
- compatible with a monorepo that may later include docs/apps

The current gap is not just “how do we publish to npm.” The real problem is:

- define one release authority model that supports batching multiple merged PRs
- remove manual version bumping
- remove manual changelog maintenance
- keep one shared version across all published packages
- avoid polluting `latest` while the pipeline is being proven
- keep docs/app workflows from interfering with package publishing
- keep failure modes explicit and recoverable instead of magical

Without a clear release architecture:

- npm releases will stay ad hoc
- package versions can drift from tags and changelogs
- publish security will be weaker than necessary
- contributors will not know when or how to declare semver intent
- future docs/app CD could accidentally entangle itself with package release logic

## Solution

Introduce a monorepo release system built around `changesets`, GitHub Actions, and npm trusted publishing.

The system should use two release paths:

- a stable release path for normal public versions on npm `latest`
- a lightweight prerelease path for pipeline validation and opt-in testing on npm `next`

The stable path should work like this:

1. Release-worthy PRs add a changeset.
2. Non-release PRs do not.
3. Published packages are kept in one `fixed` version group.
4. An admin manually triggers `Prepare Release`.
5. If there are no pending changesets, the workflow exits cleanly.
6. If there are pending changesets, the workflow creates or updates one canonical release PR.
7. The release PR contains:
   - shared version bumps for all published packages
   - per-package changelog updates
   - removal/consumption of the pending changesets
8. The maintainer manually merges the release PR.
9. Merge triggers the stable publish workflow from that exact merged commit.
10. The workflow publishes all public npm packages.
11. Only after all publishes succeed, the workflow creates:
   - git tag `vX.Y.Z`
   - GitHub Release entry

The prerelease path should stay intentionally smaller:

- manual trigger only
- opt-in only
- prerelease versions such as `0.3.0-next.0`
- npm dist-tag `next`
- no impact on `latest`
- mainly used to prove the real npm pipeline and support explicit prerelease installs

This system should keep docs/apps isolated by design:

- docs/apps remain `private: true`
- docs/site CD uses separate workflows
- package release logic targets only publishable packages
- docs/site changes never require changesets

## User Stories

1. As the maintainer, I want release timing to stay manual, so that I can batch merged work into one release when I choose.
2. As the maintainer, I want multiple merged PRs to be included in one release, so that I can ship coherent batches instead of one package release per merge.
3. As the maintainer, I want release PRs to be created only when I ask, so that normal development on `main` stays quiet.
4. As the maintainer, I want one canonical pending release PR, so that repeated release preparation stays idempotent and easy to reason about.
5. As the maintainer, I want repeated prepare-release runs to update the same release PR, so that I never end up with duplicate release branches or stale release candidates.
6. As the maintainer, I want release preparation to cleanly no-op when nothing is pending, so that accidental clicks do not create noise.
7. As the maintainer, I want all published packages to share one version number, so that release reasoning stays simple across the monorepo.
8. As the maintainer, I want unchanged published sibling packages to still version-align during a release, so that there is only one public version line to think about.
9. As the maintainer, I want the highest pending bump to win across a release batch, so that release-time judgment stays deterministic and automatic.
10. As the maintainer, I want release-worthy PRs to declare semver intent before release time, so that release preparation does not depend on guesswork.
11. As the maintainer, I want contributors to use an interactive helper command for changesets, so that the semver declaration flow is explicit but low-friction.
12. As the maintainer, I want non-release PRs to skip changesets, so that docs, CI, and internal-only changes do not create meaningless release metadata.
13. As the maintainer, I want per-package changelogs to update automatically, so that release notes stay correct without hand-maintained markdown edits.
14. As the maintainer, I want changelog entries to include useful GitHub context when possible, so that releases are easier to audit later.
15. As the maintainer, I want the release PR itself to be the final human checkpoint, so that the stable publish flow stays smooth after merge.
16. As the maintainer, I want stable publish to start automatically after merging the release PR, so that I do not need a second approval step for normal releases.
17. As the maintainer, I want stable tags to be created only after npm publishing succeeds, so that git never claims a stable release that npm did not actually receive.
18. As the maintainer, I want GitHub Releases to be created from successful tags, so that public release history is visible without becoming the source of truth.
19. As the maintainer, I want package versions, changelogs, tags, and GitHub Releases to all derive from the same merged release commit, so that there is no drift between release surfaces.
20. As the maintainer, I want npm publishing to use trusted publishing via GitHub OIDC, so that I do not need long-lived npm tokens in repo secrets.
21. As the maintainer, I want the workflows to run with minimal permissions, so that release automation has only the authority it actually needs.
22. As the maintainer, I want only admins to be able to trigger prepare-release and prerelease workflows, so that release mechanics cannot be churned by accident.
23. As the maintainer, I want both published packages to be public npm packages, so that OSS consumption stays simple.
24. As the maintainer, I want the initial stable system to remain on `0.x`, so that public expectations stay honest while the product and release flow mature.
25. As the maintainer, I want a lightweight `next` channel, so that I can test the real npm pipeline before fully trusting stable releases.
26. As the maintainer, I want prereleases to avoid the `latest` dist-tag, so that unstable test publishes do not affect ordinary users.
27. As the maintainer, I want prerelease installs to be opt-in with `@next`, so that users only receive unstable versions when they ask for them.
28. As the maintainer, I want prerelease versioning to use SemVer prerelease forms like `0.4.0-next.0`, so that npm behavior stays standard and unsurprising.
29. As the maintainer, I want the prerelease path to stay intentionally small, so that pipeline validation does not force a full ongoing beta program.
30. As the maintainer, I want docs and future apps in the monorepo to remain release-isolated, so that site deployment concerns do not leak into npm package publishing.
31. As a contributor, I want a clear rule for when a PR needs a changeset, so that I can follow the release policy without maintainer guesswork.
32. As a contributor, I want package behavior changes to require changesets, so that semver intent is captured near the change.
33. As a contributor, I want internal-only or docs-only work to avoid changesets, so that I am not forced to write fake release metadata.
34. As a contributor, I want the release policy to be reviewable in Git, so that semver intent and release outcomes are visible in normal PR review.
35. As a user installing the CLI, I want `npm install -g @better-age/cli` to keep pulling stable `latest` releases, so that prerelease experimentation does not affect me.
36. As a user testing unstable builds, I want `npm install -g @better-age/cli@next` to work against real published artifacts, so that I can validate prerelease behavior exactly as users would install it.
37. As the maintainer, I want partial publish failures to fail loudly instead of pretending to rollback, so that release state stays honest.
38. As the maintainer, I want recovery from partial publish failures to be explicit and documented, so that broken publish attempts do not require improvisation.
39. As the maintainer, I want release workflows to encode decision-heavy logic in testable scripts or modules rather than sprawling YAML, so that the system is maintainable and behavior can be verified outside Actions.
40. As the maintainer, I want the release system to scale to future docs/apps without redesigning the core package flow, so that the monorepo can evolve without invalidating the release model.

## Implementation Decisions

- Use `changesets` as the monorepo release authority for version bumping and changelog generation.
- Use a `fixed` version group for all publishable npm packages so they always release under one shared version.
- Keep the published package set explicit and narrow.
- Treat future docs/apps as non-publishable workspace members unless deliberately promoted later.
- Require changesets only for PRs that change published package behavior, API, runtime output, install surface, or compatibility expectations.
- Exempt docs, CI, internal-only refactors, and other non-release work from changeset requirements.
- Make `pnpm changeset` the expected contributor authoring path for release intent.
- Keep release timing manual.
- Split release automation into two user-visible flows:
  - stable release preparation and stable publish
  - lightweight prerelease publish to `next`
- Stable flow decisions:
  - release preparation is manually triggered
  - preparation creates or updates one canonical release PR
  - no-pending-changeset preparation exits successfully without opening a PR
  - release PR is manually merged
  - merge of the release PR is the final human gate
  - stable publish starts automatically from the merged release commit
  - stable npm publish happens before tag and GitHub Release creation
  - tag is created only after all package publishes succeed
  - GitHub Release is created only after tag creation succeeds
- Prerelease flow decisions:
  - prerelease is intentionally lightweight, not a full beta program
  - prerelease is manually triggered by admin
  - prerelease publishes use npm dist-tag `next`
  - prerelease versions use SemVer prerelease identifiers with `next`
  - prerelease path exists mainly to validate the real npm pipeline and support explicit opt-in testing
- Security decisions:
  - use npm trusted publishing via GitHub Actions OIDC
  - do not rely on long-lived `NPM_TOKEN` for normal publish
  - keep workflow permissions minimal
  - keep release dispatch authority admin-only
- Failure-policy decisions:
  - partial publish failure is not rolled back automatically
  - tag and GitHub Release are never created before successful npm publish
  - recovery should happen through an explicit maintainer playbook, not hidden automation
- Changelog decisions:
  - keep per-package changelogs as the durable package-facing history
  - use GitHub-aware changelog generation so package changelog entries can reference PRs and authors
  - GitHub Release is a convenience publication surface, not the canonical changelog source
- Versioning decisions:
  - shared version across all publishable packages
  - highest bump wins across pending changesets in a batched release
  - stay on `0.x` for now
  - stable and prerelease channels remain separate through both version form and npm dist-tag behavior
- Monorepo-boundary decisions:
  - publishable packages and private apps/docs must be modeled explicitly
  - docs/site CD must remain independent of npm release workflows
  - future apps/docs should not require changesets and should not affect release PR generation

### Major modules to build or deepen

- **Release Intent Policy**
  - Owns the contribution rule for when a changeset is required and how release-worthy work is classified.
  - Deep module because it turns vague human judgment into one stable contributor contract.

- **Release Preparation Orchestrator**
  - Owns manual release preparation, no-op detection, canonical release branch/PR updates, and stable preparation outputs.
  - Deep module because it hides branch/PR orchestration behind a small deterministic trigger.

- **Version and Changelog Engine**
  - Owns the shared-version package group, semver aggregation rules, and package changelog generation policy.
  - Deep module because it centralizes public release shape rather than scattering version logic across packages and workflows.

- **Stable Publish Orchestrator**
  - Owns stable npm publishing order, success gating, tag creation, and GitHub Release creation.
  - Deep module because it turns one merged release commit into one consistent public release event.

- **Prerelease Publish Orchestrator**
  - Owns lightweight `next` publication, prerelease version derivation, and prerelease-safe npm tagging.
  - Deep module because it lets the repo validate real publishing without contaminating the stable path.

- **Publishable Package Boundary**
  - Owns which workspace members are eligible for npm release and which are permanently private.
  - Deep module because it prevents future docs/apps from leaking into package release logic.

- **Registry and Auth Boundary**
  - Owns npm trusted publishing integration, access policy for scoped public packages, and workflow permission boundaries.
  - Deep module because publish security must stay explicit and separate from versioning policy.

- **Release Recovery Policy**
  - Owns operator-visible failure classification and the documented recovery path for partial publish failures.
  - Deep module because honest failure handling is part of the release contract, not an afterthought.

## Testing Decisions

- Good tests must assert external behavior and durable release contracts, not YAML incidental details.
- A good release test proves:
  - the right release is or is not created
  - the right package set is targeted
  - the right version/tag/channel is derived
  - failure leaves the right public state behind
  - docs/apps remain outside package release behavior
- Priority modules and behaviors to test:
  - release intent classification policy
  - no-pending-changeset release preparation behavior
  - canonical release PR update behavior
  - shared-version package targeting and bump aggregation
  - stable tag derivation from merged release version
  - prerelease version and `next` tag derivation
  - publishable-package filtering vs private workspace members
  - partial publish failure policy
  - “publish first, tag later” success gating
  - GitHub Release creation only after successful publish
- Release-specific edge cases that should be covered:
  - multiple pending changesets with mixed bump levels
  - package changes plus docs-only changes in same release window
  - repeated prepare-release runs before merge
  - empty prepare-release run
  - release-worthy PR accidentally missing a changeset
  - prerelease publish with no stable interference
  - package visibility/access assumptions for first public publish
  - partial publish where first package succeeds and second fails
  - prevention of tag/GitHub Release on publish failure
  - future addition of private docs/apps without expanding release targets
- Good workflow architecture should keep logic in testable scripts/modules rather than opaque YAML branching, so those units can be covered with normal repo tests.
- Prior art in this codebase:
  - domain-level behavior tests
  - CLI command tests around explicit user-facing contracts
  - app-service tests that isolate policy decisions cleanly
  - integration tests that exercise black-box boundaries
- Similar testing style should be used for release logic:
  - unit tests for release policy and version/channel derivation
  - integration-style tests for preparation and publish decision boundaries
  - minimal smoke checks at workflow level once core logic is pushed into testable modules

## Out of Scope

- A full long-term beta, canary, nightly, or multi-channel release program.
- Automatic rollback or unpublish logic after partial npm publish failure.
- Commit-message-driven or PR-title-driven semver inference.
- Releasing private npm packages.
- Non-npm registries.
- Containerized release infrastructure unless a later concrete need appears.
- Docs/app deployment design beyond the requirement that it stay isolated from package publishing.
- Multi-maintainer approval workflows beyond current admin-only dispatch constraints.
- Jumping immediately to `1.0.0`.
- Automatic stable release on every merge to `main`.
- Allowing writers/non-admins to trigger release preparation.
- A root-level combined human changelog replacing per-package changelogs.

## Further Notes

- The repo currently has publishable packages but no `.changeset` config and no GitHub Actions release workflows. This PRD describes the target state, not an incremental patch to an existing release system.
- The current codebase already favors deep, testable modules. The release system should follow that same pattern instead of hiding business logic inside long workflow YAML files.
- The prerelease `next` path is not a separate product promise. It is primarily a safe proving ground for npm publication and an opt-in unstable install surface.
- The release PR is intentionally the central artifact in the stable flow. It is where shared version bumps, per-package changelog output, and final human review meet before publication.
- This PRD is intentionally local markdown only. It is the planning artifact to review before task slicing or implementation.
