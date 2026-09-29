// Pure identity rules: derived fingerprints/handles, home-state transitions,
// and the known-identity import policy. No IO here.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Result } from "effect";
import type { HomeState, KnownIdentityRecord } from "../artifacts/HomeState.js";
import type { LocalKey } from "../artifacts/KeyFile.js";
import type { PublicIdentity } from "../artifacts/PublicIdentity.js";
import {
	CannotForgetSelf,
	CannotImportSelf,
	IdentityNotFound,
	KeyUpdateRequiresTrust,
	LocalAliasDuplicate,
	LocalAliasInvalid,
	SetupNameInvalid,
} from "../Errors.js";

export type { PublicIdentity };

/** Short stable id of a public key. Same formula as the stored self fingerprint. */
export const fingerprintOf = (publicKey: string): string =>
	`fp_${bytesToHex(sha256(utf8ToBytes(publicKey))).slice(0, 16)}`;

export const handleOf = (name: string, fingerprint: string): string =>
	`${name}#${fingerprint}`;

export const keyRefOf = (fingerprint: string): string =>
	`keys/${fingerprint}.age`;

export type SelfIdentity = PublicIdentity & {
	readonly fingerprint: string;
	readonly handle: string;
	readonly keyMode: "pq-hybrid";
	readonly createdAt: string;
	readonly rotationTtl: string;
};

export type KnownIdentity = PublicIdentity & {
	readonly localAlias: string | null;
	readonly fingerprint: string;
	readonly handle: string;
};

export const selfPublicIdentity = (home: HomeState): PublicIdentity => ({
	ownerId: home.ownerId,
	displayName: home.displayName,
	publicKey: home.currentKey.publicKey,
	identityUpdatedAt: home.identityUpdatedAt,
});

export const toSelfIdentity = (home: HomeState): SelfIdentity => ({
	...selfPublicIdentity(home),
	fingerprint: home.currentKey.fingerprint,
	handle: handleOf(home.displayName, home.currentKey.fingerprint),
	keyMode: "pq-hybrid",
	createdAt: home.currentKey.createdAt,
	rotationTtl: home.preferences.rotationTtl,
});

export const toKnownIdentity = (record: KnownIdentityRecord): KnownIdentity => {
	const fingerprint = fingerprintOf(record.publicKey);

	return {
		ownerId: record.ownerId,
		displayName: record.displayName,
		publicKey: record.publicKey,
		identityUpdatedAt: record.identityUpdatedAt,
		localAlias: record.localAlias,
		fingerprint,
		handle: handleOf(record.localAlias ?? record.displayName, fingerprint),
	};
};

export const samePublicIdentity = (
	left: PublicIdentity,
	right: PublicIdentity,
): boolean =>
	left.ownerId === right.ownerId &&
	left.displayName === right.displayName &&
	left.publicKey === right.publicKey &&
	left.identityUpdatedAt === right.identityUpdatedAt;

export const validateDisplayName = (
	displayName: string,
): Result.Result<string, SetupNameInvalid> =>
	displayName.trim().length === 0
		? Result.fail(new SetupNameInvalid())
		: Result.succeed(displayName);

export const newHomeState = (input: {
	readonly displayName: string;
	readonly key: LocalKey;
}): HomeState => ({
	kind: "better-age/home-state",
	version: 2,
	ownerId: input.key.ownerId,
	displayName: input.displayName,
	identityUpdatedAt: input.key.createdAt,
	currentKey: {
		publicKey: input.key.publicKey,
		fingerprint: input.key.fingerprint,
		encryptedPrivateKeyRef: keyRefOf(input.key.fingerprint),
		createdAt: input.key.createdAt,
	},
	retiredKeys: [],
	knownIdentities: [],
	preferences: { rotationTtl: "3m", editorCommand: null },
});

/** Retires the current key and makes `nextKey` current; updates the public identity. */
export const rotateHome = (home: HomeState, nextKey: LocalKey): HomeState => ({
	...home,
	identityUpdatedAt: nextKey.createdAt,
	currentKey: {
		publicKey: nextKey.publicKey,
		fingerprint: nextKey.fingerprint,
		encryptedPrivateKeyRef: keyRefOf(nextKey.fingerprint),
		createdAt: nextKey.createdAt,
	},
	retiredKeys: [
		...home.retiredKeys,
		{ ...home.currentKey, retiredAt: nextKey.createdAt },
	],
});

export const allKeyRefs = (home: HomeState): ReadonlyArray<string> => [
	home.currentKey.encryptedPrivateKeyRef,
	...home.retiredKeys.map((key) => key.encryptedPrivateKeyRef),
];

const isValidAlias = (alias: string) =>
	/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(alias);

export type ImportOutcome = "added" | "unchanged" | "alias-updated" | "updated";

/**
 * Adds or refreshes a known identity. A changed public key for a known owner
 * is only accepted with explicit trust (identities are not signed).
 */
export const importKnownIdentity = (
	home: HomeState,
	incoming: PublicIdentity,
	options: {
		readonly localAlias?: string | null | undefined;
		readonly trustKeyUpdate?: boolean | undefined;
	},
): Result.Result<
	{
		readonly home: HomeState;
		readonly identity: KnownIdentity;
		readonly outcome: ImportOutcome;
	},
	| CannotImportSelf
	| KeyUpdateRequiresTrust
	| LocalAliasInvalid
	| LocalAliasDuplicate
> => {
	if (incoming.ownerId === home.ownerId) {
		return Result.fail(new CannotImportSelf());
	}

	const existing = home.knownIdentities.find(
		(identity) => identity.ownerId === incoming.ownerId,
	);
	const localAlias = options.localAlias ?? existing?.localAlias ?? null;

	if (
		existing !== undefined &&
		existing.publicKey !== incoming.publicKey &&
		options.trustKeyUpdate !== true
	) {
		return Result.fail(
			new KeyUpdateRequiresTrust({
				ownerId: incoming.ownerId,
				oldFingerprint: fingerprintOf(existing.publicKey),
				newFingerprint: fingerprintOf(incoming.publicKey),
			}),
		);
	}

	if (localAlias !== null && !isValidAlias(localAlias)) {
		return Result.fail(new LocalAliasInvalid());
	}

	if (
		localAlias !== null &&
		home.knownIdentities.some(
			(identity) =>
				identity.ownerId !== incoming.ownerId &&
				identity.localAlias === localAlias,
		)
	) {
		return Result.fail(new LocalAliasDuplicate());
	}

	const record: KnownIdentityRecord = {
		ownerId: incoming.ownerId,
		publicKey: incoming.publicKey,
		displayName: incoming.displayName,
		identityUpdatedAt: incoming.identityUpdatedAt,
		localAlias,
	};
	const outcome: ImportOutcome =
		existing === undefined
			? "added"
			: !samePublicIdentity(existing, incoming)
				? "updated"
				: existing.localAlias === localAlias
					? "unchanged"
					: "alias-updated";

	return Result.succeed({
		home: {
			...home,
			knownIdentities:
				existing === undefined
					? [...home.knownIdentities, record]
					: home.knownIdentities.map((identity) =>
							identity.ownerId === incoming.ownerId ? record : identity,
						),
		},
		identity: toKnownIdentity(record),
		outcome,
	});
};

export const forgetKnownIdentity = (
	home: HomeState,
	ownerId: string,
): Result.Result<HomeState, CannotForgetSelf | IdentityNotFound> => {
	if (ownerId === home.ownerId) {
		return Result.fail(new CannotForgetSelf());
	}

	if (!home.knownIdentities.some((identity) => identity.ownerId === ownerId)) {
		return Result.fail(new IdentityNotFound());
	}

	return Result.succeed({
		...home,
		knownIdentities: home.knownIdentities.filter(
			(identity) => identity.ownerId !== ownerId,
		),
	});
};
