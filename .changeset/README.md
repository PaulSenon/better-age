# Changesets

This folder holds release intent for publishable package PRs.

Use:

```sh
pnpm changeset
```

Add a changeset when a PR changes released behavior for:
- `@better-age/cli`
- `@better-age/varlock`

Do not add a changeset for docs, CI, repo maintenance, or other non-release work.

Stable release preparation will consume pending changesets and convert them into:
- shared package version bumps
- per-package changelog entries

Prerelease/test publishes use the separate `next` channel.
