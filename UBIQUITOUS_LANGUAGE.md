# Ubiquitous Language

## Identity model

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Identity** | A long-lived cryptographic identity rooted by one stable **Owner Id** and one current key snapshot. | Account, profile, user key |
| **Owner Id** | The stable identifier of an **Identity** that survives key rotation. Canonical v0 text format: `bsid1_<16hex>`. | Identity id, canonical fingerprint, account id |
| **Fingerprint** | The stable identifier of one concrete public key. | Identity id, owner id, key id |
| **Display Name** | A human-readable name chosen by the identity owner. | Alias, id, username |
| **Handle** | The ergonomic reference formed as `<display-name>#<first-8-hex-of-owner-id-body>`. Example: `toto#069f7576`. | Alias, identity id, key id |
| **Identity String** | The versioned shareable one-line export of an **Identity** used by **Identity Export** and **Identity Import**. Any future plaintext URL path hints are cosmetic only; decoded payload is authoritative. | Shared ref, identity ref, pubkey string |
| **Identity Updated At** | The UTC timestamp for when an **Identity** snapshot became current. | Last seen at, exported at, rotated at |
| **Passphrase** | The required secret that protects the local private key material and gates decrypt operations. | Password, unlock code |
| **Known Identity** | A home-local address-book entry for an external **Identity**. | Contact, saved recipient, known host |
| **Local Alias** | A home-local nickname pointing to one **Known Identity** (used to overlay identity `Display Name` in case of name colision, just for convenience). | Display name, handle, identity id |
| **Key Mode** | The cryptographic key mode carried by local identity records. Current canonical value: `pq-hybrid`. | Crypto mode, algorithm preset |
| **Forget Identity** | The local-only operation that removes one **Known Identity** from **Home State** without touching any **Payload**. | Revoke identity, delete recipient, unshare |

## CLI command language

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Root Payload Commands** | The short root-level CLI verbs for payload work: `create`, `edit`, `grant`, `revoke`, `inspect`, `view`, `load`, `update`. | File commands, payload namespace |
| **Identity Command Group** | The grouped CLI surface rooted at `bage identity ...` for local identity and address-book operations. | User commands, local commands |
| **Setup Command** | The root command `bage setup`, which creates the local self identity state. | Identity setup, init user |
| **Identity Export** | The command `bage identity export`, which prints the current local **Identity String**. | Me, share identity |
| **Identity List** | The command `bage identity list`, which inspects local self identity, known identities, and retired keys. | Identities, inspect home |
| **Identity Import** | The command `bage identity import`, which saves an external **Identity String** as a **Known Identity**. | Add identity, import contact |
| **Identity Forget** | The command `bage identity forget`, which performs **Forget Identity**. | Forget identity, remove contact |
| **Identity Rotate** | The command `bage identity rotate`, which performs **Key Rotation** for the local self identity. | Rotate, rekey |
| **Identity Passphrase** | The command `bage identity passphrase`, which changes the local self identity **Passphrase**. | Change passphrase, passphrase change |
| **Interactive Alias** | The short alias `bage i` for the **Interactive Command**. | Shortcut mode, shell alias |
| **Passphrase Aliases** | The short aliases `bage identity pw` and `bage identity pass` for **Identity Passphrase**. | Password cmd, passphrase shortcut |
| **Interactive Command** | The root command `bage interactive`, which opens the **Interactive Session**. | Wizard command, menu command |

## Payload model

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Payload** | A caller-owned encrypted env file containing secrets, metadata, and granted access. | Bundle, bag, vault, project state |
| **Payload Id** | The stable identifier of one **Payload** across normal rewrites. Canonical v0 text format: `bspld_<16hex>`. | Version id, file id, path |
| **Recipient** | An **Identity** currently granted to decrypt one **Payload**. | Share target, contact, user |
| **Recipient Entry** | The payload-stored snapshot of one granted **Recipient**. | ACL line, alias entry, recipient row |
| **Grant** | The operation that adds or refreshes one **Recipient** in a **Payload**. | Share, send, invite |
| **Revoke** | The operation that removes one **Recipient** from future rewritten versions of a **Payload**. | Delete, unshare, ban |
| **Inspect** | The operation that reads non-secret **Payload** metadata and env key names. | Show recipients, ls, show |
| **View** | The human plaintext-reading operation that opens one **Payload** inside the secure in-process viewer. | Read, cat, open |
| **Load** | The machine-output operation that decrypts one **Payload** and writes raw `.env` text to `stdout` for another process to consume. For MVP, it still requires interactive passphrase acquisition. | Read, view, export, decrypt |
| **Update** | The explicit maintenance operation that rewrites a **Payload** only for schema migration or refreshing a stale **Self Recipient**. | Repair, migrate, refresh |
| **Self Recipient** | The **Recipient Entry** in a payload whose `ownerId` matches the current local self identity. | Owner row, local recipient, self key row |

## Local state and lifecycle

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Home State** | The local persisted state under the tool home directory. | Config, cache, metadata db |
| **Key Rotation** | Replacing the current key of an **Identity** while keeping the same **Owner Id**. | Rekey identity, rename identity |
| **Retired Key** | A previously active local key kept after **Key Rotation** for historical decryptability. | Old key, archived key |
| **Display Snapshot** | The payload-stored or home-stored copy of a **Display Name** used only for UX. | Alias, canonical name |
| **Preamble** | The static plaintext instructional header at the top of a payload file. | Metadata header, comments block |
| **Envelope** | The decrypted structured payload body containing metadata plus `envText`. | Container, inner blob, payload json |
| **You Marker** | A viewer-relative render hint such as `[you]` shown when a listed identity is the current local self identity. It is never persisted as payload or home-state data. | Me flag, self tag |
| **Interactive Session** | The guided keyboard-navigable CLI mode entered through `bage interactive`. | Wizard, shell, menu mode |
| **Secure Viewer** | The in-process scrollable readonly terminal surface used by **View**. It may render plaintext to the terminal UI, but it must never fall back to plaintext `stdout`. | Pager, less, cat view |

## Interaction model

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Exact Invocation** | A command call that supplies every required non-secret operand up front. Passphrase acquisition is a separate credential step, not an operand-completeness signal. | Full command mode, non-interactive mode |
| **Guided Invocation** | A command call that omits one or more non-secret operands and lets the CLI complete intent through prompts, pickers, or viewers when an **Interactive Terminal** is available. | Wizard mode, convenience mode |
| **Interactive Terminal** | A runtime where prompts, menus, and the secure viewer can open safely. | TTY mode |
| **Headless Terminal** | A runtime where guided human surfaces are unavailable even if a command still runs. | Non-interactive mode |
| **Payload Context** | The command-local in-memory result of opening/decrypting one existing **Payload** early so later flow steps can fail fast and build contextual prompts. | Payload session, decrypted cache |
| **Passphrase Retry** | The inline retry loop after a wrong passphrase during interactive credential acquisition. Target policy: 3 total attempts, then fail. | Retry menu, unlock flow |
| **Grant Recipient Picker** | The guided `grant` picker that merges self identity, local known identities, and current payload recipients into one rendered list plus a custom identity-string entry. | Share picker, identity chooser |
| **Flow Outcome** | The semantic result of one guided step: `OK`, `BACK`, `CANCEL`, or `ERROR`. | Return code, result state |
| **Back Transition** | A local navigation return from a nested step without committing new mutation. | Cancel, quit |
| **Cancel Outcome** | An intentional stop of the current command flow by the user. | Error, back |
| **Message Id** | A stable semantic identifier for one user-facing branch independent from exact rendered copy. | Error string, status text |

## Varlock integration

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Load Protocol** | The versioned stdout/stderr/exit-code contract used by other tools to invoke **Load** safely. | Machine interface, API, machine mode |
| **Varlock Plugin** | The thin adapter that invokes `better-age` **Load** and injects the resulting env text into one `varlock` run. | Core, second CLI, loader |
| **Launcher Prefix** | The user-configured command prefix that starts the `better-age` CLI before the plugin appends fixed `load` arguments. | Full command, runner, shell script |
| **CLI Runtime Requirement** | The requirement that the `better-age` CLI be invokable at runtime by the **Varlock Plugin**. | Peer dependency, bundled CLI |

## Relationships

- An **Identity** has exactly one stable **Owner Id**.
- An **Identity** has exactly one current **Fingerprint** at a time.
- An **Identity String** exports one current snapshot of one **Identity**.
- A **Known Identity** belongs to one local **Home State**.
- A **Local Alias** points to exactly one **Known Identity**.
- A **Forget Identity** removes one **Known Identity** from **Home State** only.
- An **Identity Command Group** contains **Identity Export**, **Identity List**, **Identity Import**, **Identity Forget**, **Identity Rotate**, and **Identity Passphrase**.
- **Identity Import** is the MVP command that can set or change **Local Alias**.
- The **Setup Command** is root-level even though it creates local identity state.
- A **Passphrase** is required for local private-key protection.
- A **Key Mode** belongs to one concrete local identity record.
- A **Payload** has exactly one stable **Payload Id**.
- A **Payload** contains zero or more **Recipient Entries**.
- A **Recipient Entry** refers to one **Identity** by **Owner Id** and current key snapshot.
- A **Grant** adds or refreshes one **Recipient Entry** in a **Payload**.
- A **Revoke** removes one **Recipient Entry** from future rewritten versions of a **Payload**.
- A **View** opens one **Payload** in the **Secure Viewer** for human reading.
- A **Load** reads exactly one **Payload** path per invocation.
- **Load** is machine-output, not headless by default.
- **Load** requires an **Interactive Terminal** for passphrase acquisition in MVP.
- **Load** fails immediately with explicit remediation when passphrase acquisition is unavailable.
- An **Update** may rewrite a **Payload** without changing non-self access intent.
- The **Root Payload Commands** are the canonical short CLI surface for payload work.
- A **Self Recipient** may become stale after **Key Rotation**.
- A **Key Rotation** keeps the same **Owner Id** but changes the current **Fingerprint**.
- A **Retired Key** belongs to one local **Identity** history in **Home State**.
- A **Preamble** belongs to one **Payload** file but carries no sensitive metadata.
- An **Envelope** belongs to one **Payload** and contains both metadata and env content.
- A **You Marker** is computed at render time from current local self identity.
- An **Interactive Session** routes human workflows through keyboard-select navigation.
- A **Secure Viewer** belongs to the human UX path and is distinct from **Load**.
- An **Exact Invocation** must not rely on an **Interactive Terminal** to complete missing operands.
- An **Exact Invocation** may still require an interactive passphrase prompt unless a later headless credential channel is explicitly specified.
- A **Guided Invocation** may require an **Interactive Terminal**.
- Payload-content commands create a **Payload Context** early after path and passphrase are available.
- Payload-content commands are `inspect`, `view`, `edit`, `grant`, `revoke`, `update`, and `load`.
- **Create** requires passphrase acquisition but never creates a **Payload Context** because no existing payload is read.
- **Passphrase Retry** does not reopen operand choosers; it only repeats passphrase prompt.
- **Grant Recipient Picker** merges identities by **Owner Id** and treats **Local Alias** as display overlay only.
- Payload recipients discovered during a payload open may silently refresh an existing **Known Identity** when newer, but unknown recipients remain transient in MVP.
- A **Back Transition** is one possible **Flow Outcome** of a guided subflow.
- A **Cancel Outcome** stops the current command flow and is not the same as **Back Transition**.
- A **Message Id** belongs to one semantic user-facing branch.
- A **Load Protocol** versions one stable contract for **Load** behavior.
- A **Varlock Plugin** depends on the **Load Protocol** of the CLI.
- A **Launcher Prefix** starts the CLI, but the plugin owns the appended `load` arguments.
- A **CLI Runtime Requirement** belongs to the **Varlock Plugin** runtime, not to payload or identity domain state.

## Example dialogue

> **Dev:** "When I paste someone's `identity export` output into `identity import`, what am I storing?"

> **Domain expert:** "A **Known Identity** derived from an **Identity String**. The payload is untouched."

> **Dev:** "Then `grant` changes the payload by adding a **Recipient Entry** for that **Identity**?"

> **Domain expert:** "Exactly. The **Identity** exists independently. A **Recipient** is that identity granted on one **Payload**."

> **Dev:** "If I run `grant` without enough args in CI, should it open a picker?"

> **Domain expert:** "No. That is a **Guided Invocation** attempted in a **Headless Terminal**. It should fail instead of opening human UI."

> **Dev:** "And when I rotate locally, what becomes stale?"

> **Domain expert:** "Your **Self Recipient** inside older payloads. Same **Owner Id**, new **Fingerprint**, explicit **Update** later."

> **Dev:** "So varlock never gets the human viewer path?"

> **Domain expert:** "Correct. The **Varlock Plugin** depends only on **Load** through the **Load Protocol**."

## Flagged ambiguities

- "share" was used to mean both **Grant** and file delivery. Recommendation: do not use "share" in the base model.
- "alias" was used for both owner-provided **Display Name** and local-only **Local Alias**. Recommendation: keep them distinct.
- "identity id" was used to mean both **Owner Id** and **Fingerprint**. Recommendation: use **Owner Id** for long-lived identity continuity and **Fingerprint** for the current key.
- "identity ref", "shared string", and "`identity export` output" were used for the same concept. Recommendation: standardize on **Identity String**.
- "recipient" and "identity" were sometimes used interchangeably. Recommendation: an **Identity** exists independently; a **Recipient** is an **Identity** granted in a specific **Payload**.
- "repair", "migrate", and "refresh" overlapped around payload maintenance. Recommendation: standardize on **Update** for the explicit command and reserve migration/refresh for implementation details.
- "read", "view", "decrypt", and "export" were drifting across human and machine plaintext behavior. Recommendation: standardize on **View** for human reading and **Load** for machine plaintext output.
- "machine interface" and "protocol" were used for the same CLI compatibility boundary. Recommendation: standardize on **Load Protocol** and reserve "protocol version" for the explicit `--protocol-version` flag.
- "plugin", "core", and "adapter" were drifting. Recommendation: standardize on **Varlock Plugin** as a thin adapter and avoid implying a second core implementation.
- "command" was ambiguous between a full shell command and a fixed binary name. Recommendation: standardize on **Launcher Prefix** for the user-provided shell string prefix that the plugin extends.
- "mode" was used to mean both command completeness and terminal capability. Recommendation: use **Exact Invocation** / **Guided Invocation** for command shape, and **Interactive Terminal** / **Headless Terminal** for runtime capability.
- "back", "cancel", and "quit" were drifting together. Recommendation: **Back Transition** is local navigation; **Cancel Outcome** stops the current command.
- CLI flag `--alias` currently sets **Display Name** during **Identity Setup**. Recommendation: keep **Display Name** as canonical domain term and treat the flag name as legacy CLI wording.
