# Manual QA

Manual QA covers real-terminal behavior (Inquirer redraw-in-place, keyboard
navigation, disabled rows, Ctrl-C, raw-mode viewer, external editor) that unit
tests exercise only through a scripted `Ui`. Run it against the built CLI
before a release; automated checks support it but do not replace it.

Before running:

```sh
pnpm install
pnpm -F @better-age/cli build
export BAGE="$PWD/packages/cli/dist/bage"
# Isolate from your real identity:
export HOME="$(mktemp -d)"
```

Use `"$BAGE" --help` to confirm the build runs.

## Hidden passphrase prompt

- Run `"$BAGE" setup --name QA`.
- Type a passphrase and confirmation.
- Confirm typed characters are hidden and mask characters do not reveal length.
- Confirm passphrases shorter than 8 characters are rejected.
- Type a wrong passphrase during an edit/read flow.
- Confirm the wrong-passphrase error appears before the retry prompt, not after
  returning to the menu.
- Press Ctrl-C during a passphrase prompt.
- Confirm Ctrl-C abort exits cleanly with code 130, does not act like Back, and
  leaves the terminal usable (echo restored, cursor visible).

## Editor launching and remembered preference

- Unset `$VISUAL` and `$EDITOR`.
- Run `"$BAGE" edit <payload>`.
- Confirm the editor picker appears when no remembered editor exists.
- Pick an available editor and choose "Remember".
- Run edit again.
- Confirm the remembered editor opens without re-prompting.
- Set `$VISUAL` to a different available editor.
- Confirm `$VISUAL` wins over remembered preference.
- Confirm the editor opens on a temp file outside the project directory.
- After closing the editor, confirm the Better Age temp dir
  (`$TMPDIR/better-age-edit-*`) is removed.
- Press Ctrl-C while the editor picker is shown; confirm exit 130 and no
  `better-age-edit-*` dir remains.
- Save text that is not `.env` syntax (for example `hello world`); confirm it
  is saved as-is and `load` prints it unchanged.
- Remember residual risk: editor swap files, backups, crash recovery, plugins, or
  shell tooling may still leave plaintext outside Better Age's control.

## Secure viewer scrolling and quit

- Create or use a payload with enough env lines to exceed terminal height.
- Run `"$BAGE" view <payload>`.
- Confirm plaintext appears only in the viewer UI.
- Add a test value containing control characters, for example an ESC or carriage
  return, then view it.
- Confirm controls render visibly, such as `\x1b` or `\r`, and do not affect the
  terminal title, clipboard, cursor, or previous screen.
- Use `j`, `k`, page down, page up, `g`, and `G`.
- Press `q`.
- Confirm the viewer closes, the previous screen is restored, and the shell is
  usable. Repeat and press Ctrl-C instead of `q`: same result.

## Interactive menu loop

- Before setup, run `"$BAGE" interactive`.
- Confirm only setup and quit are shown.
- Confirm menu keyboard navigation works without typing a numeric index.
- Confirm moving selection redraws in place and does not append repeated full
  menu blocks.
- Complete setup.
- Confirm the root menu changes to Files, Identities, and Quit.
- Enter Files; confirm create, edit, grant, inspect, revoke, update, view, back,
  and quit are present.
- Enter Identities; confirm export, import, list, forget, passphrase, rotate,
  back, and quit are present.
- Confirm `load` and `interactive` are not shown in menus.
- Confirm Ctrl-C from any menu or from a prompt inside a command exits the
  whole session with code 130.
- Pick Cancel inside a command picker (e.g. payload picker); confirm
  `[ERROR] CANCELLED` is shown and the session returns to the menu.
- Run one submenu action and confirm the session returns to the menu.
- Confirm immediate interactive feedback: command output appears before quitting
  interactive mode.
- Run identity export from the interactive session.
- Confirm the identity string is visible immediately.
- Confirm the session waits for Enter before returning to the menu.
- Press Ctrl-C from a menu.
- Confirm Ctrl-C abort exits the session and does not navigate Back.

## Guided suggestions

- In a directory with no `.env.enc` or `.env.*.enc` files, run a payload command
  without a path.
- Confirm the command prompts for a custom path.
- In a directory with only `.env.enc`, run a payload command without a path.
- Confirm a keyboard menu appears with the file preselected, Enter Path, and
  Cancel.
- In a directory with `.env.enc` and one or more `.env.*.enc` files, run a
  payload command without a path.
- Confirm a keyboard menu lists each file plus Enter Path and Cancel.
- Run interactive create without a path.
- Confirm `.env.enc` is suggested by default.
- Try creating where the file exists.
- Confirm the collision menu offers Override, Change Name, and Cancel.

## Guided identity flows

- Grant without an identity ref.
- Confirm the picker shows self disabled as `[you]`.
- Confirm already granted recipients are disabled as `[granted]`.
- Confirm disabled rows are visible but cannot be selected.
- Confirm known identities not yet granted are selectable.
- Confirm the picker has Enter identity string and Cancel options.
- Enter an invalid identity string.
- Confirm the error is shown immediately and the flow allows retry or cancel.
- Import an identity with a duplicate alias in guided mode.
- Confirm the error is shown immediately and the flow allows reprompt, skip, or
  cancel.
- Import a known owner id with a changed public key.
- Confirm interactive mode shows old/new `fp_...` fingerprints (not full public
  keys) and requires explicit trust before updating.
- Confirm headless/exact import fails unless `--trust-key-update` is passed.
- Revoke without an identity ref.
- Confirm only payload recipients are listed.
- Confirm revoke does not offer arbitrary identity string entry.

## Payload envelope

- Create or update a payload.
- Open the encrypted payload file in a text editor.
- Confirm explanatory comments are present.
- Confirm the file contains `-----BEGIN BETTER AGE PAYLOAD-----`.
- Confirm the Better Age block wraps an inner `-----BEGIN AGE ENCRYPTED FILE-----`
  block.
- After a create/edit/grant/revoke/update write, confirm no `<payload>.tmp`
  encrypted staging file remains next to the payload.
- Confirm `"$BAGE" load <payload> --protocol-version=1` still
  decrypts the payload.

## Clean stdout for load

```sh
"$BAGE" load <payload> --protocol-version=1 > /tmp/bage.env 2> /tmp/bage.err
```

- Confirm `/tmp/bage.env` contains exactly the payload text.
- Confirm prompts, warnings, and errors are only in `/tmp/bage.err`.

## Clean stdout for identity export

```sh
"$BAGE" identity export > /tmp/bage.identity 2> /tmp/bage.err
```

- Confirm `/tmp/bage.identity` contains only the identity string and newline.
- Confirm `/tmp/bage.err` is empty on success.

## Varlock smoke

- Configure varlock with `@initBetterAge(path=<payload>)`.
- Confirm it shells out through `bage load --protocol-version=1 <path>`.
- Confirm stdin is inherited for passphrase prompt.
- Confirm stderr is inherited for prompt and warnings.
- Confirm stdout is consumed as env text by varlock.
- Force one `bage load` failure in the same varlock process, then retry.
- Confirm the failed load is not cached forever and a later successful load can
  proceed.

## Identity And Key Interop

```sh
"$BAGE" setup --name Isaac
"$BAGE" identity export
"$BAGE" identity list
"$BAGE" identity keys
"$BAGE" identity keys --current --path
```

Expected:

- `identity export` prints only one identity string to stdout.
- `identity keys` shows current and retired key sections.
- `identity keys --current --path` prints only the current local key path, one line, stdout only.
- The printed key path can be passed to `age -d -i`.

## Payload Interop

```sh
"$BAGE" create .env.enc
"$BAGE" load .env.enc --protocol-version=1
sed -n '/^-----BEGIN AGE ENCRYPTED FILE-----$/,/^-----END AGE ENCRYPTED FILE-----$/p' .env.enc \
  | age -d -i "$("$BAGE" identity keys --current --path)"
```

Expected:

- `load` prints raw `.env` content only.
- Direct `age -d .env.enc` is not expected to work because Better Age keeps its wrapper.
- Extracting the inner age block decrypts for transparency and returns Better Age payload plaintext, not raw `.env`.

## Rotation And Retired Keys

```sh
"$BAGE" identity rotate
"$BAGE" identity list
"$BAGE" identity keys
"$BAGE" view .env.enc
"$BAGE" update .env.enc
```

Expected:

- `identity list` and `identity keys` show the old fingerprint as retired.
- Existing payloads remain decryptable using current first, then retired keys.
- `update` refreshes stale self recipient state when needed.

## Permissions and upgrade from a pre-V2 home

- `chmod 755 ~/.better-age` then run `"$BAGE" identity list`; confirm one
  `[WARN] Local file permissions repaired` line and mode `700` afterwards.
- With a home and payload created by the previous release (`@better-age/cli`
  0.0.2), confirm `identity list`, `view`, `load`, `edit`, and `update` work
  with no migration step.
