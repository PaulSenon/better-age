# Release UX Parity Matrix

Status: active release gate.

Release is blocked until every `keep` or `change` row is implemented and the manual QA checklist passes.

## Status Legend

- `keep`: preserve or improve this end-user capability for MVP.
- `change`: keep the user goal, but implement a better flow or output than the prototype.
- `drop`: intentionally removed from MVP.
- `defer`: valuable, but post-MVP.
- `unknown`: needs a product/spec decision before release readiness can be claimed.

## Matrix

| Behavior | Status | Release expectation |
| --- | --- | --- |
| Real command help/parser behavior | `change` | Use real `@effect/cli` command/help/parser behavior; remove hand-rolled release help. |
| keyboard navigation for menus | `keep` | All interactive menus and choice prompts use keyboard navigation, not numbered readline selection. |
| keyboard navigation for guided pickers | `keep` | Payload picker, identity picker, editor picker, and update choices share the same keyboard-select UX. |
| Ctrl-C abort | `keep` | Ctrl-C aborts immediately, exits 130, restores terminal state, and never acts as Back. |
| immediate interactive feedback | `keep` | Commands launched from `bage interactive` display results immediately, not only after quitting. |
| Result pause after primary output | `change` | Primary result screens such as identity export wait for Enter before menu redraw; simple status logs do not block. |
| guided suggestions for payload paths | `keep` | Missing existing payload paths discover `.env.enc` and `.env.*.enc` candidates in the current directory and always allow custom input. |
| Guided create target | `change` | Creation suggests `.env.enc`; collisions show Override, Change Name, and Cancel. |
| Guided grant identity picker | `keep` | Grant merges self, known identities, payload recipients, and aliases; self/granted rows are disabled with tags. |
| Guided revoke identity picker | `keep` | Revoke lists only actual payload recipients, disables self, and overlays local aliases. |
| Compact identity rendering | `change` | Lists and pickers use compact alias/display/handle/tag rows; full public keys are hidden by default. |
| Guided invalid identity string retry | `keep` | Invalid guided identity strings show an immediate error and allow retry or cancel. |
| Guided duplicate alias retry | `keep` | Duplicate aliases show an immediate error and allow reprompt, skip, or cancel. |
| payload envelope | `change` | Payload files use a readable `BETTER AGE PAYLOAD` outer envelope wrapping untouched inner age armor. |
| machine stdout for `load` | `keep` | `load --protocol-version=1` writes raw env text only to stdout. |
| machine stdout for `identity export` exact mode | `keep` | Exact `identity export` writes only the identity string and newline to stdout. |
| Hidden passphrase prompt | `keep` | Passphrases are TTY-only and hidden. |
| External editor flow | `keep` | `$VISUAL`, `$EDITOR`, remembered preference, picker, one-time, and remember behavior remain available. |
| Secure viewer | `keep` | `view` opens an in-process viewer with keyboard scrolling and quit; plaintext never falls back to stdout. |
| Varlock load integration | `keep` | Varlock shells out through the `bage load --protocol-version=1 <path>` contract. |
| Docker E2E release gate | `defer` | Not required for MVP release readiness. |
| Full pseudo-TTY test suite | `defer` | Optional only where trivial and low-maintenance. |
| Headless passphrase injection | `defer` | No argv/env/stdin secret channel for MVP. |
| Automatic import prompt for all unknown payload identities | `defer` | Not part of current release hardening scope except the grant/import path. |
| Legacy exact transcript parity | `drop` | The target is user-visible capability parity, not exact prototype output or flow transcript. |

## Manual QA Coverage Required

Manual QA must explicitly cover:

- keyboard navigation.
- Ctrl-C abort.
- immediate interactive feedback.
- guided suggestions.
- editor flow.
- secure viewer flow.
- payload envelope.
- machine stdout.

## Release Readiness Rule

Release is blocked when:

- any `keep` or `change` row is not implemented.
- any `unknown` row remains.
- manual QA has not been run against the built CLI.
- manual QA fails on keyboard navigation, Ctrl-C abort, immediate interactive feedback, guided suggestions, payload envelope, or machine stdout.
