# Spec Worklist: CLI/Core Boundary Redesign

Status: active spec session. No implementation tasks here.

## Current Locked Decisions

- Do not restart from scratch before specs are stable.
- Target contracts are written across `core`, `cli`, and `varlock` concerns.
- Core is exact and semantic.
- CLI owns shell policy, prompts, guided completion, back/cancel, presentation, and exit behavior.
- Core API is not a mirror of CLI commands.
- `view`, `inspect`, and `load` share core `decryptPayload`.
- Keep explicit core payload mutations, no generic public `writePayload`.
- Keep typed semantic notices small; do not replace with logs.
- Payload discovery from cwd is CLI-only.
- Payload file IO after exact path is core-owned behind ports.
- Identity parsing/resolution belongs in core queries.
- Mutations receive strict inputs.
- `grantPayloadRecipient` accepts an exact recipient identity snapshot.
- `revokePayloadRecipient` accepts `OwnerId`.
- Passphrase retry policy belongs to CLI; core is one-shot.
- CLI flow-control signals are shell-internal, not core results.

## Canonical Target Commands

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
bage identity passphrase # aliases: pass, pw
bage identity rotate

bage setup
bage interactive # alias: i
```

## Done

- Recovered durable decisions from append-only grill log.
- Updated PRD from stale refactor/completed-phase framing to target spec charter.
- Preserved current command target in ubiquitous language.
- Boundary API spec already covers most core query/command contracts.
- Boundary API spec already separates CLI commands from shared CLI flows.
- Added reusable plaintext execution flow chunks for payload-content commands and create.
- Error taxonomy cleanup pass completed in `3-ERROR_KIND_SPEC.md`.
- Error/message mapping cleanup pass completed in `4-ERROR_MESSAGE_MAPPING_SPEC.md`.
- Varlock adapter failures now have a typed boundary surface.
- Added command-by-command CLI contract spec in `5-CLI_COMMAND_CONTRACT_SPEC.md`.
- Reflected command contracts into `CLI_COMMAND_CONTRACTS` in `1-BOUNDARY_API_SPEC.ts`.
- Added notice/success outcome spec in `6-NOTICE_SUCCESS_SPEC.md`.
- Added global home preflight and shared failure ordering to execution specs.
- Added persistence schema/migration spec in `7-PERSISTENCE_SCHEMA_SPEC.md`.
- Added macro implementation architecture in `9-MACRO_IMPLEMENTATION_ARCHITECTURE.md`.
- Added implementation PRD in `10-PRD_MVP_REIMPLEMENTATION.md`.
- Added tracer-bullet implementation plan in `plans/better-age-mvp-reimplementation.md`.

## Next Spec Slices

1. Review execution-context model after full flow pass.
   - exact vs guided captured
   - interactive vs headless captured
   - direct command vs interactive session captured without third axis

2. Review CLI command contracts after full flow pass.
   - exact/guided inputs captured per command
   - prompt/viewer/editor/passphrase needs captured
   - stdout/stderr/menu/viewer sinks captured

3. Finish core API contracts.
   - command/query inputs
   - result values
   - typed failure details
   - semantic notices

4. Review error catalog after full command-flow pass.
   - active taxonomy has no open questions after cleanup
   - revisit only if later flow/API work exposes missing cases

5. Review flow descriptions after final API pass.
   - setup
   - payload command-specific continuations after shared payload flow
   - identity export/import/list/forget/rotate/passphrase
   - interactive session routing
   - varlock load protocol path

6. Implementation rollout framing.
   - park current CLI as `cli-legacy`
   - remove legacy command bin
   - mark legacy package private
   - create new core package first with full MVP test coverage
   - create new CLI from scratch on top of new core
   - package/bin compatibility is not required during unreleased MVP reimplementation

7. Core persistence/test-fixture strategy.
   - define new `HomeStateDocument v1`
   - define new `PayloadDocument v1`
   - define new `PublicIdentityString v1`
   - no compatibility with previous prototype schemas
   - migration mechanism still exists and is tested from day one
   - artifact envelopes use explicit `kind` and `version`
   - encrypted private keys live in `keys/<fingerprint>.age`
   - home state stores key metadata and encrypted-key refs only
   - private key blobs use age-native encrypted file format; no custom outer crypto container

8. Test strategy.
   - deterministic core unit tests with fake ports
   - focused core integration tests with real filesystem + real age adapter
   - migration fixture tests from day one
   - CLI contract tests for stdout/stderr/exit/prompt behavior
   - varlock process/stdio integration tests

9. Macro implementation architecture.
   - package rollout
   - dependency direction
   - tech choices: `effect`, `@effect/cli`, internal presenter
   - core deep modules
   - CLI macro modules
   - varlock module
   - build order
   - first tracer bullet candidate

## Known Stale/Current-V1 Terms

These names can appear in shipped docs/code, but are not target CLI language:

- `me` -> `identity export` or part of `identity list`
- `identities` -> `identity list`
- `add-identity` -> `identity import`
- `forget-identity` -> `identity forget`
- `rotate` -> `identity rotate`
- `change-passphrase` -> `identity passphrase`

## Reviewer Summary

Done: stale plan reframed; specs complete enough for PRD; macro implementation architecture captured; PRD synthesized; tracer-bullet plan written.
Left: implementation.
Questions: none active.
Blocking: none.
