# PRD: CLI/Core Boundary Redesign Spec

Status: spec-only, not implementation plan.

## Problem

`better-age` v1 reached MVP shape, but the internal model is too hard to reason about:

- CLI interaction, command orchestration, app logic, and presentation are still too coupled.
- user-facing command names drifted from the desired product language.
- errors, warnings, notices, and flow-control signals are not yet exhaustively specified.
- exact/guided behavior depends on terminal capability, but this policy is not yet a clean contract.
- Effect + DDD boundaries are useful, but current shape feels verbose for a small `age` wrapper.

The goal is not a rewrite for its own sake. The goal is a precise target architecture that can later drive a safer rework.

## Target Command Surface

Canonical target CLI surface:

```txt
# payload
bage create
bage edit
bage grant
bage inspect
bage load --protocol-version=1
bage revoke
bage update
bage view

# identity
bage identity export
bage identity forget
bage identity import
bage identity list
bage identity passphrase # aliases: pass, pw
bage identity rotate

# setup
bage setup

# interactive
bage interactive # alias: i
```

Anything using root `me`, `identities`, `add-identity`, `forget-identity`, `rotate`, or `change-passphrase` is current-v1 vocabulary, not target vocabulary.

## Target Architecture

Spec target is three package/subproject concerns:

- `@better-age/core`
- `@better-age/cli`
- `@better-age/varlock`

Logical layers:

- core domain/model
- core app/api + ports
- CLI shell/commands
- CLI interaction/flows
- CLI presentation + CLI infra
- varlock plugin/runtime adapter

The exact packaging can still be phased later, but the contracts should be written as if these concerns are separable.

## Boundary Rules

- Core behaves like an internal SDK/API.
- Core accepts exact, already-resolved inputs.
- Core returns semantic success/failure plus typed semantic notices.
- Core does not know argv, prompts, menus, back/cancel, ANSI, editor/viewer UI, or terminal capability.
- CLI owns command parsing, missing operand resolution, prompt timing, retry policy, back/cancel, and final rendering.
- CLI may query core to build guided flows.
- CLI cwd payload discovery stays outside core.
- Once a payload path is exact, payload read/write repository IO stays core-owned behind ports.
- Varlock does not call core directly in v1 target; it depends on the CLI `load` protocol.

## Core API Shape

Core API must be domain-shaped, not CLI-shaped.

Settled examples:

- CLI `view`, `inspect`, and `load` use core `decryptPayload`.
- CLI `identity import` maps to core `importKnownIdentity`.
- CLI `identity export` maps to core `exportSelfIdentityString`.
- CLI `identity list` composes self identity, known identities, and retired keys queries.
- Core keeps explicit payload mutations:
  - `createPayload`
  - `editPayload`
  - `grantPayloadRecipient`
  - `revokePayloadRecipient`
  - `updatePayload`
- No generic public `writePayload` primitive.

## Notice Model

Core notices are typed semantic side information, not logs.

Use notices only when the information affects stable product behavior or machine/human output:

- home state migrated
- payload read used in-memory migration
- payload update recommended

Generic debug/info chatter belongs to logging/observability, not notices.

## Invocation Policy

CLI behavior derives from two axes:

- invocation mode: exact vs guided
- terminal mode: interactive vs headless

Policy direction:

- exact invocation never opens chooser flows for explicit operands.
- guided + interactive may resolve missing operands through prompts/menus.
- guided + headless fails fast with remediation.
- passphrase prompts are allowed only when terminal is interactive and command policy permits it.
- `interactive` is a CLI session surface, not a core concept.

## Migration Policy

- Home State is managed state and may auto-migrate during global preflight.
- Payload is a user-managed resource.
- Payload reads may use in-memory migration and return notices/warnings.
- Payload writes that need persisted update must go through explicit update policy/gate.
- `bage update` is the explicit persisted payload rewrite boundary.

## Non-Goals

- no implementation changes in this session
- no tests in this session
- no dev server/build/deploy commands
- no public SDK design beyond internal contracts
- no inference that current implementation is ideal
- no full TUI
- no generic secret manager scope expansion

## Spec Artifacts

- append-only grill log: `0-GRILL-ME-cli-architecture-sweet-spot.md`
- boundary contracts: `1-BOUNDARY_API_SPEC.ts`
- execution flow chunks: `2-EXECUTION_FLOW_SPEC.md`
- error taxonomy: `3-ERROR_KIND_SPEC.md`
- error/message mapping: `4-ERROR_MESSAGE_MAPPING_SPEC.md`
- CLI command contracts: `5-CLI_COMMAND_CONTRACT_SPEC.md`
- notices and success outcomes: `6-NOTICE_SUCCESS_SPEC.md`
- persistence schemas and migration strategy: `7-PERSISTENCE_SCHEMA_SPEC.md`
- test strategy: `8-TEST_STRATEGY_SPEC.md`
- macro implementation architecture: `9-MACRO_IMPLEMENTATION_ARCHITECTURE.md`
- spec worklist: `plans/better-age-internal-boundary-hardening.md`
- project language: `../../UBIQUITOUS_LANGUAGE.md`
- compatibility language: `../../CONTEXT.md`

## Open Work

- review final layer API contracts after implementation planning pass
- review command-to-core mapping and CLI flow contracts after full flow pass
- review invocation matrix from exact/guided x interactive/headless after full flow pass
- review semantic error-code catalog after full flow pass
- review notice/warning/message-id catalog after full flow pass
- review flow descriptions from execution context after final API pass
- implementation rollout is decided: park current CLI as private `cli-legacy`, build new core package first, then build new CLI from scratch
