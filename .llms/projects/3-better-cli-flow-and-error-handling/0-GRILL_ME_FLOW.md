# Grill Me Flow Log

Append-only decision log for the better-age interaction-flow spec.

## 2026-04-19

### Q1

Question:
- In standalone guided commands, should final `BACK` map to `END.CANCEL`?

Answer:
- Yes. `END.CANCEL` ok for "back".

Decision:
- Standalone guided command final `BACK` => `END.CANCEL`.

### Q2

Question:
- Should `grant` / `revoke` / `edit` reuse existing-payload file-selection flow without inline create side-effects?

Answer:
- No "create" flow in grant/revoke/edit unless abstraction truly requires it, but prefer simplest logic, max reuse, least hacks.

Decision:
- Existing-payload shared flows must not embed create side-effects for unrelated commands.

### Q3

Question:
- Should menu hotkeys be canonical product behavior?

Answer:
- Yes.

Decision:
- Menu hotkeys are canonical product behavior.

### Q4

Question:
- `Esc` / `q` / `Ctrl+C` semantics?

Answer:
- `Esc` => `BACK` if parent exists, else `CANCEL`.
- `q` and `Ctrl+C` => always `CANCEL`.

Decision:
- Canonical menu/viewer quit-nav behavior:
  - `Esc` => `BACK` if parent exists, else `CANCEL`
  - `q` => `CANCEL`
  - `Ctrl+C` => `CANCEL`

### Q5

Question:
- Should direct commands stay first-class, human commands run exact or guided, `interactive` act as guided hub, `load` stay exact-only machine path, and `me` / `identities` stay exact-only read paths?

Answer:
- Yes.

Decision:
- Accepted command-surface policy:
  - direct commands stay first-class
  - human commands may run as exact or guided
  - `interactive` is guided hub, not separate capability set
  - `load` stays exact-only machine path
  - `me` / `identities` stay exact-only read paths

### Q6

Question:
- Should `create`, `inspect`, `view`, `edit`, `grant`, `revoke`, `update`, `add-identity`, `forget-identity`, `setup`, `rotate`, `change-passphrase` be spec'd as usable both directly and through `interactive`, with same shared subflows underneath?

Answer:
- Yes.

Decision:
- Human command flows must be spec'd once and reused by direct commands and `interactive`.

### Q7

Question:
- For guided `edit` / `grant` / `revoke`, should `update required` open one shared update gate with `Update now` / `Back` / `Cancel`, then resume original command with cached resolved operands and same command-session passphrase; while exact or headless paths fail directly?

Answer:
- Yes perfect.

Decision:
- Shared `UPDATE_GATE` accepted for guided human mutation commands.
- `Update now` resumes original command with cached resolved operands.
- Exact or headless path must not offer update gate; fail directly.

### Q8

Question:
- Should all commands that require local self identity use one shared setup gate:
  - exact/headless => fail with remediation, never auto-enter setup
  - guided/interactive => offer `Setup now` / `Back` / `Cancel`
  - if setup succeeds, resume original command at blocked step
  - commands that do not require local self identity bypass this gate

Answer:
- Perfect exact flow that makes 100% sense.

Decision:
- Shared `SETUP_GATE` accepted.
- exact/headless => fail with remediation, no auto-setup
- guided/interactive => offer `Setup now` / `Back` / `Cancel`
- successful setup resumes blocked command flow

### Q9

Question:
- For explicit direct args, should commands always trust that user intent is explicit:
  - never reinterpret arg values
  - never fallback to chooser
  - fail with precise error instead

Answer:
- Yes. Common rule: if user uses direct args, it means user knows what user wants.

Decision:
- Explicit args are authoritative.
- No chooser fallback or reinterpretation for explicit args.
- Fail with precise error when explicit arg is invalid, missing target, or unresolved.

### Q10

Question:
- Should `create` exact mode fail on existing path in all cases, with overwrite available only in guided flow?

Answer:
- Perfect.

Decision:
- `create` exact mode must fail on existing path.
- Overwrite is available only in guided flow.

### Q11

Question:
- Should passphrase retry policy be:
  - guided human flows: decrypt/auth failure => `Retry passphrase` / `Back` / `Cancel`, looping only to passphrase step
  - exact/headless flows: one passphrase attempt only
  - setup/change-passphrase guided mismatch => retry pair step
  - setup/change-passphrase exact/headless stdin mismatch => fail
  - `load` always one attempt only

Answer:
- Perfect.

Decision:
- Accepted shared passphrase retry policy exactly as proposed.

### Q12

Question:
- Should identity-ref ambiguity policy be:
  - exact => fail with explicit ambiguity error + candidate handles
  - guided typed/pasted ambiguous ref => show ambiguity then `Choose candidate` / `Edit input` / `Back` / `Cancel`
  - guided chooser-selected ref should never become ambiguous

Answer:
- Perfect.

Decision:
- Accepted shared identity ambiguity policy exactly as proposed.

### Q13

Question:
- Should `view` remove the extra reveal-confirm step and open secure viewer directly after path resolution, setup gate if needed, and passphrase?
- Viewer exit:
  - direct command => `END.OK`
  - via `interactive` => return to previous menu

Answer:
- Perfect.

Decision:
- Remove extra reveal-confirm step from `view`.
- `view` opens secure viewer directly after prerequisite steps.
- Viewer exit returns `END.OK` for direct command and previous menu for `interactive`.

### Q14

Question:
- Should `inspect` never trigger update gate, only report update state as metadata?
- In `interactive`, after successful inspect output, should there be a lightweight acknowledgment pause before returning to menu?

Answer:
- Yes perfect.

Decision:
- `inspect` never triggers update gate.
- `inspect` only reports update state as metadata.
- Interactive `inspect` success pauses for lightweight acknowledgment before returning to menu.

### Q15

Question:
- In `interactive`, should substantial text outputs pause before menu redraw, while short status lines do not?
- Applies to outputs like `inspect`, `identities`, `me` shareable string, and `show identity`.

Answer:
- Yes.

Decision:
- General rule accepted:
  - substantial interactive text outputs pause before menu redraw
  - short status lines do not

### Q16

Question:
- Should `edit` invalid-env flow be:
  - show exact validation error
  - menu: `Reopen editor` / `Discard changes and back` / `Cancel`
  - `Reopen editor` keeps same temp contents
  - `Discard changes and back` exits current edit flow without saving

Answer:
- Perfect.

Decision:
- Accepted `edit` invalid-env retry flow exactly as proposed.

### Q17

Question:
- Should self revoke be forbidden everywhere:
  - exact explicit self ref => fail
  - guided chooser hides self
  - guided typed self => explicit error then `Edit input` / `Back` / `Cancel`

Answer:
- Perfect.

Decision:
- Self revoke is forbidden everywhere in v0.
- Guided chooser must hide/disable self.
- Guided typed self uses `Edit input` / `Back` / `Cancel`.

### Q18

Question:
- Should `add-identity` classify outcomes as:
  - added
  - refreshed
  - unchanged
  - conflict only when unreconcilable
- And should self-import be forbidden rather than treated as no-op?

Answer:
- Yes perfect.

Decision:
- Accepted `add-identity` outcome model exactly as proposed.

### Q29

Question:
- Should grant identity intake collapse to one canonical flow instead of separate `Paste/import identity string` vs `Enter ref` branches?
- Accepted input kinds:
  - local alias
  - display name
  - handle
  - full identity string
- If full identity string:
  - auto import/update known identity state
  - guided interactive flow prompts for local alias only when resulting visible label would collide with self or another known identity visible label
  - if already known and current, just reuse it for the action

Answer:
- Yes.

Decision:
- There is one canonical identity-intake flow.
- Grant identity input must accept alias, display name, handle, and full identity string through the same entry path.
- Full identity strings auto import/refresh known identity state before action.
- Guided interactive flow prompts for local alias only on visible-label collision.
- If identity is already known and current, reuse it directly for the action.

### Q30

Question:
- If exact flow receives a full identity string whose imported visible label would collide, should it still proceed without blocking on local-alias prompt?

Answer:
- Yes perfect.

Decision:
- Exact identity-string intake never blocks on alias-collision prompt.
- Guided interactive intake may prompt for local alias on collision; exact intake proceeds without it.
- Self-import is forbidden, not a no-op.

### Q19

Question:
- Should `forget-identity unknown` be an unchanged success rather than an error?

Answer:
- Ok.

Decision:
- `forget-identity` unknown target is unchanged success, not error.

### Q20

Question:
- Should identity-maintenance success UX be:
  - direct command => print success/info and end
  - via `interactive` => short success/info line only, no pause
  - except substantial read-oriented outputs like `me`, `identities`, `show identity`, which do pause

Answer:
- Yes.

Decision:
- Accepted identity-maintenance success UX rule exactly as proposed.

### Q21

Question:
- In exact `setup`, if alias is omitted, should CLI use deterministic default alias automatically?

Answer:
- No auto alias in exact mode. Log error and ask for explicit.

Decision:
- Exact `setup` requires explicit alias.
- No automatic default alias in exact mode.

### Q22

Question:
- Should exact `setup` require an explicit passphrase source flag like stdin instead of secure prompting?

Answer:
- No. Plaintext passphrase stdin should not be allowed in exact mode.
- Exact mode should still prompt for secure passphrase, like `load`.

Decision:
- Final target flow disallows plaintext passphrase stdin for exact `setup`.
- Exact `setup` still uses secure passphrase prompt.
- Exact `setup` in headless terminal must fail because secure prompt is unavailable.

### Q23

Question:
- Should the global human-command passphrase rule be:
  - exact + interactive terminal => secure prompt allowed
  - exact + headless terminal => fail
  - guided + interactive terminal => secure prompt allowed
  - guided + headless terminal => fail earlier

Answer:
- Yes.

Decision:
- Accepted global human-command passphrase rule exactly as proposed.

### Q24

Question:
- Should `load` remain exact-only, require interactive secure passphrase entry, and fail entirely in headless terminal?

Answer:
- Yes. `load` shouldn't be possible if headless.

Decision:
- Final target flow: `load` requires interactive secure passphrase entry.
- `load` is impossible in headless terminal.

### Q25

Question:
- Should `interactive` session policy be:
  - interactive terminal required
  - root menu `Files` / `My identity` / `Quit`
  - if no local self identity, setup gate before root menu
  - subflow cancel/back returns to previous menu, not whole session
  - only root quit/cancel or fatal unrecoverable error ends whole session

Answer:
- Yes.

Decision:
- Accepted `interactive` session policy exactly as proposed.

### Q26

Question:
- Should final `interactive` menu shape be:
  - `Files`: create / inspect / view / edit / grant / revoke / update / back
  - `My identity`: show identity / share identity string / import identity / forget known identity / rotate identity / change passphrase / back
- And should separate `identities` not appear as its own interactive menu item?

Answer:
- Yes perfect.

Decision:
- Accepted final `interactive` menu shape exactly as proposed.
- Separate `identities` does not appear as its own interactive menu item.

### Q27

Question:
- Should identity read surfaces split as:
  - direct `me` => minimal identity string only
  - direct `identities` => rich home summary
  - interactive `Show identity` => rich home summary
  - interactive `Share identity string` => share string only

Answer:
- Yes.

Decision:
- Accepted exact split for `Show identity` / `Share identity string` / direct `me` / direct `identities`.

### Q28

Question:
- Should guided `create` use a pure new-target flow only, with no cwd payload discovery of existing files?

Answer:
- Yes.

Decision:
- Guided `create` uses pure new-target flow only.
- No cwd payload discovery inside `create`.

### Q29

Question:
- Should idempotent unchanged cases stay `END.OK`:
  - `grant` already granted / payload already newer
  - `revoke` target not currently granted

Answer:
- Ok.

Decision:
- Idempotent unchanged grant/revoke outcomes are `END.OK`, not errors.

### Q30

Question:
- Should `update` expose structured reasons on success while remaining a standalone maintenance command, except when invoked from shared `UPDATE_GATE` resume logic?

Answer:
- Yes.

Decision:
- `update` exposes structured success reasons.
- `update` remains standalone maintenance command outside shared resume logic.

### Q31

Question:
- Should `load` fail immediately on both `no self identity` and `payload needs update`, with remediation only and no gates?

Answer:
- No. `load` should only fail on no self identity.
- If payload needs update, `load` should warn but still load.

Decision:
- Final target flow: `load` fails on no self identity.
- Final target flow: `load` warns on payload-needs-update but still outputs plaintext env.

### Q32

Question:
- Should `load` payload-needs-update warning be non-fatal on `stderr` with exit `0`, while still writing env text to `stdout`?

Answer:
- Yes.

Decision:
- `load` update-needed warning is non-fatal on `stderr`.
- `load` still exits `0` and writes env text to `stdout`.

### Q33

Question:
- Should `grant` accept identity strings directly, auto-import/refresh them into known identities before mutation, and still treat overall outcome as grant-focused?

Answer:
- Yes.

Decision:
- `grant` accepts identity strings directly.
- `grant` auto-imports/refreshes pasted identity strings before recipient mutation.
- Top-level success remains a grant outcome, not an add-identity outcome.
