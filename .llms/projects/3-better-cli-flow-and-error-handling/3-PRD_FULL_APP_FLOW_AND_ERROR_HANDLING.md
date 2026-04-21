# PRD: Full App Flow And Error Handling Overhaul

## Problem Statement

`better-age` has grown enough command surface and guided UX that its full interaction tree is no longer obvious from implementation alone. The current CLI behavior has drift across commands, TTY vs non-TTY handling, update/setup gating, loop-back behavior, and error rendering. Some paths are underspecified, some errors are too generic, and some command flows are inconsistent even when they solve similar user problems.

From the user perspective, this creates 4 concrete problems:

1. The same intent behaves differently depending on command entrypoint.
2. Error messages are uneven in quality and sometimes leak implementation detail or vague generic text.
3. Guided interaction recovery is incomplete, so some failures dead-end when they should offer a clear next action.
4. The app lacks one complete target-state interaction spec that can drive implementation, manual QA, and future automated e2e coverage.

The product need is not just “better error strings”. It is a full flow-model overhaul:
- one final interaction model
- one reusable flow language
- one explicit error catalog
- one implementation direction for making all commands converge on the same UX semantics
- one canonical identity-intake model instead of split overlapping grant-entry branches

## Solution

Define and implement a final target-state interaction system for `better-age` that treats the CLI as one coherent product rather than a set of independent command handlers.

From the user perspective, the final system should feel like this:

- direct commands remain first-class
- guided usage and `interactive` share the same underlying subflows
- identity-entering commands use one canonical identity-intake flow
- explicit args always mean “trust my intent exactly”
- guided flows recover gracefully with `Back`, `Cancel`, retry, candidate-pick, editor reopen, and setup/update gates where appropriate
- `interactive` becomes a pure navigation hub over the same command semantics, not a separate product
- every command has predictable `OK` / `CANCEL` / `ERROR` outcomes
- every error is rendered intentionally, with clear summary, context, and remediation when useful
- no raw exception strings, no weird generic messages, no accidental stderr success output

The implementation should follow the target-state behavior already designed in:
- the full interaction flow spec
- the normalized error message spec
- the append-only decision log

The core delivery is a codebase whose runtime behavior matches those documents.

## User Stories

1. As a CLI user, I want direct commands to remain fully usable, so that I can work fast when I already know exactly what I want.
2. As a CLI user, I want partial commands to enter guided completion, so that I can still succeed without remembering every operand.
3. As a CLI user, I want explicit args to be treated as authoritative, so that the tool never guesses or silently changes my intent.
4. As a CLI user, I want missing required args in exact flows to fail clearly, so that I immediately know what I forgot.
5. As a CLI user, I want guided flows to collect only missing information, so that interaction remains focused and efficient.
6. As a CLI user, I want `Back` to return locally and `Cancel` to stop intentionally, so that navigation stays predictable.
7. As a CLI user, I want every top-level command to end in a consistent semantic outcome, so that direct use, QA, and automation all reason about the same model.
8. As a CLI user, I want `interactive` to feel like a hub over the same commands, so that I do not need to learn two different apps.
9. As a CLI user, I want file-selection flows to be shared across commands that need an existing payload, so that the product behaves consistently.
10. As a CLI user, I want create-flow path selection to be separate from existing-payload selection, so that create remains simple and not mixed with unrelated logic.
11. As a CLI user, I want exact create to fail on existing files, so that destructive overwrite never happens implicitly.
12. As a CLI user, I want guided create to offer overwrite only explicitly, so that destructive actions remain deliberate.
13. As a CLI user, I want setup-required commands to guide me into setup only when appropriate, so that blocked flows can recover without surprise mutation in exact mode.
14. As a CLI user, I want exact blocked commands to fail with remediation instead of opening hidden setup, so that exact mode stays explicit.
15. As a CLI user, I want update-required human mutation commands to offer an explicit update gate in guided flows, so that I can resolve maintenance blockers without restarting my whole task.
16. As a CLI user, I want exact update-required mutation commands to fail clearly, so that exact mode never hides maintenance mutation.
17. As a CLI user, I want passphrase retry only where it makes sense for guided human flows, so that I can recover from mistakes without redoing unrelated steps.
18. As a CLI user, I want exact flows to avoid implicit retry loops, so that direct command behavior stays strict and predictable.
19. As a CLI user, I want `load` to remain exact and machine-oriented in output contract, so that tools can rely on it.
20. As a CLI user, I want `load` to fail when no local self identity exists, so that machine output never pretends access exists when it does not.
21. As a CLI user, I want `load` to warn but still succeed when payload update is recommended, so that env loading is not blocked by maintenance-only state.
22. As a CLI user, I want all human passphrase entry to use secure prompts only, so that passphrases are never routed through insecure plaintext command paths.
23. As a CLI user, I want `view` to open the secure viewer directly once prerequisites are satisfied, so that the flow is deliberate but not noisy.
24. As a CLI user, I want secure viewer keybindings to be canonical, so that movement and exit behavior never vary across runs.
25. As a CLI user, I want guided `inspect` to pause before the menu redraws, so that I can actually read the output.
26. As a CLI user, I want short success/status lines in `interactive` not to force extra acknowledgments, so that the app stays efficient.
27. As a CLI user, I want rich identity summary and share-string surfaces to be distinct, so that I can either inspect my state or share my identity intentionally.
28. As a CLI user, I want `grant` to accept pasted identity strings directly, so that I can paste and grant in one flow.
29. As a CLI user, I want pasted identity strings in `grant` to refresh local known identities automatically, so that local identity state stays useful.
30. As a CLI user, I want ambiguous identity refs never to be auto-picked, so that access changes never target the wrong identity.
31. As a CLI user, I want guided ambiguity flows to help me choose or edit, so that recovery is fast instead of frustrating.
32. As a CLI user, I want self-forbidden flows like revoke-self and forget-self to explain exactly what is forbidden, so that the tool feels intentional rather than arbitrary.
33. As a CLI user, I want no-op mutation outcomes to succeed as unchanged, so that idempotent commands do not fail just because the target state is already satisfied.
34. As a CLI user, I want edit validation failures to reopen the same temp contents, so that I can fix mistakes without losing my work.
35. As a CLI user, I want editor/config failures to produce concrete remediation, so that I know how to recover instead of debugging internals.
36. As a CLI user, I want every error message to be short, clear, and normalized, so that I can trust what the app tells me.
37. As a CLI user, I want warnings to be visibly warnings and not pseudo-errors, so that I understand severity correctly.
38. As a maintainer, I want one complete target-state flow map, so that implementation work can be done without re-deciding semantics midstream.
39. As a maintainer, I want one explicit error-message spec, so that typed errors can map to stable UX messages systematically.
40. As a maintainer, I want shared deep modules for setup gates, update gates, target resolution, passphrase policies, and error rendering, so that behavior is reused rather than duplicated.
41. As a maintainer, I want manual and automated e2e coverage to derive from the same spec, so that behavior drift is easier to detect.
42. As a maintainer, I want direct commands and interactive navigation to reuse the same internal flow graph, so that future UX changes land once.
43. As a CLI user, I want one identity-input mode that accepts alias, display name, handle, or full identity string, so that I do not need to guess which branch to pick first.
44. As a CLI user, I want full identity strings entered during grant-like actions to auto add or refresh known identities before continuing, so that sharing and access changes stay one-step.
45. As a CLI user, I want guided identity-string intake to ask for a local alias only when visible labels would collide, so that known identity state stays readable without adding unnecessary prompts.

## Implementation Decisions

- Treat interaction behavior as a domain of its own, with canonical terms already decided: exact invocation, guided invocation, interactive terminal, headless terminal, shared flow, flow outcome, back transition, cancel outcome, and message id.
- Keep direct commands first-class. The overhaul must not demote direct command usage in favor of `interactive`.
- Keep `interactive` as a navigation hub only. It should reuse command semantics and shared flows rather than own separate business rules.
- Use one stable top-level outcome model across all commands: `OK`, `CANCEL`, `ERROR`.
- Make explicit args authoritative everywhere. No chooser fallback, no reinterpretation, no argument guessing.
- Split path resolution into at least 2 deep modules:
  - existing-payload target resolution
  - new-payload target resolution
- Split setup and update blockers into reusable deep gate modules:
  - setup gate
  - update gate
- Split passphrase handling into reusable policy modules:
  - one-shot secure passphrase request
  - guided retry orchestration
  - passphrase pair entry
- Add a central identity-ref resolution layer that can handle:
  - exact explicit identity input
  - guided chooser selection
  - one free-text identity intake
  - local alias, display name, handle, and full identity string
  - ambiguity rendering
  - self-forbidden rendering
- Make full identity strings entered through grant-like identity intake auto-upsert known identity state before the original action continues.
- Add guided collision handling for imported identity visible labels:
  - collision check uses self display name and known identity visible labels
  - visible label = local alias when present, else display name
  - guided flow may ask for a unique local alias only when needed
  - exact flow must still accept the identity string without blocking on alias prompt
- Add a central error renderer that maps internal typed errors and flow outcomes onto stable message ids and final rendered copy from the error message spec.
- Add a central warning renderer so warnings are semantically distinct from errors while still using stderr.
- Keep success/info rendering separate from error/warning rendering and never emit normal success on stderr.
- Collapse low-level errors into stable user-facing UX contexts instead of exposing one message per internal error class.
- Preserve explicit maintenance semantics:
  - exact human mutation commands never auto-update
  - guided mutation commands may offer explicit update gate
- Preserve secure passphrase policy:
  - no plaintext passphrase injection path in target human flows
  - `load` still requires interactive secure passphrase input
- Keep `load` exact-only and headless-impossible in the target product model.
- Accept non-fatal update warning in `load`, with stdout env output preserved and exit `0`.
- Normalize idempotent mutation behavior:
  - already-granted, already-newer, not-currently-granted, unknown-forget, already-up-to-date all become unchanged success outcomes rather than errors
- Remove redundant reveal-confirm from `view`.
- Use canonical menu and viewer hotkeys as product behavior, not adapter accidents.
- Preserve a light output-pause distinction in `interactive`:
  - substantial text outputs acknowledge before returning
  - short status lines return immediately
- Replace generic fallback messages with curated patterns from the error-message spec.
- Keep temp-file cleanup and similar post-success cleanup issues from overwriting the primary command outcome unless they are the primary failure.
- Treat prompt abort as cancel by default, not as noisy error.
- Keep the interaction spec, error-message spec, and append-only decision log as the product reference set during implementation.

## Testing Decisions

- Good tests should validate external behavior only:
  - command result
  - sink behavior (`stdout`, `stderr`, viewer/menu state where testable)
  - branch transitions
  - retry/back/cancel behavior
  - final user-facing message semantics
- Do not test internal implementation details such as exact helper composition, specific intermediate function boundaries, or incidental internal type plumbing.
- Test the shared deep modules aggressively because they are the behavioral backbone:
  - setup gate
  - update gate
  - existing payload target resolution
  - new payload target resolution
  - passphrase policy flows
  - identity-ref resolution and ambiguity handling
  - central error/warning renderer
- Test each top-level command for:
  - success
  - cancel where reachable
  - exact-mode errors
  - guided recovery loops where applicable
- Add e2e coverage derived from the flow spec coverage checklist:
  - direct exact flows
  - guided flows
  - interactive session navigation
  - setup/update gates
  - passphrase retry loops
  - ambiguity flows
  - invalid env reopen loop
  - `load` warning behavior
- Prior art for tests should come from the existing package test suite patterns:
  - current command tests
  - app-layer tests
  - integration tests
  - e2e fixture patterns already present in the package

## Out of Scope

- New commands outside the currently documented command set.
- New encryption model or payload format beyond what is needed to support the target interaction semantics.
- New remote authority, sync model, or team platform behavior.
- New non-terminal UI.
- Changing the fundamental product split between human flows and machine `load` output.
- Rewriting the whole app architecture if smaller deep-module extraction can achieve the desired flow convergence.
- Publishing a GitHub issue from this PRD.

## Further Notes

- This PRD assumes the target product reference set is already decided and should now be implemented.
- The implementation should treat the flow spec and error-message spec as the runtime contract to converge toward.
- Where current code disagrees with the target docs, implementation should move toward the docs rather than preserving drift by default.
- The likely highest-leverage implementation path is:
  1. centralize message rendering
  2. centralize shared flow modules
  3. refactor command handlers to compose those modules
  4. close e2e coverage gaps from the spec checklist

## References

- [Interaction Flow Spec](./1-INTERACTION_FLOW_SPEC.md)
- [Error Message Spec](./1-ERROR_MESSAGE_SPEC.md)
- [Decision Log](./0-GRILL_ME_FLOW.md)
- [Current Error Handling Audit](./2-ERROR_HANDLING_SOURCE_OF_TRUTH.md)
- [Package Vision](../../../VISION.md)
- [Package README](../../../README.md)
- [Repo Ubiquitous Language](../../../../../UBIQUITOUS_LANGUAGE.md)
