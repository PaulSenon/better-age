# Tests

This package uses 3 test tiers.

- `src/**/*.test.ts`
  - colocated unit tests
  - pure domain tests and narrow app-service tests
  - fast, deterministic, no built artifact
- `test/integration/**/*.integration.test.ts`
  - source-level integration tests across real adapters and layers
  - no built CLI artifact
- `test/e2e/**/*.e2e.test.ts`
  - black-box CLI tests
  - must execute `dist/cli.cjs`
  - must execute in the `rivetkit/agent-os` VM harness
  - must build before running

Rules:
- unit fixtures live next to the unit tests that own them
- integration fixtures live under `test/integration/**/fixtures`
- e2e fixtures live under `test/e2e/**/fixtures`
- do not recreate a generic `test/support` bucket
