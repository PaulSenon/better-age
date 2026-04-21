# Better Secrets V0 PRD

## Problem Statement

Developers need a simple way to keep `.env`-style secrets encrypted at rest without adopting a cloud platform, manually managing raw `age` commands, or learning the deeper operational model behind key rotation and recipient management.

Current tools cover parts of the problem:
- raw `age` is low-level and ergonomic only for security-comfortable users
- `sops` is powerful but broader than this product and still expects users to understand more of the underlying mechanics
- plaintext `.env` files are convenient but unsafe at rest

The v0 problem is not "build a full secret platform". It is:
- give one user on one or more machines a low-friction encrypted env workflow
- make good hygiene the default
- keep the payload file explicit and caller-owned
- make interactive flows guide maintenance instead of requiring security expertise

## Solution

Build `better-age` v0 as a local-first CLI for encrypted env payload files with:
- one local identity initialized by `setup`
- one copy-paste identity string exported by `me`
- explicit payload commands: `create`, `load`, `read`, `edit`, `grant`, `revoke`, `inspect`, `update`
- explicit home commands: `setup`, `me`, `add-identity`, `identities`, `rotate`, `change-passphrase`
- a self-explanatory payload file format with a short plaintext instructional preamble and an armored encrypted payload block
- interactive preflight maintenance prompts for payload update when needed
- strict non-interactive behavior that never prompts and never hides mutation

The product stays honest:
- no sync
- no delivery layer
- no hidden payload manager
- no auto-purge
- no team platform claims

## User Stories

1. As a developer, I want to run `setup` once, so that I can start using encrypted env payloads without understanding raw cryptography.
2. As a developer, I want `setup` to guide me through display name, passphrase, and rotation TTL, so that my local identity is initialized safely by default.
3. As a developer, I want my local private keys protected by one passphrase, so that I do not need to remember different passphrases for active and retired keys.
4. As a developer, I want `me` to print one copy-paste string, so that I can easily share my identity with someone granting me access.
5. As a developer, I want `add-identity` to accept exactly that shared string, so that importing another person is low friction and unambiguous.
6. As a developer, I want imported identities to update by stable owner identity, so that rotation does not create duplicate address-book entries.
7. As a developer, I want display-name collisions handled safely, so that I do not accidentally grant the wrong person.
8. As a developer, I want optional local aliases, so that I can locally disambiguate homonymous identities without changing payload truth.
9. As a developer, I want `identities` to show me, known identities, and retired local keys, so that I can inspect local state without reading internal files.
10. As a developer, I want `create` to make a payload with my own identity granted first, so that I always retain access to what I create.
11. As a developer, I want `create` to prompt for a filename in TTY mode when needed, so that I can use the command interactively from any directory.
12. As a developer, I want payload files to stay visible and caller-owned, so that I know where my secrets live and can move them deliberately.
13. As a developer, I want payload files to include a short plaintext explanation, so that opening the file immediately tells me what it is and which command to use.
14. As a developer, I want the real metadata and env content encrypted together, so that recipient lists and payload details are not leaked in plaintext.
15. As a developer, I want `inspect` to show non-secret payload metadata and env key names, so that I can understand a payload without exposing values.
16. As a developer, I want `inspect` to always tell me whether a payload needs update, so that maintenance state is explicit.
17. As a developer, I want `load` to output plaintext env data to `stdout`, so that I can pipe it into loaders and other tools.
18. As a developer, I want `read` to teach me safer human and machine alternatives instead of dumping plaintext, so that I do not accidentally leak secrets to the terminal.
19. As a developer, I want `edit` to open a plain `.env` buffer, so that editing feels familiar and not tied to a custom container format.
20. As a developer, I want invalid env edits to send me back to the editor, so that I can fix mistakes without corrupting the payload.
21. As a developer, I want `grant` to work as an upsert by identity continuity, so that granting a rotated identity refreshes access instead of duplicating entries.
22. As a developer, I want `grant` with no identity arg to be interactive, so that I can select from known identities or paste a new shared string inline.
23. As a developer, I want `revoke` with no identity arg to be interactive, so that I can revoke from the payload’s actual granted recipients instead of guessing names.
24. As a developer, I want `revoke` to match by owner identity rather than exact key snapshot, so that older copied identity strings still revoke the intended person.
25. As a developer, I want self-revoke forbidden in v0, so that I cannot accidentally lock myself out.
26. As a developer, I want key rotation to be local and predictable, so that rotating does not suddenly crawl my filesystem or rewrite every payload.
27. As a developer, I want payload update to be an explicit command, so that the maintenance model remains honest and scriptable.
28. As a developer, I want interactive commands to prompt me into update when needed, so that I rarely need to learn or remember the maintenance command.
29. As a developer, I want non-interactive commands to fail instead of silently mutating, so that scripts remain predictable and debuggable.
30. As a developer, I want payload commands to learn identities from payload recipients, so that my local address book fills in naturally as I work.
31. As a developer, I want non-self payload identities never auto-upgraded from local data, so that my machine does not silently change other people’s access.
32. As a developer, I want retired keys kept indefinitely in v0, so that old payload access is not broken by hidden garbage collection.
33. As a developer, I want corrupted payloads to fail clearly by stage, so that I know whether the problem is file format, decryption, schema, or env content.
34. As a maintainer, I want the v0 architecture to preserve strong internal layers, so that the CLI remains testable and later slices do not collapse into script glue.
35. As a maintainer, I want vertical slices that cut through domain, app, ports, adapters, CLI, and tests, so that every phase remains demoable and safe to merge.

## Implementation Decisions

- Keep one package for v0 and extend the existing layered architecture rather than splitting into multiple workspace packages.
- Reuse the current layer split:
  - domain for pure models and invariants
  - app/use cases for orchestration
  - ports for abstract crypto/home/prompt/editor/payload persistence contracts
  - infra for node/fs/crypto/prompt/editor implementations
  - cli for command parsing and user-facing control flow
- Replace the current setup-centric identity model with a fuller identity model based on:
  - stable `ownerId`
  - current key fingerprint
  - display name
  - handle
  - `identityUpdatedAt`
- Freeze v0 text identity formats:
  - `ownerId = bsid1_<16hex>`
  - `handle = <display-name>#<first-8-hex-of-owner-id-body>`
- Keep current identity-string URL path opaque for now:
  - `better-age://identity/v1/<payload>`
  - future plaintext path hints may be added, but only as cosmetic routing hints
  - importer must trust decoded payload, not URL path cosmetics
- Expand home state from "active key + keys list" into a real persisted model containing:
  - schema version
  - self identity summary
  - active fingerprint
  - retired key metadata
  - rotation TTL
  - known identities collection
- Store encrypted private keys as raw age passphrase-encrypted files under the home keys directory, while keeping metadata in `state.json`.
- Introduce a payload domain model consisting of:
  - outer text file with static instructional preamble and explicit begin/end markers
  - decrypted inner envelope with `version`, `payloadId`, timestamps, recipients, and `envText`
- Freeze payload id text format:
  - `payloadId = bspld_<16hex>`
- Treat recipient entries as full identity snapshots:
  - `ownerId`
  - `publicKey`
  - `fingerprint`
  - `displayNameSnapshot`
  - `identityUpdatedAt`
- Keep local aliases as home-local overlays only. They must never become payload fields or trust primitives.
- Make `grant` an upsert by `ownerId`.
- Make `revoke` payload-recipient-authoritative and identity-level rather than fingerprint-level.
- Introduce explicit `update` as the only maintenance command that rewrites payload state outside `grant`, `revoke`, `edit`, and `create`.
- Limit `update` in v0 to:
  - schema migration
  - self-recipient refresh when the local active key has rotated
- Allow payload commands to import or refresh known identities from payload recipient snapshots, but forbid those imports from changing payload recipients automatically.
- Keep `load` as the machine-facing plaintext command and `read` as the educational/discoverability command for plaintext access.
- Use strict interactive vs non-interactive semantics:
  - interactive may prompt
  - non-interactive never prompts and never hides mutation
- Keep alias creation opportunistic and optional in v0 rather than introducing a dedicated alias management surface.
- Defer rename, payload tracking, auto-purge, JSON outputs, and multi-recipient operations to later versions.

### Major modules to build or deepen

- `Identity Registry`
  - Owns self identity snapshot, known identities, freshness comparison, collision handling, and optional local alias overlays.
  - Deep module because it hides all resolution and freshness rules behind a stable interface.
- `Key Lifecycle`
  - Owns setup, active/retired key transitions, passphrase-protected private key storage, rotation, and passphrase change.
  - Deep module because the rest of the app should not care how keys are laid out or rewritten.
- `Payload Envelope`
  - Owns parsing and serializing the outer file, armored block extraction, inner envelope schema, and recipient snapshot shape.
  - Deep module because command code should not manipulate container text directly.
- `Payload Access Controller`
  - Owns create/read/edit/grant/revoke/update orchestration, including self-update preflight and recipient mutation rules.
  - Deep module because it centralizes all payload mutation semantics.
- `Interactive Flow Controller`
  - Owns TTY prompts, non-interactive refusal rules, identity picking, alias suggestion, and editor launch policy.
  - Deep module because it isolates UX branching from domain logic.

## Testing Decisions

- Good tests assert externally observable behavior, not implementation details.
- Good tests should prefer stable contracts:
  - resulting state
  - resulting payload content
  - visible stdout/stderr outcomes
  - explicit failure cases
- Good tests should avoid coupling to incidental ordering unless ordering is a user contract, such as env key order in `inspect`.

Modules/behaviors that should be tested:
- identity snapshot validation and freshness comparison
- identity resolution and ambiguity handling
- home-state read/write and migration behavior
- setup and rotation lifecycle
- passphrase change across active and retired keys
- payload outer file parse/serialize
- inner envelope schema validation
- create/read/edit/update happy paths
- `grant` upsert behavior
- `revoke` identity-level removal behavior
- `inspect` redaction contract
- `load` protocol contract and stdout/stderr discipline
- `read` educational guidance contract
- interactive update preflight vs non-interactive failure behavior
- corruption stage classification

Prior art in codebase:
- existing unit use-case tests
- existing integration test for identity creation
- existing sandboxed CLI test harness using `secure-exec`

Expected test layers:
- pure unit tests for domain invariants and use-case decisions
- integration tests for real adapter behavior and file layouts
- sandboxed CLI tests for user-visible command contracts

## Out of Scope

- delivery or file transport
- sync between machines
- cloud account model
- team/org model
- CI/robot first-class flow
- alias management command
- self display-name rename
- retired-key purge
- payload usage tracking/indexing
- automatic filesystem crawl for payloads
- JSON output for `inspect` or `identities`
- multi-recipient grant/revoke
- raw ownerId/fingerprint user-facing refs
- OS keychain integration
- partial payload recovery

## Further Notes

- The v0 product should remain intentionally smaller than `sops`, not "sops but incomplete".
- The primary differentiator is low-friction UX for non-expert developers while keeping the mutation model honest.
- `update` is a first-class concept in v0 and should be documented openly, even if most interactive users rarely invoke it manually.
- The resolved Q/A log remains in `GRILL_ME_V0_SPECS.md` and should be treated as design rationale history, while `BETTER_AGE_V0_SPEC.md` is the main behavioral spec.
