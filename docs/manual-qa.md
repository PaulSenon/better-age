# Manual QA

Manual QA covers terminal behavior that is intentionally not yet covered by
Docker or pseudo-TTY E2E.

Docker and pseudo-TTY E2E are deferred.

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
- Confirm typed characters are not echoed.
- Press Ctrl-C during a passphrase prompt.
- Confirm the command exits cleanly with a cancellation error on stderr.

## Editor launching and remembered preference

- Unset `$VISUAL` and `$EDITOR`.
- Run `packages/cli/dist/bage edit <payload>`.
- Confirm the editor picker appears when no remembered editor exists.
- Pick an available editor and choose "Remember".
- Run edit again.
- Confirm the remembered editor opens without re-prompting.
- Set `$VISUAL` to a different available editor.
- Confirm `$VISUAL` wins over remembered preference.

## Secure viewer scrolling and quit

- Create or use a payload with enough env lines to exceed terminal height.
- Run `packages/cli/dist/bage view <payload>`.
- Confirm plaintext appears only in the viewer UI.
- Use `j`, `k`, page down, page up, `g`, and `G`.
- Press `q`.
- Confirm the viewer closes and the shell is usable.

## Interactive menu loop

- Before setup, run `packages/cli/dist/bage interactive`.
- Confirm only setup and quit are shown.
- Complete setup.
- Confirm the root menu changes to Files, Identities, and Quit.
- Enter Files; confirm create, edit, grant, inspect, revoke, update, view, back,
  and quit are present.
- Enter Identities; confirm export, import, list, forget, passphrase, rotate,
  back, and quit are present.
- Confirm `load` and `interactive` are not shown in menus.
- Run one submenu action and confirm the session returns to the active menu.

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
