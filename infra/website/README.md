# website infra

Alchemy project that deploys [apps/website](../../apps/website/README.md) to
Cloudflare.

It owns deployment only. Website content, routes, and UI live in
`apps/website`.

## Commands

Run the Alchemy dev loop:

```sh
pnpm -F @infra/website dev
```

Deploy staging:

```sh
pnpm -F @infra/website deploy:staging
```

Staging uses a generated worker URL printed by Alchemy.

Destroy staging:

```sh
pnpm -F @infra/website destroy:staging
```

Deploy production:

```sh
pnpm -F @infra/website deploy:prod
```

Production serves the real docs domain:

```txt
https://bage.paulsenon.com
```

## Shape

- Infra entrypoint: [alchemy.run.ts](alchemy.run.ts)
- App cwd: `apps/website`
- Build command: `pnpm build`
- Dev command: `pnpm dev`
- Static assets: `.output/public`
- SPA routing: enabled
- Resource adoption: enabled
- Production domain: `bage.paulsenon.com`
- Non-prod stages: worker URL only

## Safety

- Use staging before production.
- `destroy:staging` is expected cleanup.
- `destroy:prod` exists in `package.json`, but production destroy should be a
  deliberate infra operation, not routine docs work.
