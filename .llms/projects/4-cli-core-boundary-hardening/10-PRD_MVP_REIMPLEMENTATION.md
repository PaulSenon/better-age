# PRD: Better Age MVP Reimplementation

## Problem Statement

`better-age` has a working MVP around age encryption, but the current implementation mixes CLI behavior, app logic, persistence, crypto adapters, presentation, and varlock integration in one hard-to-reason-about shape. The MVP proved the product direction, but the code structure is too verbose and too coupled for long-term maintenance.

The desired product is still intentionally small: a polished, portable Unix-friendly CLI wrapper around age, not a full TUI or generic secret manager. Users should get clear command names, readable terminal output, safe machine-output behavior, tested migrations, and reliable payload/identity workflows.

The reimplementation should preserve the MVP feature set while rebuilding the internals around a clean core/CLI boundary, versioned persistence, exhaustive edge-case tests, and a new CLI built from the clarified command and flow specs.

## Solution

Rebuild the MVP in three main parts:

- A new core package that owns domain/app behavior, persistence schemas, migration, crypto ports, repository ports, semantic errors, notices, and exhaustive tests.
- A new CLI package that owns command parsing, exact/guided execution, interactive/headless policy, passphrase prompts, editor/viewer/picker flows, presentation, and stdout/stderr routing.
- A varlock integration that shells out to the new `load` protocol and preserves the proven stdio behavior.

The current CLI becomes a private legacy reference package. It is not a compatibility constraint and should not shape the new core API.

Technology choices:

- Core uses Effect for typed failures, services, layers, ports, dependency wiring, and test runtimes.
- CLI uses Effect and `@effect/cli` for command parsing, args/options, help/usage, and prompt primitives where sufficient.
- CLI presentation is an internal boundary that can render emoji, color, and bold output for humans while keeping machine stdout clean.

## User Stories

1. As a first-time user, I want to run setup with my display name, so that I can create my local identity.
2. As a first-time user in an interactive terminal, I want setup to prompt for missing name and passphrase, so that I can complete onboarding without reading docs.
3. As a headless caller, I want setup to fail clearly when a passphrase cannot be prompted, so that automation does not hang.
4. As a user, I want to create an encrypted payload file, so that I can store env-style secrets safely.
5. As a user, I want create to fail before passphrase prompt when the target already exists, so that I avoid wasted secret entry.
6. As a user, I want to inspect a payload without exposing plaintext values, so that I can understand metadata safely.
7. As a user, I want to view payload plaintext in a secure viewer instead of stdout, so that secrets are not accidentally piped or logged.
8. As a machine caller, I want `load` to print raw env text to stdout only, so that tools can consume it predictably.
9. As a varlock user, I want varlock to invoke `load` while preserving passphrase prompts, so that existing interactive machine workflows keep working.
10. As a user, I want to edit payload env text in my editor, so that I can update secrets ergonomically.
11. As a user, I want invalid edited env text to reopen in the editor with my changes preserved, so that I can fix mistakes without losing work.
12. As a user, I want saving unchanged edited text to succeed as unchanged, so that no-op edits are not scary.
13. As a user, I want to grant another identity access to a payload, so that I can share encrypted secrets.
14. As a user in guided grant flow, I want to pick from known identities, already-granted recipients, self, and custom identity strings in one picker, so that sharing is smooth.
15. As a user, I want self grant to be impossible, so that payload recipients stay meaningful.
16. As a user, I want granting an already-granted identity to succeed unchanged, so that repeated commands are idempotent.
17. As a user, I want granting a newer identity snapshot to refresh the recipient, so that payload access follows identity rotation.
18. As a user, I want to revoke an identity from a payload, so that access can be removed on future writes.
19. As a user, I want revoking a non-granted identity to succeed unchanged, so that revoke is idempotent.
20. As a user, I want self revoke to be impossible, so that I do not lock myself out in the MVP.
21. As a user, I want to update a payload explicitly, so that format migrations and self-recipient refreshes are intentional.
22. As a user, I want readable-but-outdated payload reads to succeed with a warning, so that old-but-readable payloads are not blocked unnecessarily.
23. As a user, I want write commands to gate outdated payloads, so that writes do not silently persist old formats.
24. As a user, I want identity export to print only the identity string to stdout, so that I can pipe it to clipboard or another command.
25. As a user, I want identity import to optionally set a local alias, so that known identities are easier to recognize.
26. As a user, I want duplicate or invalid aliases to be rejected, so that identity display stays unambiguous.
27. As a user, I want identity list to show self, known identities, and retired keys, so that I understand local state.
28. As a user, I want identity forget to remove a known identity and alias without touching payloads, so that local address book changes are safe.
29. As a user, I want identity rotation to preserve my OwnerId and retire the old key, so that old payloads remain decryptable.
30. As a user, I want identity rotation to warn that existing payloads may need update, so that new self recipient snapshots are persisted intentionally.
31. As a user, I want passphrase change to reencrypt current and retired private keys, so that all local key material uses the new passphrase.
32. As a user, I want wrong passphrase prompts to retry inline up to the standard retry policy, so that simple mistakes are recoverable.
33. As a user, I want exact commands to avoid chooser menus, so that explicit command invocations remain predictable.
34. As a user, I want guided interactive commands to prompt for missing operands, so that common workflows are ergonomic.
35. As a headless caller, I want missing operands and passphrase-unavailable failures to be explicit, so that automation fails fast.
36. As a user, I want errors and warnings to stand out visually, so that important terminal output is not lost in raw text.
37. As a user, I want machine stdout commands to stay unstyled and clean, so that scripts remain reliable.
38. As a maintainer, I want core APIs to be exact, stateless, and domain-shaped, so that they are easy to test and reason about.
39. As a maintainer, I want CLI flows to own prompts, retries, back/cancel, editor/viewer, and presentation, so that shell concerns do not leak into core.
40. As a maintainer, I want versioned home, payload, private-key, and identity-string artifacts, so that migration is a first-class mechanism.
41. As a maintainer, I want new v1 schemas without prototype compatibility, so that the rebuild starts clean.
42. As a maintainer, I want migration no-op and failure fixtures from day one, so that future schema changes are safe.
43. As a maintainer, I want broad unit tests with fake ports, so that domain edge cases are fast and deterministic.
44. As a maintainer, I want focused integration tests with real age and filesystem adapters, so that real interoperability is proven.
45. As a maintainer, I want CLI contract tests for stdout/stderr, prompts, and exit codes, so that UX contracts remain stable.
46. As a maintainer, I want varlock process/stdio tests, so that load protocol behavior stays reliable.

## Implementation Decisions

- Park the current CLI as a private legacy reference package.
- Remove the legacy CLI binary entrypoint during the unreleased rebuild.
- Build a new core package first and cover the MVP behavior before rebuilding the CLI.
- Build a new CLI package from scratch on top of the new core.
- Keep varlock as a separate package that shells out to the new CLI `load` protocol.
- Do not support previous prototype persistence schemas.
- Start new home state, payload, private key plaintext, and public identity string artifacts at version 1.
- Use explicit artifact kind and version on every persisted or shareable artifact.
- Store encrypted private keys as separate age-encrypted key blobs referenced by home state metadata.
- Keep better-age as an age wrapper with improved UX and persistence, not a custom crypto container.
- Use Effect in core for ports, services, typed failures, layers, orchestration, and test runtimes.
- Use Effect plus `@effect/cli` in the CLI for command parsing, args/options, help/usage, and prompt primitives.
- Build an internal presenter boundary for human output styling.
- Allow emoji, color, and bold for human output, especially interactive mode.
- Keep `load` and `identity export` stdout clean and unstyled.
- Core mutations receive path, passphrase, and command-specific exact inputs.
- Core mutations do not receive already-opened payload context.
- CLI may open payloads early to improve UX, then call stateless core mutations.
- Home state migration may persist during preflight.
- Payload read migration may be in-memory only.
- Persisted payload migration happens through explicit update behavior.
- Exact/guided mode is based on mandatory non-secret operands only.
- Interactive/headless terminal mode controls whether prompts, menus, editor, and viewer can run.
- Protocol operands, such as load protocol version, are not guided by prompt.
- Missing operands are CLI-only errors.
- Idempotent no-op outcomes are successes, not errors.
- Core notices are semantic side information, not logs.
- Varlock does not collect or forward passphrases.

Major modules to build:

- Artifact codecs and migrations.
- Identity store.
- Key vault.
- Payload store.
- Core facade.
- Core repository and crypto adapters.
- CLI shell parser.
- CLI flow orchestrator.
- CLI interaction ports.
- CLI presenter.
- Varlock process adapter.

## Testing Decisions

- Core unit tests use fake repositories, fake crypto, fixed clock, and deterministic IDs.
- Core unit tests cover domain rules, error branches, idempotence, notices, resolver logic, and migration decisions exhaustively.
- Core integration tests use real filesystem, real age adapter, real encrypted key blobs, and real encrypted payload files.
- Integration tests prove encrypted private key round trips, payload round trips, passphrase change, identity rotation decryptability, grant/revoke decryptability, and fixture parse/read/write behavior.
- Migration tests exist from day one for v1 no-op migration, wrong kind, future version, malformed version, and missing required fields.
- CLI contract tests cover exact/guided/headless behavior, missing operands, protocol errors, stdout/stderr routing, exit codes, passphrase retry, prompt cancel, Ctrl+C, editor behavior, and machine stdout cleanliness.
- CLI presentation tests prefer message ids and semantic style tokens over brittle raw ANSI snapshots.
- Varlock integration tests cover spawned load process stdio behavior and adapter failure mapping.
- Tests should verify external behavior and stable contracts, not implementation details.
- Do not write compatibility tests for previous prototype schemas.

## Out of Scope

- Compatibility with previous prototype home or payload schemas.
- Full TUI interface.
- Generic secret manager features beyond the MVP command surface.
- Public SDK design beyond internal core contracts.
- Automatic import of unknown payload recipients during payload open flows.
- Identity alias management commands beyond alias prompt during import.
- Pre-persist encrypt/decrypt anti-corruption verification for payload writes.
- Releasing or preserving the old CLI during reimplementation.
- Implementing code in this PRD/spec phase.

## Further Notes

The target command surface is:

```txt
bage create
bage edit
bage grant
bage inspect
bage load --protocol-version=1
bage revoke
bage update
bage view

bage identity export
bage identity forget
bage identity import
bage identity list
bage identity passphrase
bage identity rotate

bage setup
bage interactive
```

The implementation plan should use tracer bullets. Avoid a large horizontal plan that builds all core, then all CLI. A small foundation phase for artifact codecs and migration fixtures is acceptable, followed by thin end-to-end slices.

