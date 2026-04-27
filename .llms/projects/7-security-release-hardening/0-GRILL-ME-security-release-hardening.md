# Security Release Hardening Grill Log

Append-only grilling log for deciding what from the security review blocks the MVP release, what becomes a near-term hardening plan, and what belongs to a larger identity-trust project.

## 2026-04-26 - Session Opened

Source report: "Better Age CLI/Core Security Review Report"

Scope under discussion:
- `packages/core`
- `packages/cli`
- `packages/varlock`
- Excludes `packages/cli-legacy`

Current stance:
- Do not implement yet.
- First clarify release gate and project split.
- Preserve audit nuance: some issues are release blockers, some are security hardening, some are larger architecture/trust model work.

Initial triage buckets:

### Release-Blocking Safety

- Passphrase change must become all-or-nothing.
- Corrupt home state/artifacts must map to typed, user-readable failures.
- Passphrase prompt must not leak length.
- Private key/home filesystem permissions must be strict.
- Secure viewer must sanitize terminal control characters.
- Editor temp files must be hardened and risk documented.
- Weak/empty passphrases should be rejected.
- Varlock must not memoize failed load promises.
- Failure presentation should not hide meaningful known failure codes.
- Core should remove nondeterministic `Date.now()` payload id fallback.

### Security-Hardening Candidate

- Payload writes should verify encrypted output can decrypt/parse before replace.
- Retired key corruption should not unnecessarily block current payload reads, but corruption must remain visible somehow.
- Varlock custom launcher shell path should remain trusted-local only or later become structured command/args config.

### Separate Identity-Trust Project

- Unsigned identity update is the major trust-model gap.
- Existing spec: `.llms/projects/6-identity-signing-continuity/0-IDENTITY_SIGNING_CONTINUITY_SPEC.md`
- Likely not a tiny patch: owner id derivation, V2 identity strings, signing key protection, migration/compatibility decisions.
- Short-term fallback may be explicit trust confirmation for same-owner key changes.

First unresolved decision:
- Does MVP release block on full signed Identity V2, or can MVP ship with explicit unsigned/TOFU semantics plus a hard trust gate for owner key changes?

## 2026-04-26 - Decision: Identity V2 Out Of Current Scope

User decision:
- Full signed Identity V2 is out of scope for this release-hardening pass.
- A small explicit trust gate for updating identities is acceptable only if it fits the current architecture cleanly.

Working implication:
- Treat current identity strings as V1 unsigned / TOFU.
- Do not redesign owner id derivation, signing keys, identity string format, or payload recipient migration in this pass.
- If feasible, add a V1 guard for same-owner recipient/key changes:
  - interactive: show old/new compact fingerprints and ask for explicit trust
  - headless/exact: require an explicit trust flag or fail
- If this does not fit cleanly, defer it rather than contort the current architecture.

Next unresolved decision:
- What exact all-or-nothing storage contract should `changeIdentityPassphrase` use?

## 2026-04-26 - Constraint: Stable Key Paths, No Deferred GC

User correction:
- Fresh key generation directories are not acceptable as the default plan.
- There is no garbage collector, so we should not create trash that depends on future cleanup.
- The main key path should remain stable.
- Prefer a flow that does not mutate home state for passphrase changes if possible.
- Cleanup can exist inside the passphrase-change flow, but not as vague future GC.

Design pressure:
- Atomic replacement of multiple independent files is not truly all-or-nothing without either:
  - an indirection pointer/manifest update,
  - a recovery transaction protocol,
  - or collapsing the rewritten state into a single atomically replaced artifact.

Current preferred direction to evaluate:
- Store passphrase-protected local private keys in one stable keyring artifact and atomically replace that artifact.
- Keep home state stable during passphrase changes.
- Avoid generation directories and deferred GC.

## 2026-04-26 - Constraint: No Keyring Wrapper

User correction:
- A single encrypted keyring artifact is not acceptable.
- Each individual age private key must remain an age-protected key file.
- Better Age should not add its own local private-key bundle format on top of age for this path.
- Interoperability with age-protected identity files is a hard constraint.

Updated constraint set:
- Stable final key paths.
- No deferred GC/trash.
- No keyring wrapper.
- Individual key files remain age-encrypted artifacts.
- Passphrase change must avoid visible mixed old/new keysets.

Implication:
- True multi-file atomicity is impossible with only direct replacement of N stable files.
- The viable design is a bounded recovery transaction:
  - prepare every new file beside the stable files,
  - write a transaction marker,
  - replace stable files,
  - recover/rollback on startup before using keys,
  - clean transaction artifacts synchronously during success or recovery.

## 2026-04-26 - Direction: Naive Transaction With Recovery, But Ordered Safely

User proposal:
- Do as much as possible in memory first.
- Move old key files to backup names.
- Write/rename new key files one-by-one.
- On ordinary failure, restore backups over any partially migrated keys.
- On crash, detect unfinished passphrase change next time keys are accessed and restore backups.
- If a key has no backup, it was not changed yet.

Accepted direction with ordering tweak:
- Yes, this is the practical transaction/recovery model.
- Safer ordering should prepare every new key file before moving stable files:
  1. decrypt all old keys in memory
  2. re-encrypt all with new passphrase in memory
  3. verify new encrypted blobs decrypt with new passphrase
  4. write every `*.new` file with `0600`
  5. write transaction marker listing stable/new/backup paths
  6. rename stable files to `*.bak`
  7. rename `*.new` files to stable paths
  8. verify final stable files
  9. delete backups and marker
- This avoids mutating stable keys until disk/permission/path errors for new files are already passed.

Recovery rule:
- Before any key read, if transaction marker exists:
  - restore any `*.bak` over corresponding stable path
  - remove any `*.new`
  - remove transaction marker when rollback completes
  - if rollback cannot complete, fail closed with explicit transaction-incomplete error and remediation

Open detail:
- Exact marker file shape and recovery error code naming.

## 2026-04-26 - Decision: Passphrase Change Transaction Contract

Decision:
- Use a bounded backup/restore transaction for local private-key passphrase changes.
- Keep individual age-encrypted key files.
- Keep stable final key paths.
- Do not introduce a keyring wrapper.
- Do not introduce generation directories or deferred GC.

Canonical flow:

```txt
changeIdentityPassphrase(oldPassphrase, newPassphrase)

preflight:
  recover unfinished passphrase-change transaction if marker exists

prepare:
  read all stable key files referenced by home state
  decrypt all with old passphrase
  re-encrypt all with new passphrase in memory
  verify all new encrypted blobs decrypt with new passphrase
  write every <stable>.new with mode 0600

commit:
  write transaction marker listing each stable/new/backup path
  rename each stable path to <stable>.bak
  rename each <stable>.new to stable path
  verify all stable files decrypt with new passphrase

cleanup:
  delete every <stable>.bak
  delete transaction marker
```

Recovery before any key read:

```txt
if transaction marker exists:
  for each key entry:
    if backup exists:
      rename backup back to stable path, replacing any partially migrated stable path
    delete leftover new path if present
  delete marker
  if rollback cannot complete:
    fail closed with a typed recovery error and remediation
```

Design rationale:
- Multi-file atomic commit is impossible without a pointer/manifest or wrapper format.
- This design is practical, explicit, and recoverable.
- It preserves age interoperability and final stable paths.
- It avoids hidden trash by cleaning synchronously or during mandatory recovery.

Next unresolved decision:
- Which corrupt-state/artifact failures should core expose as typed errors, and where should CLI map them?

## 2026-04-26 - Clarification: Corrupt-State Error Topic Comes From Report Item 2

User challenged why corrupt-state errors are a topic and re-pasted the audit report.

Clarification:
- This topic comes directly from report item 2: "Corrupt home state crashes CLI".
- Report-suggested codes:
  - `HOME_STATE_INVALID`
  - `PRIVATE_KEY_INVALID`
  - `ARTIFACT_UNSUPPORTED_VERSION`
- The only additional proposed code is `KEY_TRANSACTION_INCOMPLETE`, introduced by the accepted passphrase-change transaction/recovery design.

Decision still needed:
- Whether to keep `KEY_TRANSACTION_INCOMPLETE` as its own explicit failure code, or fold it into a broader storage/corrupt-state failure.

## 2026-04-26 - Decision: Add Explicit Key Transaction Error

Decision:
- Add `KEY_TRANSACTION_INCOMPLETE` as an explicit typed failure.

Failure meaning:
- A local key-file transaction marker exists, but automatic rollback/cleanup cannot safely complete.
- Core must fail closed before using possibly mixed or corrupted private-key files.

Expected CLI behavior:
- Render a stable, user-readable error.
- No stack trace.
- Include remediation pointing to passphrase-change transaction recovery / manual key backup inspection.

Corrupt artifact failure set for this hardening pass:
- `HOME_STATE_INVALID`
- `PRIVATE_KEY_INVALID`
- `ARTIFACT_UNSUPPORTED_VERSION`
- `KEY_TRANSACTION_INCOMPLETE`

Next unresolved decision:
- Secret prompt should use custom no-echo prompt or Inquirer password with no mask?

## 2026-04-26 - Decision: Keep Inquirer For Secret Prompt, Disable Mask

User correction:
- Do not implement custom secret input ourselves.
- We chose state-of-the-art prompt primitives; keep using Inquirer for passphrases.
- Inquirer likely has an option to avoid the visible `*` mask.

Verification:
- Installed `@inquirer/password` docs say it supports masked or transparent modes.
- Its config type is `mask?: boolean | string`.
- Runtime renders repeated mask characters only when `config.mask` is truthy.
- Therefore `password({ message, mask: false })` keeps input transparent/no visible length echo.

Decision:
- Keep `@inquirer/prompts` password prompt.
- Configure passphrase prompts with `mask: false`.
- Do not use custom `readHiddenSecret` for normal passphrase prompts.
- Keep cancellation mapping to `CANCELLED` exit 130.

Implementation note:
- Current `NodePromptFunctions.password` type is too narrow (`mask: string`); it should allow `boolean | string` or only the adapter should own the exact Inquirer config.

Next unresolved decision:
- Filesystem permissions: fail hard or warn/repair when existing home dir/key files have loose permissions?

## 2026-04-26 - Decision: Filesystem Permissions Auto-Repair

Decision:
- New Better Age home directory must be created/chmodded `0700`.
- New private key files and temp files must be written/chmodded `0600`.
- Existing loose home directory should be auto-chmodded to `0700` and emit a warning/notice.
- Existing loose key files should be auto-chmodded to `0600` and emit a warning/notice.
- If chmod/repair fails, fail closed with a typed storage/permission failure.

Rationale:
- Encrypted private key blobs are still high-value offline attack material.
- Auto-repair gives best UX for common local filesystem drift.
- Failing when repair is impossible keeps secret state safe.

Next unresolved decision:
- Secure viewer sanitization: exact display behavior for ANSI/control characters.

## 2026-04-26 - Decision: Secure Viewer Escapes Control Sequences

Decision:
- Secure viewer must not let decrypted payload text control the terminal.
- Viewer renders text for reading only; terminal control sequences are not interpreted.
- Payload content is never mutated by display sanitization.

Display rules:
- Printable text renders normally.
- Newlines remain line breaks.
- ANSI/OSC/control characters render visibly escaped, not executed.
- Prefer visible escape forms such as `\x1b`, `\r`, `\x07`, `\x7f`.

Rationale:
- Stripping can hide suspicious payload content.
- Visible escaping supports audit and avoids terminal manipulation.

Next unresolved decision:
- Editor temp hardening scope: permissions/docs only, or strict editor flags in MVP?

## 2026-04-26 - Decision: MVP Editor Temp Hardening

Decision:
- MVP hardens external-editor plaintext temp files, but does not attempt strict editor mode.

Do now:
- Create dedicated temp directory with `0700`.
- Create plaintext temp file with `0600`.
- Use random temp file names.
- Delete temp file after editor exits.
- Best-effort remove temp directory.
- Document residual risk from swap files, backups, crash recovery, editor plugins, and OS-level temp retention.

Do not do for MVP:
- Strict editor flags for vim/nvim/etc.
- In-process editor.
- Encrypted temp file.

Rationale:
- External editors need plaintext, so encrypted temp files do not solve the risk.
- Strict editor modes are editor-specific and can be added later deliberately.

Next unresolved decision:
- Passphrase policy: exact minimum and hard-fail/warn behavior.

## 2026-04-26 - Decision: Passphrase Policy

Decision:
- Reject empty passphrases.
- Reject passphrases shorter than 8 characters.
- Use hard fail/retry in interactive flows.
- Use hard fail in exact/headless flows.
- No complex strength meter for MVP.
- No warning-only weak passphrase path for MVP.

Applies to:
- `setup` new passphrase.
- `identity passphrase` new passphrase.

Does not change:
- Wrong current-passphrase retry behavior.

Next unresolved decision:
- Payload post-encrypt verification before replacing payload files.

## 2026-04-26 - Constraint: Payload Temp Files Must Not Be User-Visible Churn

User concern:
- Do not leave temp files living beside the encrypted payload path.
- A temp folder may be acceptable only if needed, hidden from normal user workflow, and without unnecessary complexity churn.

Clarification:
- Payload post-encrypt verification itself is in-memory only.
- Temp files are only about the final commit/replace step.
- For atomic replace, POSIX rename must happen on the same filesystem; staging in arbitrary OS temp can lose atomicity or fail with cross-device rename.

Current preferred direction to evaluate:
- Verify encrypted payload fully in memory first.
- Commit encrypted artifact through a hidden staging directory in the target parent, e.g. `<payload-dir>/.better-age-tmp/<random>`.
- Stage only encrypted payload bytes, never plaintext.
- Rename staged encrypted file to final payload path.
- Clean staging dir synchronously/best-effort after success/failure.
- Avoid `<payload>.tmp` sibling files.

## 2026-04-26 - Constraint: No Payload Temp/Staging Files Under User Project

User correction:
- Do not write temp/staging files in cwd or subdirectories near the payload.
- User rejects `.better-age-tmp/` under payload parent.

Technical implication:
- Portable atomic replace of a user payload file normally requires a temporary directory entry on the same filesystem/directory, then rename.
- OS temp directories can be on another filesystem, so rename may not be atomic or may fail cross-device.
- Linux `O_TMPFILE` can create unnamed same-directory temp files, but it is not portable across macOS/all Unix targets.

Revised likely MVP direction:
- Keep payload post-encrypt verification fully in memory.
- Preserve existing write strategy unless it already stages beside target.
- Do not introduce project-local temp/staging files for payloads.
- Document that payload commit is not upgraded to fully atomic replace in this pass, unless we accept platform-specific invisible temp support later.

Next unresolved decision:
- For payload writes, prefer no project-local temp files over portable atomic replace?

## 2026-04-26 - Decision: Payload Verification Only, No Atomic Staging

Decision:
- Add in-memory payload write verification.
- Do not add payload temp/staging files under cwd, payload parent, or subdirectories.
- Do not introduce `.better-age-tmp`.
- Do not introduce `<payload>.tmp`.
- Do not claim fully atomic payload replacement for MVP.

Canonical payload mutation flow:

```txt
prepare:
  build next payload document/plaintext in memory
  encrypt in memory
  decrypt encrypted bytes in memory using expected local key/passphrase
  parse/validate decrypted payload in memory

commit:
  write final encrypted payload using existing/simple write path
```

Rationale:
- Keeps implementation and user workspace clean.
- Catches crypto/serialization bugs before write.
- Does not solve crash/power-loss during final write, by explicit product choice.

Next unresolved decision:
- Retired key corruption: should payload reads skip corrupt retired keys or fail?

## 2026-04-26 - Decision: Lazy Payload Key Decrypt

Decision:
- Payload decrypt/read should try the current key first.
- Only if current key cannot decrypt the payload should core try retired keys.
- Retired keys should be tried one by one.
- A corrupt/missing retired key must not cause a false `PASSPHRASE_INCORRECT`.
- If a retired key cannot be read/decrypted, collect a warning notice.
- If no usable key decrypts the payload, return the appropriate payload decrypt failure.

Rationale:
- A bad retired key should not block current payload access.
- Error semantics must remain truthful.
- Health/status command can come later if needed.

## 2026-04-26 - Remaining Report Items, Proposed Defaults

Accepted-by-default unless later challenged:

- Load protocol: keep as-is conceptually. Require `--protocol-version=1`; plaintext stdout is intentional; warnings/errors stderr only.
- Varlock failed load promise: fix now by memoizing success only or clearing memoized promise on rejection.
- Varlock shell launcher: keep current trusted-local config assumption for MVP; document custom `command` as trusted local config only. Structured `command + args` can be later.
- CLI/core type duplication: clean if it naturally fits hardening work, but do not block release on a broad type architecture refactor.
- Failure presenter unsafe default: fix now. Unknown failures should at least show the code/details if available, not generic "command failed".
- Branded domain IDs: valuable but not a release blocker; defer unless touched locally.
- `Date.now()` payload id fallback: fix now by requiring adapter-provided payload ids for payload-capable core usage.
- Public core node adapter exports: defer split export paths unless trivial; not release blocker.

Open implementation planning need:
- Convert accepted decisions into a small PRD/plan before code.

## 2026-04-26 - PRD And Plan Written

Created:
- `.llms/projects/7-security-release-hardening/1-PRD_SECURITY_RELEASE_HARDENING.md`
- `.llms/projects/7-security-release-hardening/plans/security-release-hardening.md`

V1 identity key-update gate double-check:
- Fits current architecture cleanly enough for this hardening pass.
- Core already centralizes `importKnownIdentity`.
- CLI already owns exact/guided import and grant identity-string flows.
- Proposed shape: core requires explicit trust when same owner id changes public key; interactive CLI prompts and retries; exact/headless requires flag.

Deferred work persisted to backlog:
- Signed Identity V2.
- Structured varlock launcher config.
- Strict editor mode.
- In-process editor.
- Branded domain ids.
- Core export-path split.
- Payload atomic replace with project-local staging remains deferred/rejected for MVP.
