# Plan: Better Secrets UX Remaining Work

> Sources:
> - [BETTER_AGE_UX_PRD.md](../1-BETTER_AGE_UX_PRD.md)
> - [better-age-ux-refresh.md](./better-age-ux-refresh.md)

## Goal

Close verified gaps between PRD/refresh plan and current `packages/cli` implementation. Do not redesign. Finish missing UX slices and align docs/tests to shipped behavior.

## Current verified gaps

- Guided `interactive` only exposes `view` under Files and a subset of identity actions. No guided `create` / `inspect` / `edit` / `grant` / `revoke` / `update`.
- First-run setup gate is stubbed. Choosing `Setup` prints placeholder text instead of running setup.
- `create` omitted-path flow is still a raw text prompt. No shared create-target policy, no overwrite confirmation.
- `grant` / `revoke` do not print compact post-state summaries.
- Docs claim broader guided coverage than implementation currently ships.

## Workstream 1: Finish guided session file workflows

### Outcome

`bage interactive` becomes the real human entrypoint for payload work, not just a thin `view` wrapper.

### Implement

1. Expand file-scope menu in `cli/src/app/interactive-session/InteractiveSession.ts:31`.
   Add rows for:
   - `Create payload`
   - `Inspect payload`
   - `View secrets`
   - `Edit secrets`
   - `Grant access`
   - `Revoke access`
   - `Update payload`
   - `Back`

2. Inject app services needed by guided file actions into `InteractiveSession`.
   Add dependencies for:
   - `CreatePayload`
   - `InspectPayload`
   - `EditPayload`
   - `GrantPayloadRecipient`
   - `RevokePayloadRecipient`
   - `UpdatePayload`
   Or, better, inject existing command-level helpers if you first extract reusable action functions from CLI commands.

3. Avoid duplicating command glue inside `InteractiveSession`.
   Extract reusable human-flow helpers from command files into shared modules:
   - `cli/shared/runCreatePayloadFlow.ts`
   - `cli/shared/runInspectPayloadFlow.ts`
   - `cli/shared/runEditPayloadFlow.ts`
   - `cli/shared/runGrantPayloadFlow.ts`
   - `cli/shared/runRevokePayloadFlow.ts`
   - `cli/shared/runUpdatePayloadFlow.ts`
   Each helper should accept optional path / identity args and use current shared policies (`ResolvePayloadTarget`, passphrase session, update prompt, identity picker, editor resolution).

4. Keep session continuity.
   After each guided file action:
   - on success: return to Files menu
   - on handled failure: print terse remediation, return to Files menu
   - on user cancel/back: return to Files menu without extra noise

5. Update tests in [interactiveCommand.test.ts](packages/cli/src/cli/command/interactiveCommand.test.ts:296).
   Add cases for:
   - guided `inspect`
   - guided `edit`
   - guided `grant`
   - guided `revoke`
   - guided `update`
   - returning to Files menu after each action
   - hidden `load`
   - absent `read`

## Workstream 2: Make setup gate real

### Outcome

Unconfigured users can complete setup from `interactive` instead of hitting a dead end.

### Implement

1. Replace placeholder branch in [InteractiveSession.ts:75]
   Remove:
   - `prompt.writeStdout("Setup flow coming soon\n")`

2. Reuse actual setup behavior.
   Preferred shape:
   - extract setup flow from [setupUserKeyCommand.ts:1] into a reusable helper or app-facing wrapper
   - call that helper from both `setup` command and `InteractiveSession`

3. Post-setup routing:
   - on successful setup: enter root interactive menu in same invocation
   - on cancel: return to setup gate
   - on failure: print remediation, stay in setup gate

4. Tests:
   - choosing `Setup` runs real setup flow
   - successful setup lands user in root menu
   - quitting from setup gate exits cleanly

## Workstream 3: Finish create-target UX

### Outcome

`create` with omitted path matches PRD polish level of other human commands.

### Implement

1. Introduce a dedicated create-path resolver.
   Add new shared module:
   - `src/app/shared/ResolveCreatePayloadTarget.ts`

2. Resolver contract:
   - default suggested value: `./.env.enc`
   - if target exists:
     - in TTY: prompt `Overwrite existing payload?` with `Overwrite` / `Back`
     - non-TTY: fail with remediation
   - if user backs out: return typed cancel error, not generic prompt failure

3. Wire into [createPayloadCommand.ts:21]
   Replace raw `Prompt.inputText` path resolution with shared resolver.

4. Reuse same helper from guided Files -> Create flow.

5. Tests:
   - omitted path suggests `./.env.enc`
   - overwrite prompt shown when file exists
   - non-TTY overwrite path fails with remediation
   - guided create returns to Files menu

## Workstream 4: Add compact post-state summaries for ACL changes

### Outcome

`grant` / `revoke` confirm resulting access state, not just the action line.

### Implement

1. Extend success rendering in:
   - [grantPayloadCommand.ts](packages/cli/src/cli/command/grantPayloadCommand.ts:193)
   - [revokePayloadCommand.ts](packages/cli/src/cli/command/revokePayloadCommand.ts:195)

2. Minimum summary contract:
   - first line: existing terse action line
   - second line: `recipients: <count>` or equivalent compact ACL summary
   - optional third line: `updated: <handle>` or `removed: <handle>` only if useful

3. Data source:
   - after mutation, run `InspectPayload.execute` once with same path + cached passphrase
   - do not re-prompt for passphrase

4. Keep machine behavior unchanged.
   Only human commands change their wording; `load` untouched.

5. Tests:
   - explicit `grant`
   - picker `grant`
   - explicit `revoke`
   - picker `revoke`
   - update-then-retry path still prints one final summary only

## Workstream 5: Docs and contract alignment

### Outcome

Docs stop overstating guided support and match shipped command surface exactly.

### Implement

1. Audit and update:
   - [README.md](../../../../README.md)
   - [VISION.md](../../../../VISION.md)
   - [CONTRIBUTING.md](../../../../CONTRIBUTING.md)

2. Only claim guided actions that actually ship after Workstreams 1-4.

3. Add one command-surface contract test in [program.test.ts](packages/cli/src/cli/program.test.ts:6):
   - root help includes `interactive`
   - invoking removed `read` still fails

4. Add README examples for:
   - `interactive`
   - guided file scope
   - `view` secure viewer semantics
   - `load --protocol-version=1`

## Workstream 6: Restore green checks

### Outcome

`pnpm check` passes again so feature completion is mergeable.

### Implement

1. Fix [infra/alchemy.run.ts](infra/alchemy.run.ts:32).
   Current failure:
   - `Type 'string' is not assignable to type 'Secret<string>'`

2. Use the typed secret value expected by `RedirectRule`.
   Do not leave placeholder raw string.
   If infra config should not be part of this branch, remove the broken change from review scope instead of papering over it.

3. Re-run:
   - `pnpm check`

## Suggested order

1. Workstream 2
2. Workstream 3
3. Workstream 1
4. Workstream 4
5. Workstream 5
6. Workstream 6

Reason:
- real setup + create-path policy unblock guided shell work
- guided shell is biggest missing UX slice
- summaries/docs are follow-up alignment
- green checks last

## Exit criteria

- `interactive` supports setup, inspect, view, edit, grant, revoke, update, create
- `create` omitted-path flow has shared target policy and overwrite protection
- `grant` / `revoke` print compact post-state summaries
- docs match shipped UX exactly
- `pnpm check` passes

## Unresolved questions

- Can `infra/alchemy.run.ts` be fixed in this scope, or exclude as unrelated?
- For ACL summary, exact format wanted?
