# Plan: Better Secrets UX Refresh

> Source PRD: [BETTER_AGE_UX_PRD.md](../1-BETTER_AGE_UX_PRD.md)

## Architectural decisions

Durable decisions that apply across all phases:

- **Human entrypoint**: `bage interactive` is the primary guided human entrypoint. Bare `better-age` stays help/discovery oriented.
- **Human plaintext path**: `view` is the only human plaintext-reading command. It uses an in-process secure viewer. It never falls back to plaintext `stdout`.
- **Machine plaintext path**: `load --protocol-version=1 <path>` remains the only machine-facing plaintext contract.
- **Removed surface**: `read` is removed from the refreshed v0 product surface. Help, menus, docs, and command contracts must stop surfacing it.
- **Interaction model**: keyboard-select navigation is the primary human interaction model across guided mode and omitted-arg direct flows.
- **Payload discovery**: human omitted-path resolution scans cwd only for `.env*.enc`. No recursive discovery.
- **Update policy**: interactive human flows may offer `update` and retry. Non-interactive flows never hide mutation.
- **Viewer policy**: human secret viewing stays inside the product’s terminal UI surface. No external pager dependency and no plaintext `stdout` fallback.
- **Architecture**: retain layered structure: `domain` / `app` / `port` / `infra` / `cli`.
- **Key models**: keep current durable model centered on `Identity`, `Owner Id`, `Fingerprint`, `Identity String`, `Known Identity`, `Payload`, `Recipient`, `Payload Id`, `Envelope`, `Interactive Session`, and `Secure Viewer`.

---

## Phase 1: Interactive CLI Foundation

**User stories**: `1-12`, `51-57`

### What to build

Build the reusable interactive CLI foundation that all later UX slices depend on. This slice establishes the keyboard-navigation contract, shared menu behavior, session shell scaffolding, and the top-level `interactive` entrypoint without yet requiring the full finished file, identity, or secret-viewing flows.

This phase should deliver a coherent guided shell with:
- setup gating
- top-level scopes for file workflows and identity workflows
- stable keyboard behavior
- explicit back/quit semantics
- return-to-menu behavior after no-op or informational actions

This phase is intentionally foundational. Its purpose is to lock the interaction model once, so later phases add capabilities without inventing new navigation behavior.

### Acceptance criteria

- [ ] `bage interactive` exists and opens a keyboard-driven guided shell in TTY mode.
- [ ] Guided mode enforces one consistent navigation model for select lists, disabled rows, back, and quit.
- [ ] Guided mode routes unconfigured users into setup gating before normal menu use.
- [ ] Bare `better-age` remains help/discovery oriented and advertises `interactive`.
- [ ] `load` is not surfaced inside guided menus.
- [ ] `read` is not surfaced inside guided menus.
- [ ] The interaction foundation is reusable by later phases rather than duplicated per command.

---

## Phase 2: Payload Target Resolution

**User stories**: `19-26`

### What to build

Build the shared payload-target resolution slice used by human payload commands and by guided mode. This slice covers omitted-path behavior end to end: cwd discovery, auto-selection, keyboard selection, and non-TTY remediation.

The slice should make file targeting feel coherent whether the user enters through `interactive` or through direct commands like `inspect`, `edit`, `grant`, `revoke`, `view`, and `create`.

### Acceptance criteria

- [ ] Human existing-payload flows with omitted path resolve from cwd `.env*.enc` matches only.
- [ ] One discovered payload auto-selects and visibly confirms the selected relative path.
- [ ] Multiple discovered payloads open a keyboard-select picker with relative-path rows.
- [ ] Zero discovered payloads in TTY provide a guided recovery path for entering a target path.
- [ ] Omitted-path non-TTY invocations fail with remediation instead of prompting.
- [ ] Direct commands and guided mode share the same targeting policy.

---

## Phase 3: Secure View

**User stories**: `13-18`

### What to build

Build the human plaintext-reading slice. This introduces `view` as the dedicated human secret-reading command and wires it into guided mode. It must use the in-process secure viewer and keep plaintext off `stdout`.

This slice should establish the irreversible contract that human reading and machine loading are distinct product paths.

### Acceptance criteria

- [ ] `view` exists as the human plaintext-reading command.
- [ ] `view` warns before revealing secrets.
- [ ] `view` opens content inside the in-process secure viewer with scroll and quit behavior.
- [ ] `view` never emits plaintext to `stdout`.
- [ ] If secure viewing is unavailable, `view` fails with remediation instead of degrading to an unsafe channel.
- [ ] Guided mode can route users into `view`.

---

## Phase 4: Edit Recovery And Update Retry

**User stories**: `27-31`, `41-44`

### What to build

Build the slice that makes human mutation flows resilient: passphrase reuse, editor resolution, keyboard-driven editor chooser, invalid-edit retry loop, and interactive update gating with retry.

This phase should make `edit` feel polished and should define the shared recovery behavior reused by other human-sensitive flows.

### Acceptance criteria

- [ ] Human mutation flows prompt for passphrase lazily and reuse it within the invocation.
- [ ] Editor resolution follows one stable precedence order.
- [ ] Missing-editor recovery in TTY uses a keyboard-navigable chooser.
- [ ] Users can optionally save the chosen editor as default.
- [ ] Invalid env edits return the user to the edit loop without corrupting the payload.
- [ ] Interactive stale-payload flows can offer `update`, run it, and retry the original action.
- [ ] Non-interactive stale-payload flows continue to fail with explicit remediation.

---

## Phase 5: Identity Picker Flows

**User stories**: `32-40`, `50`

### What to build

Build the shared identity-selection slice across `grant`, `revoke`, and `forget-identity`. This phase delivers keyboard-driven identity pickers, shared row rendering, the paste/import branch for grant, disabled self rows for revoke, and post-state summaries.

This slice should convert identity-targeting UX from ad hoc text prompts into coherent keyboard navigation.

### Acceptance criteria

- [ ] `grant` with omitted identity opens a keyboard-select picker over known identities plus a paste/import path.
- [ ] Selecting the paste/import path transitions cleanly into identity-string entry.
- [ ] `revoke` with omitted identity opens a keyboard-select picker over actual current recipients.
- [ ] Self appears in revoke flows as visible but disabled.
- [ ] `forget-identity` with omitted identity opens a keyboard-select picker over known identities.
- [ ] Identity rows use one shared presentation policy.
- [ ] `grant` and `revoke` end with compact post-state summaries.

---

## Phase 6: Guided Identity Workflows

**User stories**: `3-5`, `10`, `48-49`, plus remaining guided identity/home actions implied by the PRD solution

### What to build

Build the guided identity-management slice inside `interactive`. This phase surfaces the existing identity and home actions inside the session shell with coherent routing, back behavior, and return-to-menu continuity.

The goal is that a human user can stay inside guided mode for identity tasks without dropping back to memorized direct commands.

### Acceptance criteria

- [ ] Guided mode exposes identity-management actions through keyboard navigation.
- [ ] Guided `me` is actionable and human-friendly while direct `me` remains raw and scriptable.
- [ ] Guided identity actions return users to the relevant menu after completion.
- [ ] Guided and direct identity flows preserve the same underlying product rules.
- [ ] Session continuity remains coherent across setup, export, import, forget, rotate, and passphrase-change actions.

---

## Phase 7: Product Cleanup And Contract Alignment

**User stories**: `45-57`

### What to build

Build the cleanup slice that removes stale surfaces and aligns the whole product contract to the refreshed UX. This includes command-surface cleanup, wording normalization, help alignment, and product-document consistency.

This phase is where the product stops presenting mixed old/new behavior and becomes externally coherent.

### Acceptance criteria

- [ ] `read` is removed from surfaced product UX and no stale docs/help/menu references remain.
- [ ] Help text, product docs, and package docs align with `interactive`, `view`, and `load` as the canonical human/machine paths.
- [ ] Output wording is normalized across guided and direct human flows.
- [ ] Direct and guided contracts no longer contradict each other.
- [ ] The refreshed UX contract is externally legible from help and docs without needing historical context.
