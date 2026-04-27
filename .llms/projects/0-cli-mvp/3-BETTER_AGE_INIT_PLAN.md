# Better Secrets Init Plan

## Goal

Initialize a new monorepo package for an env-only secret CLI with:

- pure TypeScript first
- no system deps
- npm / `npx` runnable
- strong layering
- Effect-first architecture
- reproducible automated tests
- one minimal vertical slice end-to-end

This doc is only for project bootstrap and first slice. Not full product architecture.

## Scope Of First Slice

Ship only one coherent capability:

- generate a new user identity pair
- protect private key with passphrase
- store it in standard home path
- persist local metadata with alias + active key
- expose one CLI command to do it
- verify it with:
  - meaningful unit test
  - meaningful integration test
  - one built bundled CLI artifact

Do not build yet:

- payload encryption
- share/revoke
- retired-key migration
- varlock plugin
- file locking
- editor flow
- recipient metadata

## Recommended Stack

### Runtime / Architecture

- `effect`
- `@effect/cli`
- `@effect/platform`
- `@effect/platform-node`

Reason:

- matches your desired DDD + service/port style
- good dependency injection story
- strong testability via layers
- official CLI support exists

Sources:

- `@effect/cli`: https://effect-ts.github.io/effect/docs/cli
- `@effect/platform-node`: https://www.mintlify.com/effect-TS/effect-smol/packages/platform-node

### Crypto

- `age-encryption` / Typage

Reason:

- official TS age implementation
- Node/browser/Deno/Bun
- no external system binary required
- supports hybrid PQ identity generation

Source:

- https://github.com/FiloSottile/typage

### Testing

- `vitest`
- `@effect/vitest`

Reason:

- good TS ergonomics
- official Effect integration exists
- strong mock/stub support
- standard for Node/Vite ecosystem

Sources:

- Vitest: https://vitest.dev/
- `@effect/vitest`: https://effect-ts.github.io/effect/docs/vitest

### Prompting

Use 2 layers:

1. command parsing:
- `@effect/cli`

2. interactive terminal client:
- start with custom `TerminalClient` port + Node TTY handling for passphrase input
- optionally use `@inquirer/prompts` later for non-sensitive prompts like alias/confirm/editor

Reason:

- security-sensitive passphrase input should be under your control
- avoid binding whole app to one prompt library
- still allow richer menus later

Sources:

- Node TTY: https://nodejs.org/api/tty.html
- Inquirer prompts/password/editor: https://github.com/SBoudrias/Inquirer.js

### Bundling

- `esbuild`

Reason:

- official Node bundling support
- single bundled JS file is easy
- already present in repo tooling ecosystem
- enough for `node dist/cli.cjs`

Source:

- https://esbuild.github.io/api/

## Strong Recommendation On Project Shape

Do **not** split into many workspace packages yet.

Bad v0:

- `core`
- `crypto`
- `cli`
- `fs`
- `adapters`
- `shared`

Too much.

Use **one package** first:

- `packages/cli`

Inside it, keep strong internal layering.

Extract packages only when real pressure appears.

## Package Layout

Create:

```text
packages/cli/
  package.json
  tsconfig.json
  vitest.config.ts
  esbuild.config.mjs
  README.md
  src/
    cli/
      main.ts
      command/
        setupUserKey.ts
    app/
      usecase/
        createUserIdentity.ts
    domain/
      identity/
        Identity.ts
        IdentityAlias.ts
        IdentityFingerprint.ts
        IdentityKind.ts
      home/
        HomeState.ts
      error/
        BetterAgeError.ts
    port/
      Clock.ts
      Crypto.ts
      HomeRepository.ts
      Prompt.ts
      Random.ts
      Terminal.ts
    infra/
      crypto/
        typageCrypto.ts
      fs/
        nodeHomeRepository.ts
        pathResolver.ts
      prompt/
        nodePrompt.ts
      random/
        nodeRandom.ts
      clock/
        nodeClock.ts
    program/
      layer.ts
      runtime.ts
    shared/
      result.ts
      schema.ts
  test/
    unit/
      createUserIdentity.test.ts
    integration/
      setupUserKey.cli.test.ts
    fixture/
      home.ts
      prompt.ts
      tmp.ts
```

## Layer Rules

### Domain

Contains:

- pure types
- pure invariants
- no fs
- no tty
- no Effect runtime wiring
- no Typage imports

Examples:

- alias validation
- home-state shape
- identity-kind enum: `user | machine`

### App / Use Cases

Contains orchestration logic.

Example use case:

- `createUserIdentity`

Inputs:

- alias
- passphrase
- home dir
- identity kind
- maybe `force` later

Depends only on ports:

- `Crypto`
- `HomeRepository`
- `Prompt` only if the use case itself owns interaction

Recommendation:

- keep interaction outside use case when possible
- prefer use case input already validated

### Ports

Declare interfaces/services only.

First slice ports:

- `Crypto`
  - `generateUserIdentity(passphrase, mode)`
  - returns private payload + public recipient + fingerprint
- `HomeRepository`
  - `loadState`
  - `saveState`
  - `writePrivateKey`
  - `hasAnyKey`
- `Prompt`
  - `inputText`
  - `inputSecret`
  - `confirm`
- `Clock`
- `Random`

### Infra

Concrete adapters.

First slice:

- Typage crypto adapter
- Node fs home repository
- Node terminal prompt adapter
- Node path resolver

### CLI / Controller

Very thin.

Responsibilities:

- parse args/options
- decide whether to prompt or accept flags
- call use case
- render stdout/stderr
- map app errors to exit codes

Controllers should not contain crypto/fs logic.

## Home Layout v0

Use XDG-style path on Unix:

- `~/.config/better-age/`

Files:

```text
~/.config/better-age/
  state.json
  keys/
    <fingerprint>.key
```

`state.json` v0:

```json
{
  "home_schema_version": 1,
  "active_key_fingerprint": "fp_...",
  "keys": [
    {
      "fingerprint": "fp_...",
      "alias": "isaac-mbp",
      "kind": "user",
      "status": "active",
      "created_at": "2026-04-09T00:00:00.000Z",
      "private_key_path": "keys/fp_....key",
      "key_mode": "pq-hybrid"
    }
  ]
}
```

Keep this explicit and boring.

No SQLite in v0.

## First CLI Contract

Only implement one command first:

### `bage setup`

Behavior:

1. resolve home dir
2. if active key exists:
   - print active fingerprint + alias
   - exit 0
3. otherwise:
   - ask alias, default from username/hostname
   - ask passphrase
   - ask passphrase confirmation
   - call `createUserIdentity`
   - print public key + fingerprint
   - print home path summary

Add non-interactive flags for tests and automation:

- `--alias <value>`
- `--passphrase-stdin`
- `--no-input`

Rules:

- `--no-input` + missing required values => fail
- passphrase prompt must write nothing sensitive to stdout/stderr
- human-readable progress to stderr, structured outputs to stdout only if needed

## First Use Case

### `createUserIdentity`

Input:

```ts
type CreateUserIdentityInput = {
  alias: string
  passphrase: string
  keyMode: "pq-hybrid"
  now: Date
}
```

Flow:

1. validate alias
2. load home state
3. if active key exists, fail with domain error
4. ask crypto port to generate PQ hybrid identity protected by passphrase
5. write private key file
6. write/update `state.json`
7. return:
   - fingerprint
   - alias
   - public key / recipient
   - private key path

Transactional rule:

- private key file write and state write must be fail-safe
- if state write fails after key file write, cleanup best-effort and fail

## Testing Strategy

Use 3 test levels from day one.

### 1. Pure unit tests

Target:

- alias validation
- home-state mutation helpers
- use case orchestration with fake ports

No real fs. No real crypto.

Technique:

- fake `Crypto`
- fake `HomeRepository`
- fake `Clock`

Meaningful unit test for first slice:

- `createUserIdentity` with fake crypto + fake repo
- asserts:
  - alias persisted
  - active key set
  - key mode is `pq-hybrid`
  - private key write invoked once
  - state write invoked once
  - second setup attempt fails if active key already exists

### 2. Integration tests

Target:

- real Typage crypto
- real Node fs adapter
- temp directory home
- no child process yet

Technique:

- create isolated temp dir per test
- inject temp dir as fake HOME/XDG config root
- run Effect program directly with Node adapters

Meaningful integration test for first slice:

- create user identity with real Typage adapter
- assert:
  - private key file exists
  - state.json exists
  - stored key metadata matches returned fingerprint
  - generated recipient/public key is non-empty

### 3. CLI end-to-end test

Target:

- built CLI bundle
- process boundaries
- stdin/stdout/stderr behavior

Technique:

- bundle CLI once in test setup or dedicated fixture
- spawn with Node `child_process.spawn`
- provide stdin programmatically
- assert exit code + output + created files

Source:

- Node child process docs: https://nodejs.org/api/child_process.html

Meaningful E2E test for first slice:

- run bundled `bage setup --alias test --passphrase-stdin`
- write passphrase twice to stdin
- assert:
  - exit code 0
  - stdout contains public key or fingerprint
  - stderr contains no passphrase echo
  - home files created correctly

## Mock FS vs Real FS

Recommendation:

- unit tests: fake repository, not mocked fs
- integration tests: real temp fs
- use `memfs` only for narrow adapter tests if really needed

Reason:

- your real product risk is path/state behavior
- temp-dir integration catches more bugs
- mocked fs is useful, but not default

Official Vitest docs:

- Vitest does not ship fs mocking, and recommends `memfs` if you want it
- https://vitest.dev/guide/mocking/file-system

## CLI / Prompt Design

Do not build a TUI.

V0 prompt surface:

- text input
- secret input
- confirm

That is enough.

Recommended design:

- define a `Prompt` port
- implement `NodePrompt`
- keep `@inquirer/prompts` optional, not foundational

Why:

- lets you test with fake prompt client
- lets you replace with web/TUI later
- avoids coupling app logic to prompt library APIs

## Build Output

Goal:

- one bundled JS CLI file
- runnable with Node

Target:

- `packages/cli/dist/cli.cjs`

esbuild settings:

- bundle: `true`
- platform: `node`
- format: `cjs`
- sourcemap: `inline` in dev, off in release
- banner with shebang: `#!/usr/bin/env node`

Package shape:

- `package.json` with `bin`
- `exports` for programmatic APIs later if wanted

Why CJS first:

- simplest for `node dist/cli.cjs`
- easiest for current Node CLI interoperability

Node single-executable apps can be considered later, not v0.

Source:

- esbuild bundle docs: https://esbuild.github.io/api/
- Node SEA docs: https://nodejs.org/download/release/v22.17.1/docs/api/single-executable-applications.html

## Repo Integration Plan

Recommended workspace package:

- `packages/cli`

Root scripts to add later:

- `pnpm -F @better-age/cli test`
- `pnpm -F @better-age/cli build`
- `pnpm -F @better-age/cli check`

But keep package isolated enough to evolve independently.

## Implementation Sequence

### Step 1. Create package skeleton

Implementation details:

- create `packages/cli/package.json`
- add TS config inheriting repo conventions
- add `src`, `test`, `dist` structure
- add `bin` entry pointing to bundled output

### Step 2. Wire Effect runtime

Implementation details:

- create `program/runtime.ts`
- create `program/layer.ts`
- define live layers for prompt/fs/crypto/clock/random
- create minimal `cli/main.ts`

### Step 3. Define domain + ports

Implementation details:

- define identity metadata types
- define home state schema
- define ports as Effect tags/services
- define error taxonomy

### Step 4. Implement first use case

Implementation details:

- implement `createUserIdentity`
- no CLI parsing inside use case
- return typed success DTO

### Step 5. Implement infra adapters

Implementation details:

- Typage crypto adapter
- Node fs home repository
- Node prompt adapter for alias + passphrase

### Step 6. Expose first command

Implementation details:

- `bage setup`
- flags for non-interactive execution
- map errors to exit codes

### Step 7. Add tests

Implementation details:

- pure unit test for use case
- integration test with temp dir + real Typage
- e2e test with built CLI + spawned process

### Step 8. Bundle CLI

Implementation details:

- esbuild config
- emit single CJS bundle
- verify child-process test runs against bundled artifact

## Warnings

- do not start with multiple workspace packages
- do not start with SQLite
- do not start with a full-screen TUI
- do not start with share/revoke/payload logic before keygen slice works
- do not start with Rust/WASM before TS slice proves DX and cryptographic viability

## Immediate Deliverable After Init

After this bootstrap, the repo should have:

- one package
- one command
- one real crypto-backed use case
- one real bundled CLI artifact
- one unit test
- one integration test
- one e2e CLI test

That is enough to validate the foundation.

## Open Questions

- package name final? `better-age`?
- CJS-first bundle ok?
- use Inquirer for non-secret prompts, yes/no?
- allow hidden test-only flags for passphrase stdin, yes?
