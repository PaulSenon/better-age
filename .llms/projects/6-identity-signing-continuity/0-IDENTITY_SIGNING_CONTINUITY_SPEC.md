# Better Age Identity Signing Continuity Spec

## Status

Captured for future implementation. Do not implement as part of current audit.

## Problem

Current public identity strings bind `ownerId` to a rotating age recipient only by convention. If a known identity is imported again with the same `ownerId` and a different public age key, the app cannot cryptographically prove that the new age key still belongs to the original owner.

Attack shape:

- Alice is known locally as `owner_alice`.
- Attacker shares a forged identity string with `owner_alice` and attacker-controlled age recipient.
- If accepted silently, future payload grants to Alice may encrypt to attacker.

Need:

- stable owner identity
- rotating age encryption identity
- cryptographic proof that each age recipient update belongs to same owner
- keep payload encryption interoperable with age

## Core Decision

Introduce a long-term Ed25519 owner signing key.

- `ownerId` is derived from `signingPublicKey`.
- The age encryption key remains separate and rotates.
- Public identity strings are signed claims binding the stable owner signing key to the current age recipient.
- First import is TOFU: trust the signing key for that `ownerId`.
- Later imports must use same signing public key and a valid signature.

Do not derive signing keys from age keys. Signing key and age key have different lifetimes and purposes.

## Key Roles

### Owner signing key

Purpose:

- proves continuity of owner identity
- signs public identity documents
- should not rotate in MVP

Storage:

- private signing key lives inside protected private-key artifact
- protected with same passphrase flow as age private key

Public:

- included in public identity string
- used to derive `ownerId`

### Age encryption key

Purpose:

- decrypt encrypted payloads
- public recipient encrypts payload access

Storage:

- private age identity lives inside protected private-key artifact
- protected with passphrase

Rotation:

- rotate normally
- new public identity is signed by stable owner signing key

## Proposed Public Identity V2

Canonical signed payload fields:

```ts
type PublicIdentityDocumentV2SigningPayload = {
	readonly kind: "better-age/public-identity";
	readonly version: 2;
	readonly ownerId: string;
	readonly displayName: string;
	readonly signingPublicKey: string;
	readonly ageRecipient: string;
	readonly ageRecipientFingerprint: string;
	readonly identityUpdatedAt: string;
};
```

Full document:

```ts
type PublicIdentityDocumentV2 = PublicIdentityDocumentV2SigningPayload & {
	readonly signature: string;
};
```

Rules:

- `ownerId = "owner_" + base64url(sha256(signingPublicKey)).slice(...)`
- `signature = ed25519Sign(canonicalJson(signingPayload), signingPrivateKey)`
- verification checks owner derivation and detached signature
- canonical JSON must be deterministic; do not sign raw user-provided JSON bytes

Naming note:

- Existing code calls the public age key `publicKey`.
- Future model should rename at boundary to `ageRecipient` to avoid confusing encryption keys with signing keys.

## Proposed Private Key V2

Each protected private-key artifact contains both key roles for one age generation:

```ts
type PrivateKeyPlaintextV2 = {
	readonly kind: "better-age/private-key";
	readonly version: 2;
	readonly ownerId: string;
	readonly signingPublicKey: string;
	readonly signingPrivateKey: string;
	readonly ageRecipient: string;
	readonly agePrivateKey: string;
	readonly ageRecipientFingerprint: string;
	readonly createdAt: string;
};
```

Rotation:

- keep `signingPublicKey`
- keep `signingPrivateKey`
- generate new age hybrid identity
- sign new public identity with unchanged signing key
- write new protected private-key artifact
- retire previous age private key as today

## Import Rules

### First time owner

1. Parse identity string.
2. Verify `ownerId` derives from `signingPublicKey`.
3. Verify `signature` over canonical signing payload.
4. If valid, store known identity:
   - `ownerId`
   - `displayName`
   - `signingPublicKey`
   - `ageRecipient`
   - `ageRecipientFingerprint`
   - `identityUpdatedAt`
   - optional `localAlias`

This does not prove real-world identity. It establishes TOFU continuity.

### Known owner, same signing key

1. Verify signature.
2. Verify stored `signingPublicKey === imported.signingPublicKey`.
3. If age recipient changed and signature valid, update known identity.
4. If imported timestamp/version is older, reject or mark stale; do not downgrade silently.

### Known owner, different signing key

Reject hard by default.

Possible future recovery command can exist, but it must be explicit and scary:

```sh
bage identity replace-owner-key <owner-ref>
```

No automatic replacement in import/grant.

## CLI UX

Exact/headless:

- valid first import: accept
- valid known-owner age-recipient update: accept
- invalid signature: fail
- ownerId/signing key mismatch: fail
- stale identity update: fail

Interactive:

- first import can show fingerprint summary
- signed age-recipient update can be accepted without scary prompt because cryptographic continuity is valid
- signing key mismatch should show explicit failure, not prompt-driven normal path

Suggested messages:

- `IDENTITY_SIGNATURE_INVALID`
- `IDENTITY_OWNER_ID_MISMATCH`
- `IDENTITY_SIGNING_KEY_CHANGED`
- `IDENTITY_UPDATE_STALE`

## Migration

Existing V1 identities have no signing key.

Recommended migration:

### Self identity

On local home-state migration or next setup-sensitive command:

1. Generate Ed25519 signing key.
2. Derive new `ownerId` from signing public key.
3. This is a breaking identity change if existing payloads reference old random ownerId.

Because of that, do not auto-migrate silently unless current release can break old artifacts.

Safer path:

- support V1 read/import for a compatibility window
- new setups use V2
- existing users run explicit migration command later

### Known identities

Known V1 identities remain unauthenticated:

- mark as `trustMode: "legacy-unsigned"`
- importing a V2 identity for same display name does not automatically merge
- importing V2 with old V1 `ownerId` is impossible if V2 derives ownerId from signing key

Open migration question:

- Do we preserve old random `ownerId` and add signing key, or make `ownerId` derived from signing key?

Recommendation:

- For cryptographic clarity, make V2 ownerId derived from signing key.
- Treat this as artifact/schema migration requiring explicit plan.

## Core API Changes

Identity crypto port needs signing operations:

```ts
type IdentitySigningCryptoPort = {
	generateSigningKeyPair(): Promise<{
		readonly signingPublicKey: string;
		readonly signingPrivateKey: string;
	}>;
	signPublicIdentity(input: {
		readonly payload: PublicIdentityDocumentV2SigningPayload;
		readonly signingPrivateKey: string;
	}): Promise<string>;
	verifyPublicIdentity(input: {
		readonly payload: PublicIdentityDocumentV2SigningPayload;
		readonly signature: string;
		readonly signingPublicKey: string;
	}): Promise<boolean>;
};
```

Implementation option:

- Node `crypto` Ed25519 keypair/sign/verify, or a small audited Ed25519 library.
- Prefer standard Ed25519 detached signatures.

## Test Plan

Core unit:

- creates self identity with signing key and age key
- exported identity verifies
- ownerId derives from signing public key
- tampered display name fails verification
- tampered age recipient fails verification
- tampered signing key fails ownerId derivation
- rotation changes age recipient but keeps signing key
- known owner update with valid signature updates age recipient
- known owner update with different signing key fails
- stale signed identity does not downgrade

Core integration:

- real Ed25519 signing roundtrip
- real age hybrid encryption still works
- rotated age key public identity verifies with same signing key

CLI:

- identity import V2 success
- identity import signature invalid -> stderr failure, no state write
- grant with inline V2 identity string validates before import/grant
- headless rejects malformed identity without prompt

Regression:

- payload encryption remains normal age recipient encryption
- `identity export` never includes private signing key
- stdout policy unchanged

## Non-Goals

- No signing of encrypted payload contents in this project.
- No global identity directory.
- No Web of Trust.
- No chain of every age-key rotation.
- No automatic recovery from lost signing key.
- No use of age encryption keys for signatures.

## Risks

- Stable signing key loss means owner continuity is lost.
- If signing private key is compromised, attacker can publish valid future age recipients.
- V1 migration is product-sensitive because current random owner IDs do not map to signing keys.

## Recommendation

Implement V2 only for new identities first if release pressure is high. Keep V1 support read-only/import-compatible. Plan V1-to-V2 migration as separate project.
