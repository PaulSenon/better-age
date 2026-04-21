# Tests

This package currently uses 2 test tiers.

- `src/**/*.test.ts`
  - colocated unit tests
  - package-local registration and metadata behavior
- `test/**/*.integration.test.ts`
  - package shape and manifest wiring checks
  - no built artifact coupling yet

Rules:
- keep package-shape assertions here until real runtime behavior exists
- add runtime integration tests only once the plugin starts invoking the CLI
