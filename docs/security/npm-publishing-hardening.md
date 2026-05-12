# npm Publishing Hardening

This checklist separates repo changes from account/provider settings. The repo
can request OIDC, but npm and GitHub settings decide whether release publishing
is actually locked down.

## Current Repo State

Already handled in code:

- `publish-release.yml` requests `id-token: write` for npm trusted publishing.
- stable and next publish through `.github/workflows/publish-release.yml`.
- stable publish now waits on GitHub environment `release-control`.
- stable publish only runs for merged same-repo `changeset-release/main` PRs.
- publish jobs do not restore dependency caches.
- release actions are pinned by commit SHA.
- published packages set `publishConfig.registry` and `publishConfig.access`.
- pnpm install policy uses a 3-day package age gate and explicit build allowlist.

Still manual:

- npm trusted publisher settings per package.
- npm token restrictions per package.
- GitHub environment protection rules.
- GitHub branch/security settings.

## P0 - Must Do

### 1. Verify or create npm trusted publishers

Where: npmjs.com.

For each package:

- `@better-age/cli`
- `@better-age/varlock`

Procedure:

1. Open `https://www.npmjs.com/package/@better-age/cli`.
2. Go to `Settings`.
3. Find `Trusted Publisher`.
4. If absent, add one:
   - Provider: `GitHub Actions`
   - Repository owner: `PaulSenon`
   - Repository name: `better-age`
   - Workflow filename: `publish-release.yml`
   - Environment: `release-control`, if npm asks for environment
5. Repeat for `@better-age/varlock`.

Expected result:

- npm package accepts publishes from this repo workflow without an npm token.
- published versions should show provenance when repo/package are public.

Why:

- OIDC credentials are short-lived and workflow-scoped.
- A leaked long-lived npm token should not be part of the release path.

### 2. Run one trusted-publishing release before disabling tokens

Where: GitHub Actions + npmjs.com.

Procedure:

1. Merge a normal changeset release PR.
2. Let `Publish Release` run.
3. Approve `release-control` when GitHub asks.
4. Confirm npm published the package successfully.
5. On npm package page, check latest version provenance badge/details.

Only continue to step 3 after this succeeds.

Why:

- npm does not fully prove trusted-publisher config until a real publish path
  uses it.

### 3. Disable token publishing on npm packages

Where: npmjs.com.

For each package:

- `@better-age/cli`
- `@better-age/varlock`

Procedure:

1. Open package page.
2. Go to `Settings`.
3. Find publishing access / 2FA settings.
4. Select `Require two-factor authentication and disallow tokens`.
5. Save.

Then:

1. Open npm account settings.
2. Open access tokens.
3. Revoke old automation/publish tokens not needed anymore.
4. Keep account 2FA enabled.

Expected result:

- Manual publish still requires your npm account 2FA.
- Classic/granular tokens cannot publish these packages.
- GitHub trusted publishing still works.

Why:

- If your laptop, dotfiles, or old CI token leaks, attacker still cannot publish.

### 4. Configure GitHub `release-control` environment

Where: GitHub repo settings.

Procedure:

1. Open `PaulSenon/better-age`.
2. Go to `Settings` -> `Environments`.
3. Open or create `release-control`.
4. Enable required reviewers:
   - reviewer: `PaulSenon`
5. Keep `Prevent self-review` disabled.
6. Set deployment branches/tags:
   - selected branches only
   - allow `main`
7. Save.

Expected result:

- `publish_next` waits for approval.
- `publish_stable` waits for approval after release PR merge.
- Approval happens before GitHub starts the job that has `id-token: write`.
- You can approve your own release because solo maintainer.

Why:

- A compromised GitHub session still needs an explicit environment approval
  moment before npm publish.
- The OIDC token used by npm trusted publishing is only minted inside the
  approved release job.

### 5. Protect `main`

Where: GitHub repo settings.

Procedure:

1. Open `Settings` -> `Rules` or `Branches`.
2. Add/edit ruleset for `main`.
3. Enable:
   - require pull request before merge
   - require status checks before merge
   - require branches up to date before merge, if not too painful
   - block force pushes
   - block deletions
4. Do not enable required code-owner review while solo maintainer.

Expected result:

- release-relevant changes land through PRs and CI.
- direct destructive branch changes are harder.

Why:

- trusted publishing trusts the GitHub repo. Protect the repo path.

## P1 - Strongly Recommended

### 6. Enable GitHub security features

Where: GitHub repo settings.

Procedure:

1. Open `Settings` -> `Code security and analysis`.
2. Enable:
   - secret scanning
   - push protection
   - Dependabot alerts
   - Dependabot security updates
3. If available, enable private vulnerability reporting.

Expected result:

- GitHub blocks obvious secret commits.
- vulnerable dependency alerts become visible.

Why:

- reduces chance of leaking npm/GitHub credentials or shipping known vulnerable
  dependencies.

### 7. Keep SHA-pinned actions updated

Where: GitHub + repo PRs.

Procedure:

1. Configure Renovate or Dependabot for GitHub Actions updates.
2. Let it open PRs updating pinned SHAs.
3. Review action changelogs before merge.

Expected result:

- workflows keep immutable action refs without becoming stale forever.

Why:

- SHA pins protect against mutable tags, but old actions can miss security fixes.

### 8. Verify package provenance after releases

Where: npmjs.com.

Procedure:

1. Open package page after release.
2. Open latest version.
3. Click provenance badge/details if present.
4. Confirm:
   - repository: `PaulSenon/better-age`
   - workflow: `publish-release.yml`
   - commit matches release commit

Optional consumer-side check:

```sh
npm audit signatures
```

Why:

- confirms users can trace published package back to this repo workflow.

### 9. Add release tarball inspection

Where: repo workflow or manual release checklist.

Procedure:

1. After build, before publish, run per published package:

```sh
npm pack --dry-run --json
```

2. Inspect output file list.
3. Expected payload:
   - `package.json`
   - `dist/**`
   - standard npm files if present, like `README.md` or `LICENSE`
4. Fail release if unexpected files appear.

Why:

- prevents accidental publication of source fixtures, local files, or secrets.

## P2 - Nice To Have

### 10. Commit signing

Where: GitHub account settings + local git.

Reality:

- Not required for npm provenance.
- OIDC/provenance proves the package came from configured GitHub workflow and
  source commit.
- Commit signing improves repo audit trail.

Procedure, simplest path:

1. GitHub -> `Settings` -> `SSH and GPG keys`.
2. Add an SSH signing key or GPG key.
3. Configure local git signing.
4. Enable GitHub vigilant mode if desired.

Use when:

- you want GitHub UI to show `Verified` commits from your machine.
- you later add external maintainers.

Do not treat this as replacement for:

- trusted publishing
- branch protection
- release environment approval

### 11. Add `SECURITY.md`

Where: repo root.

Include:

- vulnerability report contact
- supported packages
- expected response time
- do-not-disclose-publicly note

Why:

- gives users a safer reporting path for crypto/security issues.

### 12. Add a backup maintainer later

Where: GitHub repo + npm package access.

When project has real users:

1. Add trusted backup maintainer.
2. Require code-owner review for:
   - `.github/workflows/**`
   - `tools/release/**`
   - package manifests
3. Enable prevent self-review on `release-control`.

Why:

- reduces single-account compromise risk.
