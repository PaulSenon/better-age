# Better Secrets Flow Drift Inventory

Current-vs-target drift inventory for Phase 0 of the full app flow and error-handling overhaul.

References:
- [Current Audit](./2-ERROR_HANDLING_SOURCE_OF_TRUTH.md)
- [Target Flow Spec](./1-INTERACTION_FLOW_SPEC.md)
- [Target Error Spec](./1-ERROR_MESSAGE_SPEC.md)
- [Decision Log](./0-GRILL_ME_FLOW.md)

## Drift categories

- `branch-missing`
  - target branch not implemented
- `branch-wrong`
  - branch exists but behavior differs from target
- `sink-wrong`
  - stdout/stderr/viewer/menu usage differs from target
- `message-wrong`
  - copy too generic, raw, leaky, or missing remediation
- `recovery-missing`
  - target retry/back/cancel path absent
- `test-missing`
  - branch family not adequately covered

## Cross-cutting drift

| Area | Drift |
| --- | --- |
| Root outcome model | `branch-wrong`: current code uses per-command failed-error wrappers + exit 1, but no central `OK/CANCEL/ERROR` model |
| Message rendering | `branch-wrong`: central renderer now exists and several commands use it, but mutation-heavy branches still render many raw adapter/app messages |
| Warnings | `branch-fixed`: explicit warning contract exists for `load` via central warning rendering |
| Sink policy | `sink-wrong`: some success/info currently go to stderr (`setup` home path, auto-selected payload path) |
| Cancel semantics | `branch-wrong`: prompt abort generally becomes failure; target wants silent cancel by default |
| Runtime infra failures | `branch-missing`: startup/config/state/payload-discovery/temp/viewer infra errors are not centrally normalized |
| Test model | `branch-fixed`: coverage matrix now lives in `SPEC_TEST_COVERAGE_REPORT.md`, though it is not yet a full branch-complete target matrix |

## Command drift matrix

| Command | Current drift |
| --- | --- |
| `setup` | `branch-fixed`: plaintext stdin passphrase path is gone. `sink-fixed`: success now keeps `Home:` on stdout with the rest of setup success output. `branch-wrong`: exact mode still prompts for alias when omitted; target exact mode wants explicit alias. `recovery-missing`: no guided alias invalid edit/back/cancel menu. `test-missing`: target exact/guided split not covered. |
| `me` | `branch-fixed`: uses central renderer-driven failures. |
| `identities` | `branch-fixed`: uses central renderer-driven failures. |
| `add-identity` | `branch-wrong`: current guided flow is simple prompt only, no typed-input recovery menu. `branch-missing`: self-import forbidden path not modeled. `message-wrong`: conflict/decode/persistence not normalized through catalog. |
| `forget-identity` | `branch-wrong`: current optional chooser path exists, but no guided typed-input recovery menus for unknown/self/ambiguous. `branch-wrong`: current unknown is unchanged success already, good, but message normalization missing. |
| `rotate` | `branch-fixed`: uses central renderer-driven failures. `branch-wrong`: still not part of a shared passphrase policy module. |
| `change-passphrase` | `branch-fixed`: mismatch now retries inside the shared passphrase-pair flow, and failures use the central renderer. |
| `create` | `branch-wrong`: current no-path behavior prompts directly; target wants dedicated new-target flow. `branch-wrong`: exact vs guided overwrite semantics differ from target. `message-wrong`: non-TTY overwrite failure copy is ad hoc. |
| `inspect` | `branch-wrong`: current command optional path and passphrase behavior close, but no setup gate and no guided decrypt retry menu. `branch-fixed`: migrated failures use central renderer ids. |
| `view` | `branch-wrong`: current flow has extra reveal-confirm menu; target removes it. `branch-wrong`: no setup gate. `message-wrong`: currently collapses through one failure wrapper but still uses raw message in many branches. |
| `edit` | `branch-wrong`: no setup gate. `branch-wrong`: invalid env loop now offers explicit `Reopen editor` / `Discard changes and back` / `Cancel`, but outcome model is not yet normalized through shared flow semantics. `message-wrong`: many raw persistence/env/editor/tempfile messages. |
| `grant` | `branch-wrong`: no setup gate. `branch-wrong`: identity-string import side effect exists partially, but not normalized to target flow language. |
| `revoke` | `branch-wrong`: no setup gate. |
| `update` | `branch-wrong`: no setup gate. `branch-fixed`: update failures use central renderer ids in migrated branches. |
| `load` | `branch-fixed`: current path warns on update-needed and still succeeds. `branch-fixed`: current path already uses a central warning model for update-needed. `branch-fixed`: protocol/decrypt/update-required branches are renderer-driven. |
| `interactive` | `branch-fixed`: session runner is now CLI-owned. `branch-fixed`: setup gate on session entry now uses `Setup now` / `Back` / `Cancel`. `branch-wrong`: subflow return behavior is still not normalized to the full target outcome model. |

## Shared-flow drift matrix

| Shared flow family | Current drift |
| --- | --- |
| Setup gate | `branch-missing`: only ad hoc inside `interactive`; no reusable gate for commands needing self identity |
| Existing payload resolution | `branch-wrong`: auto-selected single payload writes to stderr info line; target forbids success/info on stderr. `message-wrong`: no central renderer. |
| New payload resolution | `branch-missing`: no dedicated create-only target flow |
| Passphrase one-shot / retry / pair | `branch-missing`: behaviors exist ad hoc but not as explicit reusable policy modules |
| Update gate | `branch-fixed`: helper exposes `Update now` / `Back` / `Cancel`, and shared mutation flows honor `Back` as real local navigation |
| Identity ref resolution | `branch-wrong`: chooser/paste helper exists, but typed-input recovery menus absent |
| Error-guided recovery menus | `branch-missing`: no reusable guided error menu primitives |
| Editor resolution | `branch-wrong`: behavior close, but not normalized through central outcome/message model |
| Acknowledge substantial output | `branch-fixed`: interactive read outputs now use a shared acknowledge step before menu redraw |

## Error-rendering drift matrix

| Family | Current drift |
| --- | --- |
| Runtime startup/config | `branch-missing`: no central UX mapping |
| Home state load/decode | `message-wrong`: command-specific raw `.message` passthrough |
| Payload discovery | `message-wrong`: current embedded copy not catalog-driven |
| Prompt unavailable / prompt abort | `branch-wrong`: abort treated as failure; target prefers cancel |
| Payload decrypt/parse | `message-wrong`: inconsistent formatting by command |
| Editor/viewer infra | `message-wrong`: current messages are closer, but still raw adapter errors |
| Temp file failures | `message-wrong`: surfaced ad hoc in edit |
| Internal defects | `branch-missing`: no stable internal-error rendering policy |

## Test coverage drift by branch family

| Branch family | Current drift |
| --- | --- |
| Central outcome model | `test-missing` |
| Central message renderer | covered |
| Warning rendering | covered |
| Setup gate | covered |
| Update gate with Back | covered |
| Guided typed identity recovery | `test-missing` |
| Guided passphrase retry menus | `test-missing` |
| Interactive ack/no-ack behavior | `test-missing` |
| `load` warning-but-success | covered |
| Edit invalid-env explicit action menu | covered |

## Frozen implementation order

1. Central outcome + message/warning renderer
2. Shared secure-input and gate policies
3. Shared payload target resolution
4. Shared identity resolution + guided recovery menus
5. Read-path command convergence
6. Mutation-path command convergence
7. Interactive session convergence
8. Spec-to-test closure
