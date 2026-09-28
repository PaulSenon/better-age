# Pre-V2 on-disk fixtures

Real artifacts written by the pre-V2 core (`main@fd21004`, Effect v3) with real
age crypto. V2 must read them unchanged (no migration). Test-only secrets:

- `alice-home/`: home state v2, current key + one retired key (rotated after the
  last payload write), known identity `owner_bob` aliased `bobby`.
  Passphrase: `alice passphrase`.
- `bob-home/`: fresh home. Passphrase: `bob passphrase`.
- `.env.enc`: payload `payload_fixture`, recipients Alice (stale, pre-rotation
  key) and Bob. Text: `API_TOKEN=fixture-secret\n# comment\n`.
- `identity-strings.json`: exported identity strings (Alice post-rotation, Bob).
