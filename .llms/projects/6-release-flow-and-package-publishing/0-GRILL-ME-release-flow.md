# Release Flow Grilling Log

## Context

- Topic: npm release flow for `@better-age/cli` and `@better-age/varlock`
- Goal: secure, reliable, mostly versioned release system before implementation planning
- Constraints stated by user:
  - one shared version for all published packages
  - manual action to trigger a release
  - one release can include multiple merged PRs
  - no manual bumping
  - no manual changelog maintenance

## Turn 1

### Agent

Asked which release authority model should own stable releases:

- `A` merge to `main` auto publishes
- `B` merge to `main` updates a release PR which is merged to publish
- `C` human manually triggers publish workflow

Recommended `B` as default best balance, while noting `C` can be useful if the publish step stays manually gated.

### User

User prefers a manual trigger and clarified desired flow:

- manual action to trigger a release
- handle multiple merged PRs in one release
- no manual bump
- no manual changelog

User is currently torn between:

- pure `C`, which feels awkward if it still needs a generated release PR and later merge
- `B`, if the PR can aggregate multiple merges and stay current automatically

## Current Lean

- likely shape: manual trigger creates or refreshes a release PR; merging that PR publishes
- unresolved: whether the release PR should exist continuously or only when manually requested

## Turn 2

### Agent

Asked whether the release PR should:

- always exist and auto-refresh after merges, or
- be created/updated only when manually requested

Recommended on-demand release PR creation to match manual release cadence and reduce noise.

### User

User chose:

- release PR created/updated only on demand

User also asked how to achieve:

- automatic semver bumping
- per-package changelog generation
- shared version for all published packages
- minimum manual process

### Agent

Recommended `changesets` in `fixed` mode:

- per-PR changeset files capture semver intent
- manual release trigger creates/updates release PR
- release PR bumps versions and changelogs automatically
- merge of release PR leads to publish

Warned against using conventional commits as the main semver source.

## Turn 3

### Agent

Asked whether every release-worthy PR should be required to include a changeset file.

Recommended yes.

### User

User chose:

- yes, require changeset files on every release-worthy PR

User added future context:

- monorepo may later contain doc sites
- doc site CI/CD must not interfere with package publishing or changeset flow

## Current Lean

- stable release flow:
  - contributor adds changeset in release-worthy PR
  - maintainer manually triggers prepare-release workflow
  - bot creates/updates release PR
  - merge release PR
  - publish workflow releases packages and creates tag
- versioning tool: `changesets` in `fixed` mode
- contribution rule: release-worthy package PRs must include a changeset
- future app/docs packages should stay isolated from package publish flow, likely via `private: true`, path filters, and changesets ignore/private package config

## Turn 4

### Agent

Asked how the final version should be resolved when one release batches multiple PRs:

- highest bump wins, or
- manual override at release time

Recommended highest-bump-wins.

### User

User chose:

- highest bump wins

## Turn 5

### Agent

Asked what to do for PRs that do not affect released package behavior:

- no changeset required, or
- every PR must still include one

Recommended no changeset for non-release work.

### User

User chose:

- no changeset required for non-release work

## Current Lean

- release-worthy PRs require changesets
- docs/infra/internal-only PRs do not require changesets
- batched release version resolution uses highest bump across pending changesets

## Turn 6

### Agent

Asked when the stable git tag should be created:

- after release PR merge during publish, or
- earlier when the release PR is created

Recommended creating the tag only during publish from the merged release commit.

### User

User chose:

- create the stable tag during publish from the merged release PR commit

## Turn 7

### Agent

Asked whether stable publish should require an extra manual approval in GitHub Actions after the release PR is merged:

- yes, extra environment approval
- no, merging the release PR should publish immediately

Recommended no extra approval for the current solo-maintainer setup.

### User

User chose:

- no extra approval for now

User also asked whether GitHub could make the approval path extremely smooth, for example from phone or GitHub UI.

### Agent

Clarified, based on official GitHub environments docs, that manual approval is done through the workflow run / deployment review UI. It is workable from GitHub web/notifications, but still remains an extra manual review step rather than something materially smoother than simply merging the release PR.

## Current Lean

- release PR merge is the final human gate
- publish runs automatically after release PR merge
- git tag is created by publish workflow from that exact merged commit

## Turn 8

### Agent

Asked how contributors should author changesets:

- hand-write the markdown file manually
- or use a helper command to scaffold and then edit summary

Recommended using the helper command.

### User

User chose:

- use a helper command such as `pnpm changeset`

## Turn 9

### Agent

Asked how repeated `Prepare Release` runs should behave before the release PR is merged:

- update the same release PR in place
- or create a fresh release PR every time

Recommended updating the same release PR in place.

### User

User chose:

- update the same release PR in place

## Turn 10

### Agent

Asked what should happen when `Prepare Release` is triggered with no pending changesets:

- no-op cleanly
- or force some kind of empty release

Recommended a clean no-op.

### User

User chose:

- no-op cleanly when nothing is pending

## Turn 11

### Agent

Asked whether publish should also create a GitHub Release entry after npm publish and tag creation:

- yes, create GitHub Release
- or no, only npm publish + git tag

Recommended yes.

### User

User chose:

- yes, create a GitHub Release entry from the tag

## Current Lean

- changeset authoring UX uses helper command scaffolding
- release prep is idempotent and updates one canonical release PR
- empty prepare-release runs are clean no-ops
- stable publish also creates a GitHub Release entry

## Turn 12

### Agent

Asked whether both packages should be public npm packages or whether any should remain private/restricted.

Recommended both public, based on current package intent.

### User

User chose:

- both packages are public npm packages

## Turn 13

### Agent

Asked what to do on partial publish failure.

Recommended:

- fail hard
- avoid fake rollback logic
- recover with an explicit rerun/manual recovery playbook

### User

User chose:

- fail hard and recover explicitly

## Turn 14

### Agent

Asked whether tag/GitHub Release should happen before or after npm publish.

Recommended:

- publish all packages first
- only then create tag and GitHub Release

### User

User chose:

- publish packages first, then create tag and GitHub Release

User also requested that future questions should only be asked when the answer is not already strongly implied by the recommendation.

## Current Lean

- both publishable packages are public npm packages
- partial publish failures fail hard and require explicit recovery
- tag + GitHub Release are created only after all npm publishes succeed

## Turn 15

### Agent

Asked whether to design prerelease channels now or keep the first iteration stable-only.

Recommended stable-only first.

### User

User chose:

- stable-only first

## Turn 16

### Agent

Checked whether publishable packages currently depend on each other, because that would affect internal dependency version rewriting.

Result:

- no internal published-package dependency was found

Then asked whether the release PR should be manually merged or auto-merged once checks pass.

Recommended manual merge to preserve explicit release timing.

### User

User chose:

- release PR is merged manually

## Current Lean

- first version of the system is stable-only
- no internal published-package dependency handling is needed right now
- release PR remains a manually merged final checkpoint

## Turn 17

### Agent

Asked whether the formal release process should start under `0.x` or jump to `1.0.0`.

### User

User chose:

- stay on `0.x` for now

## Turn 18

### Agent

Asked who should be allowed to trigger the manual `Prepare Release` workflow.

Recommended admins only for the current solo-maintainer setup.

### User

User chose:

- admin only

## Current Lean

- release system starts under `0.x`
- only admins can trigger prepare-release
- enough release-model decisions have been made to move from grilling into planning

## Turn 19

### User

User raised a new concern:

- before the package flow is trusted, they want to test real npm publication
- they asked whether this means a beta/prerelease channel should exist now, versus allowing a few early "garbage" versions on npm

### Agent

Verified npm docs around:

- dist-tags
- prerelease version behavior
- deprecate vs unpublish
- unpublish limitations

Recommended:

- do not pollute `latest` with test releases
- do not build a full long-term beta program yet
- add one lightweight prerelease/test publish path using a non-`latest` dist-tag
- use prerelease versions for those test publishes

### User

User accepted:

- add a test-tag prerelease path

## Current Lean

- stable release flow remains unchanged
- add a lightweight prerelease/test publish path so npm pipeline can be validated without touching `latest`
