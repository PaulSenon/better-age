# @better-age/varlock

Varlock plugin package for `better-age`.

Current status:
- package scaffold exists
- plugin entrypoint exists
- minimal v0 runtime exists

Current minimal runtime contract:
- plugin stays a thin adapter
- `better-age` CLI stays source of truth
- plugin invokes `bage load --protocol-version=1 <path>`
- plugin supports:
  - `@initBetterAge(path=...)`
  - `betterAgeLoad()`
- `@initBetterAge(path=..., command=...)` may override the launcher prefix
- plugin caches one load result in memory for one varlock process
- Unix/WSL only in v0

Expected package export:
- `./plugin` -> `./dist/plugin.cjs`

Local-file dev target:
- `packages/varlock/dist/plugin.cjs`

Minimal schema shape:

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)
```

Custom launcher examples:

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc, command="pnpm exec bage")
# @setValuesBulk(betterAgeLoad(), format=env)
```

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc, command="npm exec --package @better-age/cli -- bage")
# @setValuesBulk(betterAgeLoad(), format=env)
```

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc, command="npx @better-age/cli")
# @setValuesBulk(betterAgeLoad(), format=env)
```

`command=` is launcher prefix only. The plugin still appends:
- `load`
- `--protocol-version=1`
- explicit payload path

If `command=` is omitted, launcher defaults to `bage`.
