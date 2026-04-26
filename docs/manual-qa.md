# Manual QA

Manual QA covers terminal behavior that is intentionally not yet covered by
Docker or pseudo-TTY E2E.

Docker and pseudo-TTY E2E are deferred.

Release is blocked until this checklist passes against the built CLI.

Current result: pending human run. Automated checks can support this checklist,
but do not replace it.

This checklist must cover Inquirer-backed redraw-in-place, keyboard navigation,
disabled rows, prompt cancellation, Ctrl-C abort, immediate interactive
feedback, guided suggestions, editor, viewer, payload envelope, and machine
stdout.

Before running:

```sh
pnpm install
pnpm -F @better-age/cli build
```

Use the built CLI:

```sh
packages/cli/dist/bage --help
```

## Hidden passphrase prompt

- Run `packages/cli/dist/bage setup --name QA`.
- Type a passphrase and confirmation.
- Confirm typed characters are hidden or masked by the prompt UI.
- Type a wrong passphrase during an edit/read flow.
- Confirm the wrong-passphrase error appears before the retry prompt, not after
  returning to the menu.
- Press Ctrl-C during a passphrase prompt.
- Confirm Ctrl-C abort exits cleanly with code 130, does not act like Back, and
  leaves the terminal usable.

## Editor launching and remembered preference

- Unset `$VISUAL` and `$EDITOR`.
- Run `packages/cli/dist/bage edit <payload>`.
- Confirm the editor picker appears when no remembered editor exists.
- Pick an available editor and choose "Remember".
- Run edit again.
- Confirm the remembered editor opens without re-prompting.
- Set `$VISUAL` to a different available editor.
- Confirm `$VISUAL` wins over remembered preference.
- Confirm the editor opens on a temp file outside the project directory.
- After closing the editor, confirm the Better Age temp file is removed.
- Remember residual risk: editor swap files, backups, crash recovery, plugins, or
  shell tooling may still leave plaintext outside Better Age's control.

## Secure viewer scrolling and quit

- Create or use a payload with enough env lines to exceed terminal height.
- Run `packages/cli/dist/bage view <payload>`.
- Confirm plaintext appears only in the viewer UI.
- Add a test value containing control characters, for example an ESC or carriage
  return, then view it.
- Confirm controls render visibly, such as `\x1b` or `\r`, and do not affect the
  terminal title, clipboard, cursor, or previous screen.
- Use `j`, `k`, page down, page up, `g`, and `G`.
- Press `q`.
- Confirm the viewer closes and the shell is usable.

## Interactive menu loop

- Before setup, run `packages/cli/dist/bage interactive`.
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
- Confirm prompt cancellation from any menu exits with code 130.
- Run one submenu action and confirm the session returns to the active menu.
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
- Save invalid `.env` text from edit.
- Confirm the validation error is visible before a Reopen Editor / Cancel
  recovery menu.
- Confirm the invalid `.env` error is not delayed until returning to the menu.

## Guided identity flows

- Grant without an identity ref.
- Confirm the picker shows self disabled as `[you]`.
- Confirm already granted recipients are disabled as `[granted]`.
- Confirm disabled rows are visible but cannot be selected.
- Confirm known identities not yet granted are selectable.
- Confirm the picker has an Enter Identity String option.
- Enter an invalid identity string.
- Confirm the error is shown immediately and the flow allows retry or cancel.
- Import an identity with a duplicate alias in guided mode.
- Confirm the error is shown immediately and the flow allows reprompt, skip, or
  cancel.
- Import a known owner id with a changed public key.
- Confirm interactive mode shows old/new fingerprints and requires explicit
  trust before updating.
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
- Confirm `packages/cli/dist/bage load <payload> --protocol-version=1` still
  decrypts the payload.

## Clean stdout for load

```sh
packages/cli/dist/bage load <payload> --protocol-version=1 > /tmp/bage.env 2> /tmp/bage.err
```

- Confirm `/tmp/bage.env` contains only raw `.env` text.
- Confirm prompts, warnings, and errors are only in `/tmp/bage.err`.

## Clean stdout for identity export

```sh
packages/cli/dist/bage identity export > /tmp/bage.identity 2> /tmp/bage.err
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
