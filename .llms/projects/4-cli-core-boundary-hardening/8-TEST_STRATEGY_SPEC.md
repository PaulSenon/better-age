# Test Strategy Spec

Status: active spec. Goal: define unit/integration coverage boundaries before implementation.

## Principles

- Core behavior gets broad deterministic unit coverage.
- Real adapter behavior gets focused integration coverage.
- Migration and persisted artifacts are fixture-tested from day one.
- CLI tests should verify user contracts, not duplicate every core edge case.
- No test should depend on previous prototype schemas.

## Test Layers

```txt
core unit tests:
  pure/domain/app behavior with fake ports

core integration tests:
  real filesystem + real age adapter + fixture artifacts

cli contract tests:
  command behavior, stdout/stderr, exit codes, prompts with fake core or test core

varlock integration tests:
  spawned CLI load protocol with stdio contract
```

## Core Unit Tests

Use:

```txt
fake home repository
fake payload repository
fake crypto port
fake clock
fake id generator
```

Scope:

```txt
identity create/import/export/list/forget/rotate/passphrase
payload create/decrypt/edit/grant/revoke/update
exact error taxonomy
idempotent success outcomes
notice production
migration decision logic over decoded docs
resolver logic for identity refs and grant/revoke refs
```

Rules:

- deterministic.
- no real age binary/library requirement.
- no real filesystem requirement.
- cover edge cases exhaustively here.
- fake crypto can model passphrase, access, decrypt, encrypt, and key-protection failures.

## Core Integration Tests

Use:

```txt
real filesystem temp dirs
real age adapter
real persisted JSON documents
real encrypted key blobs
real encrypted payload files
```

Scope:

```txt
encrypted private key round-trip
payload encrypt/decrypt round-trip
passphrase change reencrypts current + retired key blobs
identity rotate keeps old key decryptability
payload grant makes recipient decryptability real
payload revoke removes recipient decryptability for future writes
load-compatible envText output through real decrypt
fixture parse/read/write for v1 home/payload/public identity artifacts
```

Rules:

- focused coverage; do not duplicate every unit edge case.
- prove real age interoperability and file layout.
- fixtures should be small and stable.
- no compatibility tests for prototype schemas.

## Migration Fixture Tests

Required immediately:

```txt
v2 home no-op migration
v1 home -> v2 migration with `editorCommand: null`
v1 payload no-op migration
v1 public identity no-op migration
wrong kind failures
future version failures
malformed version failures
missing required field failures
```

Required for future home versions:

```txt
synthetic v2 -> next-version fixtures
migration path missing fixture
hard-broken migration fixture
```

Rules:

- migration functions are tested as pure transforms over decoded JSON.
- home preflight persistence is tested separately.
- payload in-memory read migration is tested separately from persisted `update`.

## CLI Contract Tests

Scope:

```txt
command exact/guided/headless behavior
missing operand errors
protocol errors for load
stdout/stderr routing
exit code mapping
passphrase retry behavior
prompt cancel and Ctrl+C behavior
editor cancel/unchanged/invalid/retry behavior
machine stdout cleanliness for load and identity export
human stdout for inspect and identity list
presenter message ids and style intent
```

Rules:

- use fake prompt/editor/viewer ports.
- do not require real terminal UI.
- do not duplicate core mutation edge cases beyond one happy path and one representative failure per command.
- snapshot message ids and structured render data first; avoid brittle ANSI snapshots unless styling is the subject.
- style tests should prefer semantic style tokens over raw ANSI where possible.

## Varlock Integration Tests

Scope:

```txt
spawned CLI load process
stdin inherited for passphrase prompt
stdout captured as env text
stderr inherited/observed for human prompts and warnings
non-zero load exit maps to adapter failure
stdout pipe unavailable maps to adapter failure
```

Rules:

- test the process/stdio contract, not core behavior.
- use minimal fixture payload.
- no passphrase is handled by varlock itself.

## Coverage Bias

Prefer exhaustive unit coverage for:

```txt
domain rules
error branches
idempotence
resolvers
migration decisions
output decision data
```

Prefer integration coverage for:

```txt
real crypto
real file layout
real process stdio
real editor/viewer adapters only if implemented as adapters
```
