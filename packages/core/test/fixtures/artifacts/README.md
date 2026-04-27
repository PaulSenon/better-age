# Artifact Fixtures

Fixtures in this directory are canonical persistence examples for core tests.

- `v1.ts`: valid current v1 documents for every artifact type.
- Prototype schemas are intentionally absent. Compatibility starts at v1 for the rebuild.
- Future-version, wrong-kind, malformed-version, and missing-field cases are generated in tests from these valid fixtures.
