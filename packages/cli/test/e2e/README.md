# E2E Tests

E2E tests verify the built CLI contract.

Rules:
- execute `dist/cli.cjs`, never source TS
- execute inside the `rivetkit/agent-os` VM harness, not unsandboxed host spawn
- build before running
- assert process exit code, stdout, stderr, and filesystem effects
- fixtures stay under `test/e2e/**/fixtures`
- no imports from integration fixture folders
