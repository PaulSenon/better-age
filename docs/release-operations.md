# Release Operations

Operator runbook for package releases.

Use this with:
- [README.md](../README.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [.changeset/config.json](../.changeset/config.json)
- [tools/release/release-config.mjs](../tools/release/release-config.mjs)

## Scope

Published npm packages today:
- `@better-age/cli`
- `@better-age/varlock`

Everything else in the monorepo is release-isolated:
- root package stays `private: true`
- docs/apps must stay `private: true`
- docs/app changes do not need changesets
- docs/app changes must not enter package publish logic unless explicitly promoted later

## Repo-owned release files

- release prep: [.github/workflows/prepare-release.yml](../.github/workflows/prepare-release.yml)
- stable + `next` publish: [.github/workflows/publish-release.yml](../.github/workflows/publish-release.yml)
- release boundary: [tools/release/release-config.mjs](../tools/release/release-config.mjs)
- version/tag reader: [tools/release/read-release-version.mjs](../tools/release/read-release-version.mjs)
- prerelease version derivation: [tools/release/derive-prerelease-version.mjs](../tools/release/derive-prerelease-version.mjs)
- publish script: [tools/release/publish-packages.mjs](../tools/release/publish-packages.mjs)
- changesets config: [.changeset/config.json](../.changeset/config.json)

Important constraint:
- npm trusted publishing currently allows one trusted publisher config per package
- because of that, stable publish and prerelease publish must share one workflow file: `publish-release.yml`

## One-time GitHub setup

### 1. Enable Actions PR creation

`Prepare Release` uses `GITHUB_TOKEN` to create or update the canonical release PR.

In GitHub repo settings:
- `Settings -> Actions -> General`
- under `Workflow permissions`, allow workflows to create and approve pull requests

Official docs:
- GitHub Actions settings: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository>

### 2. Protect `main`

Expected baseline branch protection for `main`:
- require pull request before merging
- require at least one review
- require conversation resolution
- do not allow bypassing protection rules
- restrict direct pushes to trusted maintainers only
- if repo CI checks exist, make them required before merge

Official docs:
- protected branches: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

### 3. Create release-control environment

Create GitHub environment:
- name: `release-control`

Use it to gate manual release operations:
- `Prepare Release`
- manual `next` publishes in `Publish Release`

Recommended environment settings:
- required reviewers: admins or a dedicated release-maintainers team
- prevent self-review: enabled
- optional branch restriction: `main`

This keeps manual release entrypoints admin/maintainer-gated without adding a second approval gate to stable publish after merging the release PR.

Official docs:
- environments: <https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments>

## One-time npm setup

### 1. Reserve and bootstrap each package

npm trusted publisher config can only be attached to an existing package.

That means first publish is a one-time bootstrap step done outside GitHub Actions.

Packages to bootstrap:
- `@better-age/cli`
- `@better-age/varlock`

First-publish notes:
- scoped packages default to private/restricted on first publish
- first public publish must use `--access public`
- repo automation already does this in [tools/release/publish-packages.mjs](../tools/release/publish-packages.mjs)
- you must own the scope or have org publish permission before bootstrapping

Recommended bootstrap order:
1. Confirm package names/scope ownership on npm.
2. Do one manual initial publish for each package from a local trusted maintainer machine.
3. Confirm each package page exists on npm.
4. Then configure trusted publishing for future automated releases.

Official docs:
- scoped public packages: <https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/>
- npm trust prerequisites: <https://docs.npmjs.com/cli/v11/commands/npm-trust/>

### 2. Configure trusted publisher for each package

For each published package, configure npm trusted publishing:
- provider: GitHub Actions
- repository: `PaulSenon/better-age`
- workflow filename: `publish-release.yml`
- environment: leave blank

Why one file:
- npm registry currently supports one trusted publisher config per package
- this repo therefore uses one publish workflow file for both stable and `next`

Trusted publishing requirements to preserve:
- GitHub-hosted runners
- workflow has `id-token: write`
- package `repository.url` points at this GitHub repository

Official docs:
- trusted publishers: <https://docs.npmjs.com/trusted-publishers/>
- GitHub package publishing: <https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages>

### 3. Tighten npm package settings after trust is proven

After trusted publishing succeeds for both packages:
- package settings -> `Publishing access`
- choose `Require two-factor authentication and disallow tokens`
- revoke old automation publish tokens if any exist

Trusted publishing still works after disallowing classic tokens.

Official docs:
- trusted publisher hardening: <https://docs.npmjs.com/trusted-publishers/>
- requiring 2FA: <https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification>

## Contributor flow

Release-worthy PRs must add a changeset:

```sh
pnpm changeset
```

Add a changeset when a PR changes released behavior for:
- `@better-age/cli`
- `@better-age/varlock`

Do not add a changeset for:
- docs-only work
- CI/repo maintenance
- internal refactors with no released behavior change
- private docs/app work

Canonical contributor policy lives in:
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [.changeset/README.md](../.changeset/README.md)

## Stable release process

### What stable does

Stable release path is PR-centered:
1. feature PRs merge to `main` with pending changesets
2. maintainer manually runs `Prepare Release`
3. workflow creates or updates one canonical release PR
4. release PR contains shared version bumps + package changelog updates
5. maintainer reviews and merges that release PR
6. merged release PR triggers stable publish from that exact merge commit
7. packages publish to npm `latest`
8. only after publish succeeds, workflow creates git tag
9. only after tag succeeds, workflow creates GitHub Release

### How to run it

1. Merge release-worthy PRs into `main`.
2. Run GitHub workflow `Prepare Release` from `main`.
3. If it no-ops, stop. There is nothing pending.
4. If it opens or updates `chore(release): version packages`, review:
   - version bumps
   - generated changelog entries
   - package set
5. Merge that release PR into `main`.
6. Watch `Publish Release` stable job complete.

### Expected stable behavior

- stable source of truth is the merged release PR commit
- both packages stay on one shared version line
- publish happens before tag and GitHub Release
- stable publish uses npm dist-tag `latest`
- changelog output comes from changesets
- tag format is `vX.Y.Z`
- GitHub Release is convenience metadata, not changelog source of truth

## `next` prerelease process

### What `next` does

`next` is lightweight validation and opt-in testing only.

It does:
- manual trigger only
- derive prerelease version from current shared package version
- publish both packages to dist-tag `next`

It does not:
- create a release PR
- consume changesets
- create a git tag
- create a GitHub Release
- affect stable `latest`

### How to run it

1. Open GitHub Actions `Publish Release`.
2. Use `Run workflow`.
3. Select branch `main`.
4. Select channel `next`.
5. Start the run.
6. Approve the `release-control` environment if prompted.

### Expected `next` behavior

- version shape is `X.Y.Z-next.<run>.<attempt>`
- version bump is runner-local only; repo files are not committed back
- publish target is npm dist-tag `next`
- stable users still get `latest`

## Failure and recovery

No automatic rollback exists.

Never create stable tags or GitHub Releases before npm publish fully succeeds.

### Prepare Release failed

Examples:
- dependency install issue
- GitHub permission issue
- release PR creation/update failure

Recovery:
1. Fix the repo or permission issue.
2. Re-run `Prepare Release`.
3. Expect the same canonical release PR to update in place.

### Stable publish failed before any package published

Examples:
- install/build failure
- npm auth/OIDC failure before first successful `npm publish`

Recovery:
1. Fix the root cause.
2. Re-run the failed `Publish Release` workflow run for the same merged release commit.
3. Do not merge a second release PR unless the release commit itself must change.

### Stable publish partially succeeded

This is the main bad path.

Example:
- first package published
- second package failed
- workflow stopped before tag/GitHub Release

Recovery:
1. Do not create the git tag.
2. Do not create the GitHub Release.
3. Do not try to republish the already-published version.
4. Fix the root cause.
5. Ship a new release version through the normal changeset -> release PR flow.
6. Consider deprecating the broken partial version on npm if user impact warrants it.

Reason:
- npm versions are immutable
- once a package version exists, it cannot be reused

Official docs:
- npm unpublish/deprecate policy: <https://docs.npmjs.com/policies/unpublish>

### Stable npm publish fully succeeded, but tag or GitHub Release failed

State:
- packages already published
- missing git tag and/or missing GitHub Release metadata

Recovery:
1. Do not re-run the full publish job blindly.
2. Create the missing tag from the merged release PR commit for the already-published version.
3. Create the missing GitHub Release from that same tag.
4. Keep repo metadata aligned with the already-published npm version.

### `next` publish failed

Recovery path is simpler:
- fix the issue
- run `Publish Release` again with channel `next`

Because prerelease version includes run number + attempt, reruns produce a fresh prerelease version instead of colliding with the failed publish version.

## Operator checklist

Before first automated release:
- GitHub Actions can create PRs
- `main` branch protection is configured
- `release-control` environment exists
- both npm packages exist already
- both npm packages trust `publish-release.yml`
- old automation tokens are removed after trust works

Before each stable release:
- release-worthy PRs landed with changesets
- `Prepare Release` run from `main`
- release PR reviewed before merge

Before each `next` publish:
- run from `main`
- use channel `next`
- remember it does not update changelogs, tags, or GitHub Releases
