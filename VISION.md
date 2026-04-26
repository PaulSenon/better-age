# better-age Vision

`better-age` exists because the primitive is good, but the day-to-day UX still is not.

`age` is excellent crypto plumbing. It is small, legible, and composable. But by itself it still asks humans to manage too much ceremony around keys, sharing, rotation, and the practical act of handling encrypted env files.

`sops` solves real problems too, especially for power users who already accept a bigger tool, more concepts, and more workflow surface area. But it still asks teams to learn a lot, decide a lot, and wire a lot. That is not the bar this project is aiming for.

`better-age` is the opposite move: narrower scope, fewer decisions, stronger defaults.

## Product bet

The bet is that encrypted env files should feel dead simple if the tool is opinionated enough.

That means:
- one obvious encrypted payload file
- one local identity setup
- one shareable identity string
- one explicit grant/revoke model
- one human path for reading secrets
- one machine path for loading secrets

The intended social workflow is simple:
- ask someone to set up `better-age` once with `bage setup`
- they send their identity string with `bage identity export`
- you grant access
- from then on they can decrypt any env payload shared with that identity.

> [!NOTE]
> All identities granted to a file can revoke, grant, and share that payload.
> You own encrypted file distribution. That can be a one-time transfer, private
> repo versioning, or any sync pipeline you build on top.

The tool should remove excuses to use it badly.

## Hard constraints

Some choices are opinionated on purpose, not configurable preferences:
- key rotation is part of the model, not an optional extra (it just work, you can't disable it)
- passphrase protection is mandatory (simple built-in age passphrase encryption of your key, better than nothing)
- key mode is `pq-hybrid` (age default mode for quantum secure encryption)
- payload access is explicit
- the encrypted file stays visible and caller-owned

This project is willing to be less flexible to make the default path safer and more legible.

## Non-goals

`better-age` is not trying to be:
- a generic file encryption tool
- a cloud secret manager
- a team sync product (yet)
- a hidden project-side secret registry
- a kitchen-sink wrapper around every `age` capability

It is intentionally small and biased toward one workflow: editing and sharing encrypted env files with a team.

## UX stance

The UX goal is not “teach people encryption tooling.”

The UX goal is:
- make the right thing the easiest thing
- keep dangerous behavior out of the happy path
- avoid plaintext leakage as a fallback convenience
- keep human flows and machine flows clearly separate

This is why the project keeps distinct commands for human reading and machine loading, and why it prefers explicit maintenance over hidden mutation.

## Why varlock mattered

`better-age` was built with varlock in mind from the start.

Varlock already has a shape I like: local, explicit, composable, close to env loading. What was missing was a no-setup-feeling, no-global-install-assumption, locally controlled way to share encrypted secrets without turning the team into secret-management specialists.

So the varlock integration is not an afterthought. It is one of the main reasons the project exists.

## What success looks like

The project succeeds if teams can say:

“Set up `better-age` once. Send me your identity string once. I give you the `.env.enc` file, Done.”

Everything else is in service of making that sentence true without compromising on strong defaults.
