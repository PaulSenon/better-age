# Integration Tests

Integration tests verify real source-level composition.

Allowed:
- real Effect layers
- real adapter implementations
- in-memory or temp isolated persistence
- real crypto when useful

Not allowed:
- built CLI artifact coupling
- user-interaction contract assertions
- broad shared fixtures outside this subtree
