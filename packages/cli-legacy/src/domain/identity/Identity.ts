import { Option, Schema } from "effect";
import type { DisplayName } from "./DisplayName.js";
import type { Handle } from "./Handle.js";
import { IdentityAlias } from "./IdentityAlias.js";
import type { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import type { OwnerId } from "./OwnerId.js";
import { PrivateKeyRelativePath } from "./PrivateKeyRelativePath.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
	PublicIdentity,
} from "./PublicIdentity.js";
import type { PublicKey } from "./PublicKey.js";
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

export const LocalAliasMap = Schema.Record({
	key: Schema.String,
	value: IdentityAlias,
});

export type LocalAliasMap = Schema.Schema.Type<typeof LocalAliasMap>;

export const SelfIdentity = Schema.Struct({
	createdAt: Schema.String.pipe(Schema.minLength(20)),
	keyMode: KeyMode,
	privateKeyPath: PrivateKeyRelativePath,
	publicIdentity: PublicIdentity,
});

export type SelfIdentity = Schema.Schema.Type<typeof SelfIdentity>;

export const KnownIdentity = PublicIdentity;

export type KnownIdentity = Schema.Schema.Type<typeof KnownIdentity>;

export type ResolvedKnownIdentity = KnownIdentity & {
	readonly fingerprint: KeyFingerprint;
	readonly handle: Handle;
	readonly localAlias: Option.Option<IdentityAlias>;
};

export type ResolvedSelfIdentity = {
	readonly createdAt: SelfIdentity["createdAt"];
	readonly displayName: DisplayName;
	readonly fingerprint: KeyFingerprint;
	readonly handle: Handle;
	readonly identityUpdatedAt: IdentityUpdatedAt;
	readonly keyMode: KeyMode;
	readonly ownerId: OwnerId;
	readonly privateKeyPath: PrivateKeyRelativePath;
	readonly publicKey: PublicKey;
};

export const RetiredKey = Schema.Struct({
	fingerprint: KeyFingerprint,
	privateKeyPath: PrivateKeyRelativePath,
	retiredAt: Schema.String.pipe(Schema.minLength(20)),
});

export type RetiredKey = Schema.Schema.Type<typeof RetiredKey>;

export const toStoredIdentityRecord = (
	selfIdentity: SelfIdentity,
): StoredIdentityRecord => ({
	alias: Schema.decodeUnknownSync(IdentityAlias)(
		selfIdentity.publicIdentity.displayName,
	),
	createdAt: selfIdentity.createdAt,
	fingerprint: derivePublicIdentityFingerprint(selfIdentity.publicIdentity),
	kind: "user",
	keyMode: selfIdentity.keyMode,
	privateKeyPath: selfIdentity.privateKeyPath,
	recipient: Schema.decodeUnknownSync(Recipient)(
		selfIdentity.publicIdentity.publicKey,
	),
	status: "active",
});

export const emptyLocalAliasMap = (): LocalAliasMap => ({});

export const getLocalAlias = (
	localAliases: LocalAliasMap | undefined,
	ownerId: OwnerId,
): Option.Option<IdentityAlias> => {
	const localAlias = localAliases?.[ownerId];

	return localAlias === undefined ? Option.none() : Option.some(localAlias);
};

export const setLocalAlias = (input: {
	readonly localAlias: Option.Option<IdentityAlias>;
	readonly localAliases: LocalAliasMap;
	readonly ownerId: OwnerId;
}): LocalAliasMap => {
	if (Option.isNone(input.localAlias)) {
		const { [input.ownerId]: _removed, ...rest } = input.localAliases;

		return rest;
	}

	return {
		...input.localAliases,
		[input.ownerId]: input.localAlias.value,
	};
};

export const materializeKnownIdentity = (input: {
	readonly identity: KnownIdentity;
	readonly localAliases: LocalAliasMap | undefined;
}): ResolvedKnownIdentity => ({
	...input.identity,
	fingerprint: derivePublicIdentityFingerprint(input.identity),
	handle: derivePublicIdentityHandle(input.identity),
	localAlias: getLocalAlias(input.localAliases, input.identity.ownerId),
});

export const materializeKnownIdentities = (input: {
	readonly identities: ReadonlyArray<KnownIdentity>;
	readonly localAliases: LocalAliasMap | undefined;
}): ReadonlyArray<ResolvedKnownIdentity> =>
	input.identities.map((identity) =>
		materializeKnownIdentity({
			identity,
			localAliases: input.localAliases,
		}),
	);

export const materializeSelfIdentity = (
	selfIdentity: SelfIdentity,
): ResolvedSelfIdentity => {
	const publicIdentity = selfIdentity.publicIdentity;

	return {
		createdAt: selfIdentity.createdAt,
		displayName: publicIdentity.displayName,
		fingerprint: derivePublicIdentityFingerprint(publicIdentity),
		handle: derivePublicIdentityHandle(publicIdentity),
		identityUpdatedAt: publicIdentity.identityUpdatedAt,
		keyMode: selfIdentity.keyMode,
		ownerId: publicIdentity.ownerId,
		privateKeyPath: selfIdentity.privateKeyPath,
		publicKey: publicIdentity.publicKey,
	};
};

export const toPublicIdentityFromSelfIdentity = (
	selfIdentity: SelfIdentity,
): KnownIdentity => selfIdentity.publicIdentity;
