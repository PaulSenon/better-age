# Artifact Migration Architecture

We will use one shared migration path for versioned persisted artifacts, but keep artifact behavior in artifact-specific policy layers. `Home State` is managed internal state and auto-migrates in a global preflight before any command logic. `Payload` is user-managed state: reads may use in-memory migration only, writes require explicit persisted update, and `bage update <payload>` is the idempotent explicit rewrite boundary. Public identity evolution is unified around one canonical `Public Identity Snapshot`, reused across identity strings, payload recipients, known identities, and self identity public fields, with local aliases kept in home-local state. Intentional support cutoffs must be explicit and documented; default is to keep released schemas migratable.

Current MVP implementation keeps this architecture compact inside
`packages/core/src/persistence/ArtifactDocument.ts` and
`packages/core/src/identity/BetterAgeCore.ts`. Home state is v2; payload,
private key, and public identity artifacts are v1.
