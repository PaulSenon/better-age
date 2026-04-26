# @better-age/cli

Release-facing `bage` CLI for Better Age.

Responsibilities:

- exact and guided command execution
- interactive/headless terminal policy
- hidden passphrase prompts
- editor, secure viewer, and picker flows
- human stderr presentation
- clean machine stdout for `load` and `identity export`

## Install / Build

Install workspace dependencies from the repository root:

```sh
pnpm install
```

Build the standalone CLI artifact:

```sh
pnpm -F @better-age/cli build
```

Build output:

```txt
packages/cli/dist/bage
```

The package `bin` points to that standalone bundled file.

## Command List

```txt
bage create [payload]
bage edit [payload]
bage grant [payload] [identity-ref]
bage inspect [payload]
bage load [payload] --protocol-version=1
bage revoke [payload] [identity-ref]
bage update [payload]
bage view [payload]

bage identity export
bage identity forget [identity-ref]
bage identity import [identity-string] [--alias <alias>] [--trust-key-update]
bage identity list
bage identity passphrase
bage identity pass
bage identity pw
bage identity rotate

bage setup [--name <display-name>]
bage interactive
bage i
```

Promptable operands are optional in the grammar. In an interactive terminal,
missing payloads, identities, and setup names can be requested by the command
flow. Protocol inputs stay strict; `load` requires `--protocol-version=1`.

Command grammar, help, and parser errors are owned by `@effect/cli`. Normal
interactive prompts are backed by `@inquirer/prompts`; custom terminal handling
is limited to the secure viewer and final stdout/stderr writing.

## Examples

```sh
bage setup --name Isaac
bage create .env.prod.enc
bage edit .env.prod.enc
bage identity import 'better-age://identity/v1/...' --alias ops
bage identity import 'better-age://identity/v1/...' --trust-key-update
bage grant .env.prod.enc ops
bage inspect .env.prod.enc
bage view .env.prod.enc
bage load .env.prod.enc --protocol-version=1
```

Interactive launcher:

```sh
bage interactive
```

## Machine Output Policy

- `bage load --protocol-version=1 <payload>` writes raw `.env` text to stdout.
- `bage identity export` writes the public identity string to stdout.
- Prompts, warnings, errors, success messages, viewer UI, and editor UI are not
  written to stdout.
- Human output goes to stderr and may use ANSI color when stderr is a TTY.
- `NO_COLOR` disables ANSI color.

## Runtime Behavior

- Passphrases are prompted only in interactive terminals. Prompt input is hidden
  without echoing mask characters, so passphrase length is not displayed.
- New passphrases must be at least 8 characters.
- Headless payload reads fail fast because MVP has no passphrase injection
  mechanism.
- Missing existing payload paths discover `.env.enc` and `.env.*.enc` in the current directory.
- Payload creation suggests `.env.enc`; collisions offer Override, Change Name,
  and Cancel in interactive mode.
- Grant merges payload recipients, known identities, aliases, and self into one
  picker. Self and already granted identities are visible but disabled.
- Grant can import a pasted identity string before granting it.
- Revoke lists only actual payload recipients and never offers arbitrary identity
  string entry.
- `identity forget` lists known identities only and never changes payload files.
- Guided identity import retries invalid strings and duplicate aliases.
- Reimporting a known owner with a changed public key requires explicit trust.
  Interactive mode asks for confirmation with old/new fingerprints; exact mode
  requires `--trust-key-update`.
- Recoverable prompt-loop feedback, such as wrong passphrases or invalid edited
  `.env` content, is printed immediately in interactive sessions instead of
  being buffered until the command returns to the menu.
- `edit` resolves `$VISUAL`, then `$EDITOR`, then remembered editor preference,
  then interactive editor picker.
- External editor mode necessarily writes plaintext to a private temp file while
  the editor runs. Better Age uses a private temp directory, a random temp file
  name, `0600` file permissions, and deletes the file afterward, but editor
  swap files, backups, crash recovery, plugins, or shell tooling can still leave
  residual plaintext outside Better Age's control.
- Invalid edited `.env` content logs the validation failure, then offers Reopen
  Editor or Cancel while preserving the edited text for retry.
- `view` uses an in-process secure viewer with keyboard scrolling and quit.
  Control characters are rendered visibly, not interpreted by the terminal.
- `interactive` opens a setup-aware menu loop. It excludes `load` and
  `interactive` from menus.

## Local Security And Durability

- Home state and encrypted private key files are written under private
  filesystem permissions where supported.
- Loose home/key permissions are repaired before use and surfaced as notices.
- Private key refs are constrained to `keys/<safe-name>.age`.
- Passphrase changes prepare and verify all replacement key blobs before
  committing. A transaction marker lets the next read recover if a crash
  interrupts the replace.
- Payload writes encrypt and verify in memory, then write the encrypted wrapper
  to `<payload>.tmp` in the same directory and rename it over the target.
  Cleanup removes the temp file on failure when possible.
- Human-rendered identity/display text is sanitized before terminal output.

## Payload File Format

Payload files are readable wrapper files around untouched age armor:

```txt
# better-age encrypted env payload
# Docs: https://github.com/better-age/better-age
# This file is safe to commit only if your policy allows encrypted secrets.
# Do not edit the armored block manually.

-----BEGIN BETTER AGE PAYLOAD-----
-----BEGIN AGE ENCRYPTED FILE-----
...
-----END AGE ENCRYPTED FILE-----
-----END BETTER AGE PAYLOAD-----
```

`load`, `view`, `inspect`, and write commands extract the inner age armor before
decrypting. Missing, duplicated, malformed, or non-age-armored Better Age blocks
fail clearly.

## Known Limitations

- Docker and pseudo-TTY E2E are deferred.
- Interactive terminal behavior is covered by unit/contract tests plus the
  repository manual QA checklist.
- The MVP targets Unix-like terminals.
- Headless secret injection is out of scope.

## Development

```sh
pnpm -F @better-age/cli test
pnpm -F @better-age/cli check
pnpm -F @better-age/cli build
```

Manual QA:

- [../../docs/manual-qa.md](../../docs/manual-qa.md)

Implementation plan source:

- [../../.llms/projects/4-cli-core-boundary-hardening/plans/runtime-cli-release-readiness.md](../../.llms/projects/4-cli-core-boundary-hardening/plans/runtime-cli-release-readiness.md)
