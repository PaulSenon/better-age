# PRD: Age Key And Interop Transparency

## Problem Statement

Better Age is built around age encryption, but its local private key files currently decrypt to Better Age JSON instead of age identity-file plaintext. This breaks a core transparency goal: a user should be able to inspect the system and, with minimal shell plumbing, prove that Better Age payloads are ordinary age-encrypted data protected by ordinary age identities.

The CLI has not been released yet, so the current key file plaintext format can be replaced with a breaking redesign instead of carrying a compatibility layer. The payload file wrapper should stay because it provides Better Age-specific UX and context, but the project should document simple ad-hoc extraction commands for users who want to feed the inner age armor to the age CLI.

## Solution

Better Age will keep its internal private key domain object and lifecycle logic, but change the at-rest private key plaintext codec. After passphrase decryption, a Better Age-created key file will be an age-compatible identity-file text:

```txt
# better-age-key-metadata/v1 <base64url-json>
AGE-SECRET-KEY-PQ-1...
```

The metadata comment lets Better Age reconstruct the same internal private key object it uses today, while age ignores the comment and reads the raw identity line. Better Age will verify that the age identity derives to the metadata public key and fingerprint before accepting it.

The existing flat key file layout remains. Current and retired keys stay under `keys/<fingerprint>.age`; Home State remains the authority for current vs retired status. A new `identity keys` command exposes current and retired key paths for transparency and age CLI interop without introducing symlinks, pointer files, or retired subfolders.

Payload files keep their existing Better Age wrapper. Documentation will show `sed` and `awk` snippets that extract the inner age armored block and pipe it to `age -d`.

## User Stories

1. As a Better Age user, I want local key files to be readable by the age CLI after passphrase unlock, so that I can independently verify Better Age is using standard age identities.
2. As a Better Age user, I want Better Age-created keys to include metadata in age-compatible comments, so that Better Age can keep its current UX metadata without breaking age interop.
3. As a Better Age user, I want malformed key metadata to be rejected, so that corrupt local key files are not silently accepted.
4. As a Better Age user, I want metadata to be verified against the actual age identity line, so that key files cannot accidentally lie about their public key.
5. As a Better Age user, I want old pre-release JSON key files to fail like corrupt key files, so that the unreleased format break does not create long-term migration debt.
6. As a Better Age user, I want current and retired keys to keep stable fingerprint-based file names, so that rotation and passphrase changes remain simple and durable.
7. As a Better Age user, I want a command that prints my current key path, so that I can pass it to `age -i` without reading Home State manually.
8. As a Better Age user, I want a command that lists retired key paths too, so that I can manually decrypt old payloads or debug stale payload access.
9. As a Better Age user, I want `identity keys --path` to output only file paths, so that it is safe to use in shell substitution.
10. As a Better Age user, I want `identity keys` to have human-readable output by default, so that I can understand current and retired local key files.
11. As a Better Age user, I want `identity keys --current --path` to print exactly the current key path, so that the common age CLI interop command is short.
12. As a Better Age user, I want `identity keys --retired --path` to print retired key paths, so that I can inspect or debug rotated-key payloads.
13. As a Better Age user, I want `identity keys --current --retired` to be invalid, so that command intent stays unambiguous.
14. As an interactive CLI user, I want the identities menu to expose key listing, so that transparency tools are discoverable from interactive mode.
15. As a Better Age user, I want payload files to keep their Better Age wrapper, so that the encrypted file remains self-describing.
16. As a Better Age user, I want documentation for extracting the inner age armor, so that I can still decrypt with plain age when I need transparency.
17. As a maintainer, I want the internal key object to remain unchanged, so that this work is a codec swap rather than a domain rewrite.
18. As a maintainer, I want current-first then retired-key decrypt behavior to remain unchanged, so that stale payload access semantics do not regress.
19. As a maintainer, I want passphrase change to keep re-encrypting all current and retired keys through the existing key transaction, so that durability stays intact.
20. As a maintainer, I want key storage paths to remain flat, so that rotation does not become a multi-resource transaction.
21. As a maintainer, I want tests proving age-compatible key plaintext, so that future refactors do not reintroduce JSON-only key files.
22. As a maintainer, I want tests proving old JSON key plaintext is invalid, so that pre-release compatibility does not creep back in accidentally.
23. As a maintainer, I want docs that frame payload interop as explicit extraction, so that users understand why direct `age -d .env.enc` is not expected.

## Implementation Decisions

- This is a breaking pre-release redesign. No migration from the old JSON key plaintext format will be implemented.
- The internal private key object remains unchanged. Better Age continues to use owner id, public key, private key, fingerprint, and creation time internally.
- The key plaintext codec changes from JSON to an age-compatible identity-file text with a required Better Age metadata comment.
- Metadata is encoded as base64url JSON in the first non-empty line using the marker `# better-age-key-metadata/v1`.
- The first non-empty non-comment line after metadata is the only permitted age identity line.
- Extra comments are allowed after metadata. Extra identity lines are invalid.
- The decoded metadata contains `kind`, `version`, `ownerId`, `publicKey`, `fingerprint`, and `createdAt`.
- The age identity line must derive to the metadata public key. The metadata public key must derive to the metadata fingerprint.
- Invalid old JSON key plaintext, missing metadata, malformed metadata, metadata mismatch, and malformed identity text all map to the existing corrupt-key failure.
- Wrong passphrase remains the existing wrong-passphrase failure.
- Key file paths remain flat under `keys/<fingerprint>.age`.
- Retired keys do not move into a `retired` folder.
- No symlink or pointer file is introduced for current key lookup.
- Home State remains the authority for current vs retired key role.
- The `identity list` command remains identity-focused and unchanged.
- A new `identity keys` command lists local key files.
- `identity keys` supports `--current`, `--retired`, and `--path`.
- `identity keys --path` writes absolute paths only to stdout, one per line, with empty stderr on success.
- `identity keys --current --retired` is invalid.
- `identity keys` is exact/non-guided for now but appears in the interactive identities menu.
- Payload file format remains unchanged.
- Documentation will show `sed` and `awk` examples that extract the inner age armor before passing it to the age CLI.

## Testing Decisions

- Codec tests should treat key plaintext parsing and encoding as an isolated deep module. They should assert external behavior: accepted text, rejected text, round-trip shape, and metadata validation.
- Real adapter tests should prove that a Better Age-created encrypted key decrypts to age-compatible identity-file text and still works for payload round trips.
- Core identity lifecycle tests should continue proving create, rotate, verify passphrase, and passphrase change behavior.
- Payload lifecycle tests should continue proving current-first then retired-key decrypt behavior, stale self-recipient warnings, and corrupt retired-key notices.
- CLI command tests should cover `identity keys`, filters, path-only stdout, invalid filter combinations, and interactive menu discovery.
- Docs tests should cover the interop documentation snippets or at least required sections describing age key and payload interop.
- Tests should avoid asserting implementation details such as private helper names. The durable contract is the file format, command output contract, and key lifecycle behavior.

## Out of Scope

- Importing existing external age identity files.
- Migrating old pre-release JSON key plaintext.
- Moving retired keys into a subfolder.
- Adding symlinks or pointer files for current key lookup.
- Changing the payload file wrapper.
- Making `age -d .env.enc` work directly on Better Age-wrapped payload files.
- Adding JSON output to `identity keys`.
- Adding a guided key browser beyond making `identity keys` reachable from the interactive identities menu.
- Changing identity strings, known identity import, or recipient grant/revoke semantics.

## Further Notes

The transparency workflow should be documented as:

```sh
bage identity keys --current --path
```

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

The age CLI output will be the decrypted Better Age payload plaintext structure, not raw `.env` text. Raw `.env` remains the responsibility of `bage load`.
