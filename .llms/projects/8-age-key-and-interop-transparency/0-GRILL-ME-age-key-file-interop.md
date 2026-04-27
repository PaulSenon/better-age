# Age Key File Interop Grill

## Decision 1

Question: Should pre-release JSON key files be migrated or replaced by a breaking redesign?

Answer: Breaking redesign. CLI has not been released, so old JSON key plaintext does not need compatibility support.

Consequences:
- Local key file is not a migratable artifact for this change.
- Only new age-compatible key plaintext format is supported.
- Old JSON key plaintext may fail as invalid local key.
- No import of existing external age keys for now.

## Decision 2

Question: Should metadata comments be optional for imported/manual age keys?

Answer: No import of existing age keys for now. Better Age-created key files should use the canonical metadata comment format.

## Decision 3

Question: Should this change alter internal key-domain logic or only at-rest serialization?

Answer: Codec-only change. Keep the internal `PrivateKeyPlaintext` object and current core logic unchanged. Replace only key plaintext encode/decode semantics so decrypted key text reconstructs the same internal object from an age-compatible identity-file text.

Consequences:
- `IdentityCryptoPort.decryptPrivateKey({ encryptedKey, passphrase })` can keep its current shape.
- Existing current-first then retired-loop decrypt behavior stays.
- Existing passphrase change logic still decrypts all keys, re-protects all keys, verifies replacements, then commits through the key transaction.
- Payload crypto can keep using `.privateKey`.

## Decision 4

Question: Should retired keys move into `keys/retired/`?

Answer: No. Keep flat fingerprint-addressed key files to avoid expanding rotation into a multi-resource transaction. Do not introduce symlink/pointer state for now.

Consequences:
- Current key and retired keys stay under `keys/<fingerprint>.age`.
- Home State remains authority for current vs retired role.
- Rotation and passphrase-change transaction model remain narrow.

## Decision 5

Question: How should users discover the current key path for age interop?

Answer: Add `identity keys` command. Keep `identity list` unchanged and identity-focused.

Consequences:
- `identity keys` is exact/non-guided for now.
- `identity keys` should be reachable from the interactive identities menu.
- It can later grow into an interactive key browser.

## Decision 6

Question: What exact `identity keys` MVP API should exist?

Answer:
- `bage identity keys`
- `bage identity keys --current --path`
- `bage identity keys --retired --path`
- `bage identity keys --path`

Rules:
- no positional args
- no passphrase
- default human output lists current and retired key paths
- `--current` filters current only
- `--retired` filters retired only
- `--current --retired` invalid
- `--path` writes absolute paths only to stdout, one per line
- no stderr on success
- no `--json` for now

## Decision 7

Question: What exact age-compatible key plaintext format should Better Age write?

Answer:

```txt
# better-age-key-metadata/v1 <base64url-json>
AGE-SECRET-KEY-PQ-1...
```

Decoded metadata:

```json
{
  "kind": "better-age/key-metadata",
  "version": 1,
  "ownerId": "owner_123",
  "publicKey": "age1pq...",
  "fingerprint": "fp_...",
  "createdAt": "2026-04-27T00:00:00.000Z"
}
```

Rules:
- metadata comment must be first non-empty line
- private key must be first non-empty non-comment line after metadata
- extra comments allowed after metadata
- extra identity lines invalid
- missing metadata invalid
- metadata is base64url JSON, not raw inline JSON
- decode(encode(key)) returns the same internal `PrivateKeyPlaintext`

## Decision 8

Question: Should metadata be verified against the age identity line?

Answer: Yes.

Rules:
- syntax parse may remain sync
- `createAgeIdentityCrypto.decryptPrivateKey` verifies `age.identityToRecipient(privateKeyLine) === metadata.publicKey`
- also verify `fingerprintFromPublicKey(metadata.publicKey) === metadata.fingerprint`
- verification failure maps to `PRIVATE_KEY_INVALID`

## Decision 9

Question: Should old JSON key plaintext be supported by passphrase change or migration?

Answer: No. Full breaking change is acceptable because the CLI has not been released.

Consequences:
- No migration from previous JSON key plaintext.
- Passphrase change keeps existing path/name transaction logic.
- Passphrase change still decrypts/decodes each key, re-protects each key with the next passphrase, verifies each replacement, then commits all-or-nothing.

## Decision 10

Question: What error should old JSON key plaintext produce?

Answer: Treat it as a corrupt local key file.

Rules:
- old JSON plaintext -> `PRIVATE_KEY_INVALID`
- malformed age-compatible plaintext -> `PRIVATE_KEY_INVALID`
- metadata/key mismatch -> `PRIVATE_KEY_INVALID`
- wrong passphrase remains `PASSPHRASE_INCORRECT`
- no new error code for pre-release format break

## Decision 11

Question: Should payload file format change for direct `age` CLI interop?

Answer: No. Keep the current Payload File Envelope.

Consequences:
- Better Age payload files still contain comments and `BETTER AGE PAYLOAD` wrapper.
- Direct `age -d payload` is not expected to work.
- Documentation should show ad-hoc extraction for transparency:

```sh
sed -n '/^-----BEGIN AGE ENCRYPTED FILE-----$/,/^-----END AGE ENCRYPTED FILE-----$/p' .env.enc \
  | age -d -i "$(bage identity keys --current --path)"
```

```sh
awk '
  /^-----BEGIN AGE ENCRYPTED FILE-----$/ { on=1 }
  on { print }
  /^-----END AGE ENCRYPTED FILE-----$/ { on=0 }
' .env.enc | age -d -i "$(bage identity keys --current --path)"
```
