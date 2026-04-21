# Better Secrets CLI Interaction Context

This context defines the user-facing interaction contract of `better-age`: how commands, guided flows, prompts, viewers, messages, and terminal states fit together. It exists so product docs, e2e coverage, and implementation use the same words.

## Language

**Exact Invocation**:
A command call that supplies every required operand up front and must not depend on guided completion to express its intent.
_Avoid_: Pro mode, full command mode, non-interactive mode

**Guided Invocation**:
A command call that omits one or more user operands and lets the CLI complete intent through prompts, menus, or viewers.
_Avoid_: Convenience mode, wizard mode

**Interactive Terminal**:
A runtime where the CLI can safely open prompts, menus, and the secure viewer.
_Avoid_: TTY mode

**Headless Terminal**:
A runtime where guided human surfaces are unavailable even if the command itself still runs.
_Avoid_: Non-interactive mode

**Shared Flow**:
A named reusable interaction contract with explicit inputs, outputs, and terminal outcomes.
_Avoid_: Helper, brick, utility

**Flow Outcome**:
The semantic result of one flow step or subflow: `OK`, `BACK`, `CANCEL`, or `ERROR`.
_Avoid_: Return code, result state

**Back Transition**:
A local navigation return from a nested chooser or viewer to the previous flow step without committing new mutation.
_Avoid_: Cancel, quit

**Cancel Outcome**:
An intentional stop of the current command flow by the user.
_Avoid_: Error, back

**Message Id**:
A stable semantic identifier for one stdout/stderr/viewer message independent from its exact copy.
_Avoid_: Error string, status text

## Relationships

- An **Exact Invocation** must not rely on an **Interactive Terminal** to complete missing operands because no operands should be missing.
- A **Guided Invocation** may require an **Interactive Terminal**.
- A **Shared Flow** returns one **Flow Outcome** to its caller.
- A **Back Transition** is one possible **Flow Outcome** of a nested **Shared Flow**.
- A **Cancel Outcome** ends the current command flow but is not the same thing as a **Back Transition**.
- A **Message Id** belongs to one user-facing branch in one flow.

## Example dialogue

> **Dev:** "If `bage grant` runs with missing args in CI, is that the same mode as an interactive shell run?"
>
> **Domain expert:** "No. That is a **Guided Invocation** attempted in a **Headless Terminal**, so it should fail fast instead of trying human surfaces."
>
> **Dev:** "If the user presses Back inside file selection, did the command fail?"
>
> **Domain expert:** "Not necessarily. That is a **Back Transition** inside a **Shared Flow**. The caller decides whether to reopen the previous step or turn it into **Cancel Outcome**."

## Flagged ambiguities

- "mode" was used to mean both invocation completeness and terminal capability. Resolved: use **Exact Invocation** / **Guided Invocation** for command shape, and **Interactive Terminal** / **Headless Terminal** for runtime capability.
- "back", "cancel", and "quit" were drifting together. Resolved: **Back Transition** is local navigation; **Cancel Outcome** stops the command.
- "error message" was used for both semantics and rendered copy. Resolved: use **Message Id** for stable semantics and keep final copy separate.
