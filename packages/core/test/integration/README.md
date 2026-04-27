# Core Integration Fixtures

Integration tests should prove real adapter behavior only:

- real home/payload file layout
- passphrase-encrypted age identity-file blobs
- age-encrypted payload files
- passphrase change and identity rotation decryptability

Keep exhaustive branch coverage in unit tests with fake ports.
