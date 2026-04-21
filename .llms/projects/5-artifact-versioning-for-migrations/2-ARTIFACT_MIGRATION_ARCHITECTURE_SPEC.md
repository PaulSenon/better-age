# Artifact Migration Architecture Spec

This doc captures the settled design block for artifact versioning and migration.
It is narrower than the PRD. It records the current target architecture and command behavior contract.

## Settled Scope

Versioned artifacts:
- `Home State`
- `Payload`
- `Public Identity Snapshot` and its encodings/containers

Separate compatibility boundary:
- `Load Protocol`

## Core Architecture

Use one shared migration engine across versioned artifacts.

Engine responsibilities:
- read stable schema version marker
- detect current vs legacy vs unsupported
- chain adjacent migration steps only
- normalize to current runtime shape only

Policy responsibilities stay artifact-specific:
- auto-persist vs in-memory only
- prompt vs warn vs hard fail
- remediation copy
- nested sub-migration orchestration

## Global Rules

- Every released schema version should keep a forward migration chain to current by default.
- Optional support cutoff is allowed only as explicit documented policy.
- Hard-break gate exists as explicit per-artifact policy table in code.
- Default hard-break policy is allow.
- Unknown/future versions hard fail.
- No downgrade migration path.
- No arbitrary target-version migration.
- Adjacent steps only: `1 -> 2`, `2 -> 3`, never `1 -> 3`.

## Home State Policy

`Home State` is managed internal state.

Rules:
- one global `Home Migration Preflight` runs before any command logic
- if home is legacy but migratable:
  - migrate
  - persist
  - continue
- if home is unsupported:
  - hard fail immediately

Home migration owns home container/state shape only.

Embedded identity evolution inside home:
- `Self Identity` public core uses shared public identity migration
- known identities use shared public identity migration
- alias map evolution stays home-local

## Payload Policy

`Payload` is user-managed state.

Rules:
- payload never auto-rewrites during read flows
- payload reads may use in-memory migration only
- payload writes require explicit persisted update before mutation
- explicit `bage update <payload>` is the persistent migration boundary

Payload migration owns payload envelope/container shape only.

Embedded identity evolution inside payload:
- recipient public identity snapshots use shared public identity migration

## Payload Command Matrix

Shared payload preflight outcomes:
- `cli-too-old`
- `readable-but-outdated`
- `up-to-date`

Behavior by command kind:

Interactive read:
- in-memory migrate
- complete read
- then warn only
- no update prompt

Headless read:
- in-memory migrate
- complete read
- warn on `stderr`
- never prompt

Interactive write:
- prompt for explicit update acceptance
- if accepted: persist migration, then continue original write intent
- if refused: abort without mutation

Headless write:
- hard fail
- remediation says run explicit payload update
- never auto-migrate
- never partially execute original write intent

Explicit `bage update <payload>`:
- idempotent
- persists needed payload rewrites
- reports handled reasons:
  - format migration
  - self refresh
  - both
  - nothing needed

Unsupported newer payload version:
- read hard fails
- write hard fails
- update hard fails
- remediation always says update CLI, not payload

## Payload Version Marker

Payload must carry one explicit stable `schemaVersion` marker.

Purpose:
- deterministic migration routing

It is:
- not inferred by shape
- not duplicated outside the envelope
- stored only inside the encrypted payload envelope

## Public Identity Target

Use one canonical `Public Identity Snapshot` shared across:
- identity string payload
- payload recipients
- known identities
- self identity public core

Current target persisted fields:
- `ownerId`
- `publicKey`
- `displayName`
- `identityUpdatedAt`

Derived only:
- `handle` from `displayName + ownerId`
- `fingerprint` from `publicKey`

Local-only overlay:
- alias map keyed by `ownerId`

Known identities target:
- collection of `PublicIdentitySnapshot` keyed by `ownerId`
- separate alias map keyed by `ownerId`

Self identity target:
- same `PublicIdentitySnapshot` public core
- plus local/private fields only:
  - `privateKeyPath`
  - `createdAt`
  - `keyMode`

## Identity Migration Ownership

Identity evolution is centered on the canonical public identity shape.

Consequences:
- identity string import/export uses shared identity migration
- home reuses shared identity migration for embedded identities
- payload reuses shared identity migration for embedded recipients

## Implementation Order Reminder

Do not start with the full migration engine.

Preferred first phase:
- cleanup / realignment
- align public identity structure across self / known / payload / identity-string forms

Then:
- implement shared migration engine
- implement artifact policies and preflights
