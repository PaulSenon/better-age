# Manual QA

Use after `pnpm check` and `pnpm test` pass.

## Identity And Key Interop

```sh
bage setup --name Isaac
bage identity export
bage identity list
bage identity keys
bage identity keys --current --path
```

Expected:

- `identity export` prints only one identity string to stdout.
- `identity keys` shows current and retired key sections.
- `identity keys --current --path` prints only the current local key path, one line, stdout only.
- The printed key path can be passed to `age -d -i`.

## Payload Interop

```sh
bage create .env.enc
bage load .env.enc --protocol-version=1
sed -n '/^-----BEGIN AGE ENCRYPTED FILE-----$/,/^-----END AGE ENCRYPTED FILE-----$/p' .env.enc \
  | age -d -i "$(bage identity keys --current --path)"
```

Expected:

- `load` prints raw `.env` content only.
- Direct `age -d .env.enc` is not expected to work because Better Age keeps its wrapper.
- Extracting the inner age block decrypts for transparency and returns Better Age payload plaintext, not raw `.env`.

## Rotation And Retired Keys

```sh
bage identity rotate
bage identity list
bage identity keys
bage view .env.enc
bage update .env.enc
```

Expected:

- `identity list` and `identity keys` show the old fingerprint as retired.
- Existing payloads remain decryptable using current first, then retired keys.
- `update` refreshes stale self recipient state when needed.
