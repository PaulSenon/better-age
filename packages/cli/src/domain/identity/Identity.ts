import { Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { Handle } from "./Handle.js";
import { IdentityAlias } from "./IdentityAlias.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PrivateKeyRelativePath } from "./PrivateKeyRelativePath.js";
import { PublicKey } from "./PublicKey.js";
import { Recipient } from "./Recipient.js";

export const IdentityKind = Schema.Literal("user", "machine");
export type IdentityKind = Schema.Schema.Type<typeof IdentityKind>;

export const KeyMode = Schema.Literal("pq-hybrid");
export type KeyMode = Schema.Schema.Type<typeof KeyMode>;

export const StoredIdentityStatus = Schema.Literal("active", "retired");
export type StoredIdentityStatus = Schema.Schema.Type<
	typeof StoredIdentityStatus
>;

export const StoredIdentityRecord = Schema.Struct({
	alias: IdentityAlias,
	createdAt: Schema.String.pipe(Schema.minLength(20)),
	fingerprint: KeyFingerprint,
	kind: IdentityKind,
	keyMode: KeyMode,
	privateKeyPath: PrivateKeyRelativePath,
	recipient: Recipient,
	status: StoredIdentityStatus,
});

export type StoredIdentityRecord = Schema.Schema.Type<
	typeof StoredIdentityRecord
>;

export const SelfIdentity = Schema.Struct({
	createdAt: Schema.String.pipe(Schema.minLength(20)),
	displayName: DisplayName,
	fingerprint: KeyFingerprint,
	handle: Handle,
	identityUpdatedAt: IdentityUpdatedAt,
	keyMode: KeyMode,
	ownerId: OwnerId,
	privateKeyPath: PrivateKeyRelativePath,
	publicKey: PublicKey,
});

export type SelfIdentity = Schema.Schema.Type<typeof SelfIdentity>;

export const KnownIdentity = Schema.Struct({
	displayName: DisplayName,
	fingerprint: KeyFingerprint,
	handle: Handle,
	identityUpdatedAt: IdentityUpdatedAt,
	localAlias: Schema.OptionFromNullOr(IdentityAlias),
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type KnownIdentity = Schema.Schema.Type<typeof KnownIdentity>;

export const RetiredKey = Schema.Struct({
	fingerprint: KeyFingerprint,
	privateKeyPath: PrivateKeyRelativePath,
	retiredAt: Schema.String.pipe(Schema.minLength(20)),
});

export type RetiredKey = Schema.Schema.Type<typeof RetiredKey>;

export const toStoredIdentityRecord = (
	selfIdentity: SelfIdentity,
): StoredIdentityRecord => ({
	alias: Schema.decodeUnknownSync(IdentityAlias)(selfIdentity.displayName),
	createdAt: selfIdentity.createdAt,
	fingerprint: selfIdentity.fingerprint,
	kind: "user",
	keyMode: selfIdentity.keyMode,
	privateKeyPath: selfIdentity.privateKeyPath,
	recipient: Schema.decodeUnknownSync(Recipient)(selfIdentity.publicKey),
	status: "active",
});
