# @better-age/varlock

Thin varlock adapter for Better Age.

User docs:

- [Install](https://bage.paulsenon.com/docs/install)
- [Quickstart](https://bage.paulsenon.com/docs/quickstart)
- [Varlock plugin reference](https://bage.paulsenon.com/docs/reference/varlock-plugin)

## Install

Install the Better Age CLI globally:

```sh
npm install -g @better-age/cli
```

Install Varlock and the plugin in the project that owns the `.env.schema` file:

```sh
npm install -D varlock @better-age/varlock
```

The default plugin config expects the `bage` command from `@better-age/cli` to be
available on `PATH`.

## Happy Path

Set up your local Better Age identity:

```sh
bage setup --name Alice
```

Create and edit the encrypted payload:

```sh
bage create .env.enc
bage edit .env.enc
```

Add this to `.env.schema`:

```txt
# @plugin(@better-age/varlock)
# @initBetterAge(path=.env.enc)
# @setValuesBulk(betterAgeLoad(), format=env)
```

Run your app through Varlock:

```sh
varlock run -- npm run dev
```

Varlock starts, Better Age asks for your passphrase, and your process receives
the decrypted env values.

Design constraints:

- plugin stays thin
- CLI stays source of truth
- plugin shells out to `bage load --protocol-version=1 <path>`
- one varlock process caches one successful load result in memory
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

For MVP, `command=` is trusted local configuration. If it contains spaces the
runtime invokes it through the shell so launcher prefixes like `pnpm exec bage`
work; do not feed untrusted input into this field.

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
- failed loads are not cached; a later call can retry.
- successful loads are cached in memory for the current process only.
- v0 supports one `initBetterAge` config per process.

## Development

```sh
pnpm -F @better-age/varlock build
pnpm -F @better-age/varlock check
pnpm -F @better-age/varlock test
```
