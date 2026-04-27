# Plan: Age Key And Interop Transparency

> Source PRD: `.llms/projects/8-age-key-and-interop-transparency/1-PRD_AGE_KEY_AND_INTEROP_TRANSPARENCY.md`

## Architectural decisions

- **Key plaintext format**: after passphrase decryption, Better Age key files use age-compatible identity-file text with a required Better Age metadata comment.
- **Internal key model**: keep the existing internal private key object. This work is a codec swap, not a domain rewrite.
- **Compatibility policy**: no migration from pre-release JSON key plaintext. Old JSON plaintext is treated as a corrupt key file.
- **Key storage layout**: keep flat `keys/<fingerprint>.age` files. No retired subfolder, symlink, or pointer file.
- **Key role authority**: Home State remains the authority for current vs retired key role.
- **Command surface**: add exact `identity keys` with `--current`, `--retired`, and `--path`. Keep `identity list` unchanged.
- **Payload format**: keep the current Payload File Envelope. Document ad-hoc extraction for age CLI interop.
- **Decrypt order**: preserve current-first then retired-key loop.
- **Passphrase change**: preserve all-key rewrite and key transaction behavior.

---

## Phase 1: Age-Compatible Key Codec

**User stories**: 1, 2, 3, 4, 5, 17, 21, 22

### What to build

Replace the key plaintext codec so Better Age writes and reads age-compatible identity-file text while reconstructing the same internal private key object. The parser must require the metadata comment, allow comments, reject extra identity lines, reject old JSON plaintext, and validate metadata against the real age identity.

### Acceptance criteria

- [ ] New key plaintext encodes as `# better-age-key-metadata/v1 <base64url-json>` plus one age identity line.
- [ ] Decoding valid encoded key plaintext returns the same internal private key object.
- [ ] Metadata includes kind, version, owner id, public key, fingerprint, and created-at.
- [ ] Missing metadata, malformed metadata, old JSON plaintext, extra identity lines, and metadata/key mismatch fail as invalid private key.
- [ ] Wrong passphrase still fails as wrong passphrase, not invalid private key.
- [ ] Unit tests cover codec round trip and rejection cases.

---

## Phase 2: Lifecycle Preservation

**User stories**: 6, 18, 19, 20

### What to build

Prove the codec swap preserves existing key lifecycle behavior end to end: setup creates a usable key, payload decrypt tries current first then retired keys, rotation retires the old key without moving files, and passphrase change re-encrypts all current and retired keys through the existing transaction.

### Acceptance criteria

- [ ] Setup writes key refs under flat `keys/<fingerprint>.age`.
- [ ] Rotation keeps flat key refs and does not introduce retired folders, symlinks, or pointer files.
- [ ] Payload decrypt still tries current key first and then retired keys.
- [ ] Corrupt retired keys still produce retired-key warnings without blaming the passphrase.
- [ ] Passphrase change still rewrites all current and retired keys, verifies replacements, and commits all-or-nothing.
- [ ] Real adapter integration proves Better Age-created keys remain usable for payload round trips.

---

## Phase 3: Identity Keys Command

**User stories**: 7, 8, 9, 10, 11, 12, 13, 14

### What to build

Add an exact `identity keys` command that exposes local key paths for transparency and age CLI interop. It should list current and retired keys by default, support current/retired filters, support path-only machine output, and appear in the interactive identities menu without changing `identity list`.

### Acceptance criteria

- [ ] `bage identity keys` prints human-readable current and retired key entries.
- [ ] `bage identity keys --current --path` prints only the absolute current key path to stdout.
- [ ] `bage identity keys --retired --path` prints only absolute retired key paths to stdout.
- [ ] `bage identity keys --path` prints absolute current path first, then retired paths.
- [ ] `--current --retired` is rejected as ambiguous.
- [ ] Success output has empty stderr.
- [ ] `identity list` output remains unchanged.
- [ ] Interactive identities menu includes `identity keys`.

---

## Phase 4: Interop Documentation

**User stories**: 15, 16, 23

### What to build

Document the transparency workflow: use `identity keys --current --path` for the current key path, then extract the inner age armor from a Better Age payload with `sed` or `awk` and pipe it to `age -d`. Clarify that payload files intentionally keep the Better Age wrapper, and plain age decrypt output is Better Age payload plaintext structure, not raw `.env`.

### Acceptance criteria

- [ ] CLI docs explain age-compatible local key files.
- [ ] CLI docs explain that the payload wrapper is intentionally retained.
- [ ] Docs include the `sed` extraction command.
- [ ] Docs include the `awk` extraction command.
- [ ] Docs show the `age -d -i "$(bage identity keys --current --path)"` workflow.
- [ ] Docs state that `bage load` remains the command for raw `.env` stdout.
- [ ] Docs contract tests cover the required interop sections or snippets.

---

## Phase 5: Release Readiness Sweep

**User stories**: 1-23

### What to build

Run a focused release-readiness sweep over the interop feature: update package README references, verify command help text, ensure presenter/error messages remain consistent, and confirm no pre-release migration language implies old JSON key support.

### Acceptance criteria

- [ ] Command help includes `identity keys` and its options.
- [ ] No docs promise migration from old JSON key plaintext.
- [ ] Error copy treats unsupported old key plaintext as invalid/corrupt local key.
- [ ] Existing payload, identity, rotate, passphrase, and varlock behaviors remain unchanged.
- [ ] Full repo check/test commands are identified for the final verification pass.
