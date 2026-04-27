# Tests

Target test tiers for the new core package:

- `src/**/*.test.ts`
  - deterministic unit tests over fake ports
  - exhaustive domain, migration, and error behavior
- `test/integration/**/*.integration.test.ts`
  - focused real filesystem and real age adapter tests
  - encrypted key and payload fixtures

Do not add compatibility fixtures for prototype schemas.

