# @better-age/varlock

Install the plugin: `npm add @better-age/varlock`

Add the following in your `.env.schema`

```env
# @plugin(@better-age/varlock)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)
```

Then if you already had configured both varlock in your project, and better-age on you machine, it will just prompt for your passphrase when needing to access `.env.enc`

## Contract

Thin varlock adapter for `better-age`.

Design constraints:
- plugin stays thin
- CLI stays source of truth
- plugin shells out to `bage load --protocol-version=1 <path>`
- one varlock process caches one load result in memory

For product context:
- [../../README.md](../../README.md)
- [../../VISION.md](../../VISION.md)

Plugin API:
- `@initBetterAge(path=...)`
- `betterAgeLoad()`

Optional override:
- `@initBetterAge(path=..., command=...)`

What `command=` means:
- launcher prefix only
- plugin still appends `load --protocol-version=1 <path>`

Default launcher:
- `bage`

Export:
- `./plugin` -> `./dist/plugin.cjs`

Local build artifact:
- `packages/varlock/dist/plugin.cjs`

## Minimal usage

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)
```

## Custom launcher examples

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc, command="pnpm exec bage")
# @setValuesBulk(betterAgeLoad(), format=env)
```

## Runtime behavior

- stdout from `bage load` becomes env text for varlock
- stderr stays attached to the invoking shell
- plugin errors if the launcher cannot start
- plugin errors if `bage load` exits non-zero
- v0 supports one `initBetterAge` config per process

## Development

```sh
pnpm -F @better-age/varlock build
pnpm -F @better-age/varlock check
pnpm -F @better-age/varlock test
```

More context:
- [../../.llms/projects/3-varlock-plugin/1-VARLOCK_PRD.md](../../.llms/projects/3-varlock-plugin/1-VARLOCK_PRD.md)
