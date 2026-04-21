# Spec/Test Coverage Report

Refs:
- [INTERACTION_FLOW_SPEC.md](./1-INTERACTION_FLOW_SPEC.md)
- [ERROR_MESSAGE_SPEC.md](./1-ERROR_MESSAGE_SPEC.md)
- [FLOW_DRIFT_INVENTORY.md](./2-FLOW_DRIFT_INVENTORY.md)
- [GRILL_ME_FLOW.md](./0-GRILL_ME_FLOW.md)

Status: Phase 9 closure complete.

## Top-level command outcome matrix

Legend:
- `covered`: explicit automated coverage at command/app boundary
- `n/a`: outcome not reachable by target contract
- `delegated`: top-level command is thin; branch covered one layer lower where behavior actually lives

| Command | OK | CANCEL | ERROR | Notes |
| --- | --- | --- | --- | --- |
| `setup` | covered | covered | covered | [setupUserKey.test.ts](./src/cli/command/setupUserKey.test.ts) |
| `interactive` | covered | covered | delegated | shell reuses converged subflows; fatal infra/error paths covered in reused command/app tests + [interactiveCommand.test.ts](./src/cli/command/interactiveCommand.test.ts) |
| `me` | covered | n/a | covered | [meCommand.test.ts](./src/cli/command/meCommand.test.ts) |
| `add-identity` | covered | covered | covered | [addIdentityCommand.test.ts](./src/cli/command/addIdentityCommand.test.ts) |
| `forget-identity` | covered | covered | covered | [forgetIdentityCommand.test.ts](./src/cli/command/forgetIdentityCommand.test.ts) |
| `identities` | covered | n/a | covered | [identitiesCommand.test.ts](./src/cli/command/identitiesCommand.test.ts) |
| `rotate` | covered | covered | covered | [rotateUserIdentity.test.ts](./src/cli/command/rotateUserIdentity.test.ts) |
| `change-passphrase` | covered | covered | covered | [changePassphraseCommand.test.ts](./src/cli/command/changePassphraseCommand.test.ts) |
| `create` | covered | covered | covered | [createPayloadCommand.test.ts](./src/cli/command/createPayloadCommand.test.ts) |
| `edit` | covered | covered | covered | [editPayloadCommand.test.ts](./src/cli/command/editPayloadCommand.test.ts) |
| `grant` | covered | covered | covered | [grantPayloadCommand.test.ts](./src/cli/command/grantPayloadCommand.test.ts) |
| `revoke` | covered | covered | covered | [revokePayloadCommand.test.ts](./src/cli/command/revokePayloadCommand.test.ts) |
| `inspect` | covered | covered | covered | [inspectPayloadCommand.test.ts](./src/cli/command/inspectPayloadCommand.test.ts) |
| `view` | covered | delegated | covered | direct command delegates to [ViewPayload.test.ts](./src/app/view-payload/ViewPayload.test.ts) for secure-prompt cancel + viewer behavior |
| `load` | covered | covered | covered | [loadPayloadCommand.test.ts](./src/cli/command/loadPayloadCommand.test.ts) |
| `update` | covered | covered | covered | [updatePayloadCommand.test.ts](./src/cli/command/updatePayloadCommand.test.ts) |

## Shared-flow coverage

| Shared flow family | Coverage |
| --- | --- |
| existing payload target resolution | [ResolvePayloadTarget.test.ts](./src/app/shared/ResolvePayloadTarget.test.ts) |
| new payload target resolution | [ResolveNewPayloadTarget.test.ts](./src/app/shared/ResolveNewPayloadTarget.test.ts) |
| setup gate | [setupFlow.test.ts](./src/cli/shared/setupFlow.test.ts) |
| update gate | [updateGate.test.ts](./src/cli/shared/updateGate.test.ts) |
| passphrase retry | [passphraseRetry.test.ts](./src/cli/shared/passphraseRetry.test.ts) |
| passphrase pair mismatch loop | [changePassphraseCommand.test.ts](./src/cli/command/changePassphraseCommand.test.ts), [setupUserKey.test.ts](./src/cli/command/setupUserKey.test.ts) |
| unified grant identity intake | [grantPayloadCommand.test.ts](./src/cli/command/grantPayloadCommand.test.ts), [ImportIdentityString.test.ts](./src/app/import-identity-string/ImportIdentityString.test.ts) |
| identity ref / typed identity recovery | [grantPayloadCommand.test.ts](./src/cli/command/grantPayloadCommand.test.ts), [revokePayloadCommand.test.ts](./src/cli/command/revokePayloadCommand.test.ts), [forgetIdentityCommand.test.ts](./src/cli/command/forgetIdentityCommand.test.ts), [addIdentityCommand.test.ts](./src/cli/command/addIdentityCommand.test.ts) |
| editor invalid env reopen / discard / cancel | [editPayloadCommand.test.ts](./src/cli/command/editPayloadCommand.test.ts) |
| interactive ack vs no-ack | [interactiveCommand.test.ts](./src/cli/command/interactiveCommand.test.ts) |

## Warning + sink coverage

| Contract | Coverage |
| --- | --- |
| success/info on stdout | command suites above; especially `setup`, `create`, `update`, `me`, `identities` |
| errors/warnings on stderr | renderer assertions across command suites |
| `load` update-needed warning on stderr + exit success | [loadPayloadCommand.test.ts](./src/cli/command/loadPayloadCommand.test.ts) |
| prompt abort maps to quiet cancel, not noisy stderr | `setup`, `add-identity`, `rotate`, `change-passphrase`, `update`, `load`, `view` suites |

## Remaining uncovered branches

None at spec branch-family level.

Residual untested paths are only fatal unrecoverable infrastructure defects that intentionally collapse into generic final-fallback behavior and are already exercised lower in the stack where business semantics live. They are not separate UX branch families in the target spec.
