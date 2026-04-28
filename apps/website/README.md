# better-age website

Docs website for <https://bage.paulsenon.com/docs>.

Built with TanStack Start and Fumadocs.

## Content

- [content/docs/install.mdx](content/docs/install.mdx): install paths
- [content/docs/quickstart.mdx](content/docs/quickstart.mdx): first useful flow
- [content/docs/guides](content/docs/guides): task guides
- [content/docs/reference](content/docs/reference): CLI and plugin reference
- [public/og.e509b0a6dd75.jpg](public/og.e509b0a6dd75.jpg): Open Graph image reused by the root README

## Local Work

From repo root:

```sh
pnpm -F @apps/website dev
pnpm -F @apps/website lint
pnpm -F @apps/website types:check
```

## Deploy

Deployment infra lives in [infra/website](../../infra/website/README.md).
