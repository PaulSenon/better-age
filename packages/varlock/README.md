# @better-age/varlock

Thin varlock adapter for Better Age.

Design constraints:

- plugin stays thin
- CLI stays source of truth
- plugin shells out to `bage load --protocol-version=1 <path>`
- one varlock process caches one load result in memory
- plugin never receives, stores, or forwards passphrases

## Contract

Plugin API:

- `@initBetterAge(path=...)`
- `betterAgeLoad()`

Optional override:

- `@initBetterAge(path=..., command=...)`

Export:

- `./plugin` -> `./dist/plugin.cjs`

Local build artifact:

- `packages/varlock/dist/plugin.cjs`

## Bage Launcher Assumption

Default launcher:

```txt
bage
```

The default runtime expects `bage` to be available on `PATH`. The plugin appends
the load protocol arguments itself:

```txt
bage load --protocol-version=1 <path>
```

Stdio contract:

- stdin is inherited, so `bage` can prompt for the passphrase in the invoking
  terminal.
- stdout is piped, so raw env text becomes varlock input.
- stderr is inherited, so prompts, warnings, and errors remain visible to the
  user.

## Custom Launcher

`command=` is a launcher prefix only. The plugin still appends
`load --protocol-version=1 <path>`.

Example:

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc, command="pnpm exec bage")
# @setValuesBulk(betterAgeLoad(), format=env)
```

This runs:

```txt
pnpm exec bage 'load' '--protocol-version=1' '.env.enc'
```

## Minimal Usage

```env
# @plugin(./packages/varlock/dist/plugin.cjs)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)
```

## Runtime Behavior

- stdout from `bage load` becomes env text for varlock.
- stderr stays attached to the invoking shell.
- plugin errors if the launcher cannot start.
- plugin errors if `bage load` exits non-zero.
- v0 supports one `initBetterAge` config per process.

## Development

```sh
pnpm -F @better-age/varlock build
pnpm -F @better-age/varlock check
pnpm -F @better-age/varlock test
```

Manual QA:

- [../../docs/manual-qa.md](../../docs/manual-qa.md)
