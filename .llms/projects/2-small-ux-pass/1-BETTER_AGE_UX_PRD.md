# Better Secrets UX PRD

## Problem Statement

`better-age` already has a solid local-first encrypted payload core, but the user experience is still split between good security primitives and uneven command ergonomics.

The current product shape creates drift:
- some commands are already safe and clear, but the overall CLI still asks users to remember too much
- guided flows are not yet the primary human path
- keyboard navigation is not yet the dominant interaction model
- omitted-path and omitted-identity flows are not yet consistently navigable
- machine and human plaintext paths are conceptually correct, but not yet expressed through one coherent UX layer
- command-by-command prompt logic risks turning into shallow duplicated glue

The problem is not cryptography. The problem is UX coherence.

The v0 refresh must make `better-age` feel like one product:
- keyboard-navigable for humans
- explicit and deterministic for machines
- direct-command friendly for power users
- guided enough that non-expert developers do not need to internalize the full model before succeeding

## Solution

Refresh `better-age` v0 around one explicit UX model: human workflows are driven by interactive keyboard CLI navigation, while machine workflows remain strict and explicit.

This refresh centers the product around:
- `bage interactive` as the guided human entrypoint
- keyboard-select menus for guided mode and for omitted-arg direct flows
- `view` as the dedicated human secret-reading command
- `read` removed from the v0 surface because its old educational role is superseded by `view`
- `load` remaining machine-only and hidden from guided menus
- one shared policy layer for file selection, identity selection, editor resolution, update preflight, passphrase reuse, and output wording

The product stays honest:
- non-interactive mode never hides mutation
- payload files stay caller-owned and visible
- `update` remains explicit even when interactive flows offer to run it for you
- human secret viewing never degrades into unsafe stdout dumping
- keyboard navigation is real interaction, not decorative wrappers around text prompts
- removed commands stay removed; old `read` behavior must not leak back in through docs or implementation leftovers

## User Stories

1. As a developer, I want bare `better-age` to behave like a normal CLI entrypoint, so that the tool does not unexpectedly launch a session when I wanted help or command discovery.
2. As a developer, I want help output to clearly advertise `bage interactive`, so that the guided path is obvious from first use.
3. As a new user, I want `bage interactive` to feel like the default human way to use the product, so that I do not need to memorize commands before succeeding.
4. As a new user, I want guided mode to funnel me into `setup` when no local identity exists, so that first use is self-explanatory.
5. As a returning user, I want guided mode to skip first-run onboarding when I am already configured, so that routine use stays fast.
6. As a user, I want guided mode to be keyboard navigable end to end, so that I can move through workflows without dropping into manual text entry unless the task actually needs text.
7. As a user, I want menu navigation to feel consistent across the whole product, so that learning one picker teaches me the rest.
8. As a user, I want Enter to confirm the current selection, so that the primary action is obvious.
9. As a user, I want Back and Quit semantics to be explicit and consistent, so that I can always recover or leave without confusion.
10. As a user, I want guided mode to separate file workflows and identity workflows, so that the product model stays legible.
11. As a user, I want guided mode to hide machine-oriented commands, so that the human UX is not cluttered by low-level integration surfaces.
12. As a user, I want `load` to stay out of guided menus, so that human and machine paths remain clearly distinct.
13. As a user, I want `view` to exist as the dedicated human plaintext-reading flow, so that reading secrets and loading secrets are clearly different actions.
14. As a user, I want `view` to warn me before showing secrets, so that plaintext reveal is always deliberate.
15. As a user, I want `view` to open in an in-process scrollable readonly viewer, so that human reading stays ergonomic without printing secrets directly into terminal scrollback.
16. As a user, I want `view` to fail securely when the secure viewer cannot run, so that secrets are never leaked to stdout as a fallback.
17. As a user, I want secure-view failure remediation to tell me why reveal was blocked, so that the security model is legible and not arbitrary.
18. As a user, I want the human viewer to stay fully inside the product’s keyboard-navigation model, so that secret reading feels coherent with the rest of the UX.
19. As a user, I want direct human payload commands with omitted path to open keyboard-select file pickers, so that I do not have to type paths constantly.
20. As a user, I want payload pickers limited to the current working directory and `.env*.enc` matches, so that selection stays predictable in repos and monorepos.
21. As a user, I want exactly one discovered payload to auto-select with a visible confirmation line, so that the tool feels fast without being hidden.
22. As a user, I want multi-file payload selection to show relative paths only, so that the list stays readable.
23. As a user, I want file selection to happen before decryption, so that I am not asked for a passphrase until the target is known.
24. As a user, I want omitted-path behavior in non-TTY mode to fail with remediation instead of prompting, so that scripts stay deterministic.
25. As a user, I want `create` with no path to guide me through choosing a payload location, so that creation feels as polished as edit and inspect.
26. As a user, I want `inspect` to remain the safe metadata command, so that I can understand a payload without exposing values.
27. As a user, I want `edit` to open a normal editor on plaintext env content, so that editing feels like editing `.env`.
28. As a user, I want missing-editor flows to be recoverable interactively, so that I can pick an editor without leaving the current command.
29. As a user, I want the editor chooser itself to be keyboard navigable, so that the recovery path matches the rest of the UX.
30. As a user, I want to optionally save the chosen editor as my default, so that I do not repeat the same recovery step every time.
31. As a user, I want invalid env edits to send me back into the editor flow, so that I can fix mistakes without losing momentum or corrupting the payload.
32. As a user, I want `grant` with no identity ref to open a keyboard-select identity picker, so that I can grant access without pre-typing handles.
33. As a user, I want the grant picker to show known identities with human-readable labels, so that I can choose confidently.
34. As a user, I want the grant picker to include a clear paste/import path, so that sharing and granting can happen in one flow.
35. As a user, I want choosing the paste/import path to move me into a text-entry step, so that keyboard navigation and identity-string entry work together cleanly.
36. As a user, I want `revoke` with no identity ref to open a picker over actual current recipients, so that revocation follows payload truth rather than guesswork.
37. As a user, I want self to appear as a disabled row in revoke flows, so that the self-revoke rule is visible in context rather than only as an error.
38. As a user, I want `forget-identity` with no identity ref to open a keyboard-select picker, so that local address-book cleanup is easy.
39. As a user, I want identity rows to show display name, handle, and optional local alias, so that ambiguous names are manageable.
40. As a user, I want keyboard pickers to support long lists through scrolling, so that large identity or file lists remain usable.
41. As a user, I want interactive human commands to offer `update` when a payload is stale, so that maintenance feels guided rather than mysterious.
42. As a user, I want non-interactive commands to fail and direct me to `update`, so that scripts never hide mutation.
43. As a user, I want passphrase prompting to happen lazily, so that I am not interrupted before the product knows it actually needs decryption.
44. As a user, I want passphrase reuse within one invocation, so that update-then-retry flows do not ask me again unnecessarily.
45. As a user, I want `load` to remain the only machine-facing plaintext contract, so that tooling integrations have one stable behavior.
46. As a user, I want `load` to require explicit path and protocol version and to refuse interactive maintenance, so that machine callers remain deterministic.
47. As a user, I want removed commands to stay removed from docs, help, menus, and behavior contracts, so that stale UX ideas do not come back by accident.
48. As a user, I want guided mode to make `me` understandable and actionable, so that copying or sharing my identity feels human-friendly.
49. As a user, I want direct `me` to stay raw and scriptable, so that machine and shell usage are not polluted by guided prose.
50. As a user, I want `grant` and `revoke` to end with compact post-state summaries, so that I can verify resulting access quickly.
51. As a user, I want `edit`, `update`, and `inspect` success output to stay terse, so that routine operations do not become noisy.
52. As a user, I want guided flows to return me to the relevant menu after completing an action, so that the session feels continuous.
53. As a user, I want guided mode to feel simple rather than magical, so that I trust what the tool is doing.
54. As a maintainer, I want one shared UX policy layer instead of per-command prompt branching, so that the product does not fragment as features grow.
55. As a maintainer, I want keyboard-navigation rules to be centralized, so that menu behavior does not drift across commands.
56. As a maintainer, I want the shipped `load` contract treated as baseline, so that the UX refresh does not destabilize machine integrations already in place.
57. As a maintainer, I want this UX refresh to be the clean v0 PRD source of truth for interaction design, so that outdated branches and half-decisions stop leaking into implementation.

## Implementation Decisions

- Treat this PRD as the current UX source of truth for v0 interaction design.
- Keep the root CLI standard-first:
  - bare command stays help and discovery oriented
  - guided mode is explicit via `interactive`
  - direct subcommands remain first-class

- Classify commands by UX role:
  - guided human commands: `interactive`, `view`, `inspect`, `edit`, `grant`, `revoke`, `update`, `create`, identity-management actions surfaced through menus
  - machine-only command: `load`
  - dual-surface command: `me` with raw direct mode and guided interactive mode
- Remove `read` from the product surface for this refreshed v0.
  - Do not keep command stubs, educational redirects, or menu mentions.
  - Product language should consistently talk about `view` for humans and `load` for machines.

- Introduce a dedicated guided-session controller.
  - Owns setup gating, top-level scopes, menu transitions, back/quit behavior, and return-to-menu flow after actions.
  - This is a deep module because guided navigation should not leak session-state logic into every command.

- Introduce one shared keyboard-navigation module.
  - Owns selectable list rendering, highlighted rows, disabled rows, scrolling, empty states, and shared key handling.
  - Standardize:
    - arrow keys and `j`/`k` move
    - Enter confirms
    - Escape or explicit Back row goes back one level
    - Ctrl-C quits current flow/process
  - Do not create divergent ad hoc menu behaviors per command.

- Introduce one shared target-resolution module for payload files.
  - Existing-payload resolution contract:
    - explicit path wins
    - if path omitted in TTY, scan cwd only for `.env*.enc`
    - one match auto-selects and prints confirmation
    - many matches open keyboard-select picker
    - zero matches prompt for a path with remediation examples
    - non-TTY omitted path fails with remediation
  - Create-payload resolution contract:
    - guide user toward a default filename
    - allow editing/override
    - prevent accidental overwrite unless explicitly confirmed
  - This should be shared by direct commands and guided mode.

- Introduce one shared identity-selection and identity-presentation module.
  - Standard row shape shows display name, handle, and optional local alias.
  - Grant flow:
    - excludes self from selectable targets
    - includes a dedicated paste/import action
    - if paste/import selected, switch to text-entry step for identity string
  - Revoke flow:
    - source of truth is current payload recipients
    - self is visible but disabled
  - Forget-identity flow:
    - source of truth is local known identities

- Introduce one human secret viewer module.
  - Owns `view` semantics.
  - Warns before reveal.
  - Uses an in-process secure viewer surface in v0.
  - The viewer is keyboard-readable, scrollable, and readonly.
  - The viewer writes to terminal UI surface only, never plaintext stdout.
  - The viewer should use existing terminal primitives and shared keyboard-navigation policy where practical.
  - Expected baseline controls:
    - up/down movement
    - page up/page down
    - jump top/bottom
    - quit/back
  - Never falls back to stdout.
  - If secure viewing is unavailable, fail with remediation that explains secrets cannot be safely shown in the current environment.

- Introduce one editor-resolution module.
  - Precedence order:
    - `BETTER_AGE_EDITOR`
    - saved bage editor config
    - `VISUAL`
    - `EDITOR`
    - interactive chooser in TTY
    - remediation failure
  - Chooser is keyboard navigable.
  - Chooser supports one-shot use and save-as-default.
  - Initial editor candidate set should stay bounded and conventional.

- Introduce one interactive update gate.
  - Used by human-sensitive flows that require a fresh payload.
  - If payload needs update in interactive mode:
    - explain that the original action is blocked by stale payload state
    - offer `update now`
    - run update
    - retry the original action in the same invocation
  - In non-interactive mode:
    - never auto-run update
    - fail with explicit remediation

- Introduce one passphrase-session module.
  - Prompts only when first decryption is actually needed.
  - Reuses passphrase within the current invocation.
  - Supports update-then-retry flows without reprompt.
  - Never persists beyond the current process.

- Keep `load` stable.
  - Explicit path required.
  - Protocol version required.
  - No picker flow.
  - No guided menu exposure.
  - No interactive update gate.
  - Stdout remains raw env output only.

- Keep removed command cleanup explicit.
  - `read` must be removed from help, menus, docs, and command contracts.
  - Existing educational behavior should not survive as a stale compatibility surface unless a separate compatibility decision is made later.

- Standardize output policy.
  - Auto-selected file prints `Using <relative-path>`.
  - `grant` and `revoke` print one action line plus compact post-state summary.
  - `edit`, `inspect`, and `update` stay terse.
  - Failures are short, command-oriented, and remediation-first.

- Roll out as a UX-led v0 refresh, not as isolated cosmetic polish.
  - The interaction layer is a product feature.
  - This work necessarily changes command surfaces, prompt flows, menu routing, and some adapter boundaries.

## Testing Decisions

- Good tests assert external behavior, not implementation details.
- Good UX tests focus on:
  - visible prompts and menus
  - keyboard-selection behavior
  - disabled-row behavior
  - back/quit behavior
  - stdout/stderr discipline
  - retry and remediation flow
  - guided-session routing

- The following modules and behaviors should be tested:
  - root help advertising `interactive`
  - guided setup gate
  - guided top-level scope loop
  - shared keyboard-navigation behavior across lists and disabled rows
  - shared payload target resolution across zero, one, and many matches
  - non-TTY omitted-path failure behavior
  - `view` warning and secure-view launch
  - `view` refusal behavior when secure viewing is unavailable
  - `view` never leaking secrets to stdout on secure-view failure
  - `view` scrolling and quit behavior
  - editor precedence resolution
  - keyboard-driven editor chooser flow
  - invalid env edit retry loop
  - interactive update gate accept and decline paths
  - non-interactive update refusal path
  - per-invocation passphrase reuse
  - `grant` picker plus paste/import branch
  - `revoke` picker with disabled self row
  - `forget-identity` picker behavior
  - direct `me` versus guided `me`
  - `load` remaining hidden from guided UX
  - `read` removed from exposed UX surfaces
  - post-state summary formatting for `grant` and `revoke`

- Prior art for tests:
- existing CLI command tests already validate stdout/stderr contracts, prompt behavior, and retry logic
  - existing `load` tests provide the current machine baseline
  - existing payload command tests provide prior art for update gating and visible command outcomes

- Expected test layers:
  - pure unit tests for policy modules
  - command-level tests for direct CLI contracts
  - process/integration tests for viewer and editor boundaries
  - guided-session tests for menu flow and keyboard routing

## Out of Scope

- bare `better-age` auto-launching guided mode
- replacing direct subcommands with guided mode
- recursive payload discovery
- decrypting payloads before file selection
- stdout fallback for human secret viewing
- keeping stale `read` educational behavior in the refreshed UX contract
- exposing `load` inside guided menus
- hidden mutation in non-interactive mode
- caching passphrases across separate invocations
- multi-select batch grant or revoke
- fuzzy search and advanced filtering for v0 pickers
- user-configurable keymaps in v0
- bespoke full-screen TUI beyond the keyboard CLI navigation needed for menus and flows
- GUI app work

## Further Notes

- This PRD supersedes stale partial UX branches and list-only interpretations.
- Keyboard interactive CLI navigation is the core of this refresh, not an optional enhancement.
- `interactive` and `view` are both in scope.
- `read` is out of scope because it is removed, not refined.
- This is still a UX-led v0 refresh, but it intentionally reaches into command contracts and supporting modules because that is what is required to make the UX coherent.
- `load` stays the stable machine contract baseline.
- `update` stays explicit, even when the interactive UX offers to run it for the user before retrying an action.
