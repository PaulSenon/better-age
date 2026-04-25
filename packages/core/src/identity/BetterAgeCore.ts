import { Either } from "effect";
import {
	encodePublicIdentityString,
	type HomeStateDocumentV1,
	type PrivateKeyPlaintextV1,
	type PublicIdentityDocumentV1,
	parseHomeStateDocument,
	parsePublicIdentityString,
} from "../persistence/ArtifactDocument.js";

export type OwnerId = string;
export type DisplayName = string;
export type Passphrase = string;
export type IsoUtcTimestamp = string;
export type EncryptedPrivateKeyRef = string;
export type KeyFingerprint = string;
export type LocalAlias = string;

export type HomeStateDocument = HomeStateDocumentV1;
export type PrivateKeyPlaintext = PrivateKeyPlaintextV1;

export type PublicIdentitySnapshot = {
	readonly ownerId: OwnerId;
	readonly displayName: DisplayName;
	readonly publicKey: string;
	readonly identityUpdatedAt: IsoUtcTimestamp;
};

export type KnownIdentitySummary = {
	readonly ownerId: OwnerId;
	readonly publicIdentity: PublicIdentitySnapshot;
	readonly handle: string;
	readonly fingerprint: KeyFingerprint;
	readonly localAlias: LocalAlias | null;
};

export type SelfIdentitySummary = {
	readonly ownerId: OwnerId;
	readonly publicIdentity: PublicIdentitySnapshot;
	readonly handle: string;
	readonly fingerprint: KeyFingerprint;
	readonly keyMode: "pq-hybrid";
	readonly createdAt: IsoUtcTimestamp;
	readonly rotationTtl: string;
};

export type RetiredKeySummary = {
	readonly fingerprint: KeyFingerprint;
	readonly retiredAt: IsoUtcTimestamp;
};

export type CoreSuccess<TCode extends string, TValue> = {
	readonly kind: "success";
	readonly code: TCode;
	readonly value: TValue;
};

export type CoreFailure<TCode extends string, TDetails = undefined> = {
	readonly kind: "failure";
	readonly code: TCode;
	readonly details: TDetails;
};

export type CoreResponse<TResult> = {
	readonly result: TResult;
	readonly notices: readonly [];
};

export type HomeRepositoryPort = {
	loadHomeStateDocument(): Promise<unknown | null>;
	saveCurrentHomeStateDocument(document: HomeStateDocument): Promise<void>;
	readEncryptedPrivateKey(ref: EncryptedPrivateKeyRef): Promise<string>;
	writeEncryptedPrivateKey(input: {
		readonly ref: EncryptedPrivateKeyRef;
		readonly encryptedKey: string;
	}): Promise<void>;
};

export type IdentityCryptoPort = {
	generatePrivateKey(input: {
		readonly ownerId: OwnerId;
		readonly createdAt: IsoUtcTimestamp;
	}): Promise<PrivateKeyPlaintext>;
	protectPrivateKey(input: {
		readonly privateKey: PrivateKeyPlaintext;
		readonly passphrase: Passphrase;
	}): Promise<string>;
	decryptPrivateKey(input: {
		readonly encryptedKey: string;
		readonly passphrase: Passphrase;
	}): Promise<PrivateKeyPlaintext>;
};

export type ClockPort = {
	now(): Promise<IsoUtcTimestamp>;
};

export type RandomIdsPort = {
	nextOwnerId(): Promise<OwnerId>;
};

export type BetterAgeCorePorts = {
	readonly homeRepository: HomeRepositoryPort;
	readonly identityCrypto: IdentityCryptoPort;
	readonly clock: ClockPort;
	readonly randomIds: RandomIdsPort;
};

const success = <TCode extends string, TValue>(
	code: TCode,
	value: TValue,
): CoreResponse<CoreSuccess<TCode, TValue>> => ({
	result: { kind: "success", code, value },
	notices: [],
});

const failure = <TCode extends string, TDetails = undefined>(
	code: TCode,
	details: TDetails,
): CoreResponse<CoreFailure<TCode, TDetails>> => ({
	result: { kind: "failure", code, details },
	notices: [],
});

const toHandle = (input: {
	readonly displayName: DisplayName;
	readonly fingerprint: KeyFingerprint;
	readonly localAlias?: LocalAlias | null;
}) => `${input.displayName}#${input.fingerprint}`;

const keyRefFromFingerprint = (
	fingerprint: KeyFingerprint,
): EncryptedPrivateKeyRef => `keys/${fingerprint}.age`;

const fingerprintFromPublicKey = (publicKey: string): KeyFingerprint =>
	publicKey;

const toDisplayName = (input: {
	readonly displayName: DisplayName;
	readonly localAlias?: LocalAlias | null;
}) => input.localAlias ?? input.displayName;

const toKnownIdentitySummary = (
	knownIdentity: HomeStateDocument["knownIdentities"][number],
): KnownIdentitySummary => {
	const fingerprint = fingerprintFromPublicKey(knownIdentity.publicKey);
	const displayName = toDisplayName({
		displayName: knownIdentity.displayName,
		localAlias: knownIdentity.localAlias,
	});

	return {
		ownerId: knownIdentity.ownerId,
		publicIdentity: {
			ownerId: knownIdentity.ownerId,
			displayName: knownIdentity.displayName,
			publicKey: knownIdentity.publicKey,
			identityUpdatedAt: knownIdentity.identityUpdatedAt,
		},
		handle: toHandle({ displayName, fingerprint }),
		fingerprint,
		localAlias: knownIdentity.localAlias,
	};
};

const toPublicIdentity = (
	homeState: HomeStateDocument,
): PublicIdentitySnapshot => ({
	ownerId: homeState.ownerId,
	displayName: homeState.displayName,
	publicKey: homeState.currentKey.publicKey,
	identityUpdatedAt: homeState.identityUpdatedAt,
});

const toPublicIdentityDocument = (
	publicIdentity: PublicIdentitySnapshot,
): PublicIdentityDocumentV1 => ({
	kind: "better-age/public-identity",
	version: 1,
	...publicIdentity,
});

const toSelfIdentitySummary = (
	homeState: HomeStateDocument,
): SelfIdentitySummary => ({
	ownerId: homeState.ownerId,
	publicIdentity: toPublicIdentity(homeState),
	handle: toHandle({
		displayName: homeState.displayName,
		fingerprint: homeState.currentKey.fingerprint,
	}),
	fingerprint: homeState.currentKey.fingerprint,
	keyMode: "pq-hybrid",
	createdAt: homeState.currentKey.createdAt,
	rotationTtl: homeState.preferences.rotationTtl,
});

const loadCurrentHomeState = async (
	homeRepository: HomeRepositoryPort,
): Promise<HomeStateDocument | null> => {
	const document = await homeRepository.loadHomeStateDocument();

	if (document === null) {
		return null;
	}

	const parsed = parseHomeStateDocument(document);

	if (Either.isLeft(parsed)) {
		throw new Error("HOME_STATE_INVALID");
	}

	return parsed.right;
};

const isValidLocalAlias = (alias: LocalAlias): boolean =>
	/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(alias);

const isDuplicateAlias = (input: {
	readonly homeState: HomeStateDocument;
	readonly alias: LocalAlias;
	readonly exceptOwnerId?: OwnerId;
}) =>
	input.homeState.knownIdentities.some(
		(identity) =>
			identity.ownerId !== input.exceptOwnerId &&
			identity.localAlias === input.alias,
	);

const publicIdentityEquals = (
	left: PublicIdentitySnapshot,
	right: PublicIdentitySnapshot,
) =>
	left.ownerId === right.ownerId &&
	left.displayName === right.displayName &&
	left.publicKey === right.publicKey &&
	left.identityUpdatedAt === right.identityUpdatedAt;

const isValidDisplayName = (displayName: DisplayName): boolean =>
	displayName.trim().length > 0;

export const createBetterAgeCore = (ports: BetterAgeCorePorts) => {
	const createSelfIdentity = async (input: {
		readonly displayName: DisplayName;
		readonly passphrase: Passphrase;
	}) => {
		if (!isValidDisplayName(input.displayName)) {
			return failure("SETUP_NAME_INVALID", undefined);
		}

		const existingHomeState = await loadCurrentHomeState(ports.homeRepository);

		if (existingHomeState !== null) {
			return failure("SETUP_ALREADY_CONFIGURED", undefined);
		}

		const createdAt = await ports.clock.now();
		const ownerId = await ports.randomIds.nextOwnerId();
		const privateKey = await ports.identityCrypto.generatePrivateKey({
			ownerId,
			createdAt,
		});
		const encryptedKey = await ports.identityCrypto.protectPrivateKey({
			privateKey,
			passphrase: input.passphrase,
		});
		const encryptedPrivateKeyRef = keyRefFromFingerprint(
			privateKey.fingerprint,
		);

		const homeState: HomeStateDocument = {
			kind: "better-age/home-state",
			version: 1,
			ownerId,
			displayName: input.displayName,
			identityUpdatedAt: createdAt,
			currentKey: {
				publicKey: privateKey.publicKey,
				fingerprint: privateKey.fingerprint,
				encryptedPrivateKeyRef,
				createdAt,
			},
			retiredKeys: [],
			knownIdentities: [],
			preferences: { rotationTtl: "3m" },
		};

		await ports.homeRepository.writeEncryptedPrivateKey({
			ref: encryptedPrivateKeyRef,
			encryptedKey,
		});
		await ports.homeRepository.saveCurrentHomeStateDocument(homeState);

		return success("SELF_IDENTITY_CREATED", {
			ownerId,
			handle: toHandle({
				displayName: input.displayName,
				fingerprint: privateKey.fingerprint,
			}),
		});
	};

	const exportSelfIdentityString = async () => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		const publicIdentity = toPublicIdentity(homeState);

		return success("SELF_IDENTITY_STRING_EXPORTED", {
			identityString: encodePublicIdentityString(
				toPublicIdentityDocument(publicIdentity),
			),
			publicIdentity,
			handle: toHandle({
				displayName: publicIdentity.displayName,
				fingerprint: homeState.currentKey.fingerprint,
			}),
		});
	};

	const importKnownIdentity = async (input: {
		readonly identityString: string;
		readonly localAlias?: LocalAlias | null;
	}) => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		const parsedIdentity = parsePublicIdentityString(input.identityString);

		if (Either.isLeft(parsedIdentity)) {
			return failure("IDENTITY_STRING_INVALID", undefined);
		}

		const identity = parsedIdentity.right;
		const localAlias = input.localAlias ?? null;

		if (identity.ownerId === homeState.ownerId) {
			return failure("CANNOT_IMPORT_SELF_IDENTITY", undefined);
		}

		if (localAlias !== null && !isValidLocalAlias(localAlias)) {
			return failure("LOCAL_ALIAS_INVALID", undefined);
		}

		if (
			localAlias !== null &&
			isDuplicateAlias({
				homeState,
				alias: localAlias,
				exceptOwnerId: identity.ownerId,
			})
		) {
			return failure("LOCAL_ALIAS_DUPLICATE", undefined);
		}

		const existingIndex = homeState.knownIdentities.findIndex(
			(knownIdentity) => knownIdentity.ownerId === identity.ownerId,
		);
		const existingIdentity =
			existingIndex === -1
				? undefined
				: homeState.knownIdentities[existingIndex];
		const nextKnownIdentity = {
			ownerId: identity.ownerId,
			displayName: identity.displayName,
			publicKey: identity.publicKey,
			identityUpdatedAt: identity.identityUpdatedAt,
			localAlias,
		};
		const nextPublicIdentity = {
			ownerId: identity.ownerId,
			displayName: identity.displayName,
			publicKey: identity.publicKey,
			identityUpdatedAt: identity.identityUpdatedAt,
		};
		const existingPublicIdentity =
			existingIdentity === undefined
				? undefined
				: toKnownIdentitySummary(existingIdentity).publicIdentity;
		const outcome =
			existingIdentity === undefined
				? "added"
				: existingPublicIdentity !== undefined &&
						publicIdentityEquals(existingPublicIdentity, nextPublicIdentity) &&
						existingIdentity.localAlias === localAlias
					? "unchanged"
					: existingPublicIdentity !== undefined &&
							publicIdentityEquals(existingPublicIdentity, nextPublicIdentity)
						? "alias-updated"
						: "updated";
		const knownIdentities =
			existingIndex === -1
				? [...homeState.knownIdentities, nextKnownIdentity]
				: homeState.knownIdentities.map((knownIdentity, index) =>
						index === existingIndex ? nextKnownIdentity : knownIdentity,
					);

		await ports.homeRepository.saveCurrentHomeStateDocument({
			...homeState,
			knownIdentities,
		});

		const summary = toKnownIdentitySummary(nextKnownIdentity);

		return success("KNOWN_IDENTITY_IMPORTED", {
			ownerId: identity.ownerId,
			handle: summary.handle,
			outcome,
		});
	};

	const listKnownIdentities = async () => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		return success(
			"KNOWN_IDENTITIES_LISTED",
			homeState.knownIdentities.map(toKnownIdentitySummary),
		);
	};

	const getSelfIdentity = async () => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		return success("SELF_IDENTITY_FOUND", toSelfIdentitySummary(homeState));
	};

	const listRetiredKeys = async () => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		return success(
			"RETIRED_KEYS_LISTED",
			homeState.retiredKeys.map(
				(retiredKey): RetiredKeySummary => ({
					fingerprint: retiredKey.fingerprint,
					retiredAt: retiredKey.retiredAt,
				}),
			),
		);
	};

	const forgetKnownIdentity = async (input: { readonly ownerId: OwnerId }) => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		if (input.ownerId === homeState.ownerId) {
			return failure("CANNOT_FORGET_SELF_IDENTITY", undefined);
		}

		const knownIdentityExists = homeState.knownIdentities.some(
			(identity) => identity.ownerId === input.ownerId,
		);

		if (!knownIdentityExists) {
			return failure("IDENTITY_REFERENCE_NOT_FOUND", undefined);
		}

		await ports.homeRepository.saveCurrentHomeStateDocument({
			...homeState,
			knownIdentities: homeState.knownIdentities.filter(
				(identity) => identity.ownerId !== input.ownerId,
			),
		});

		return success("KNOWN_IDENTITY_FORGOTTEN", {
			ownerId: input.ownerId,
			outcome: "removed",
		});
	};

	const rotateSelfIdentity = async (input: {
		readonly passphrase: Passphrase;
	}) => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		const encryptedCurrentKey =
			await ports.homeRepository.readEncryptedPrivateKey(
				homeState.currentKey.encryptedPrivateKeyRef,
			);

		try {
			await ports.identityCrypto.decryptPrivateKey({
				encryptedKey: encryptedCurrentKey,
				passphrase: input.passphrase,
			});
		} catch {
			return failure("PASSPHRASE_INCORRECT", undefined);
		}

		const rotatedAt = await ports.clock.now();
		const nextPrivateKey = await ports.identityCrypto.generatePrivateKey({
			ownerId: homeState.ownerId,
			createdAt: rotatedAt,
		});
		const nextEncryptedPrivateKeyRef = keyRefFromFingerprint(
			nextPrivateKey.fingerprint,
		);
		const nextEncryptedKey = await ports.identityCrypto.protectPrivateKey({
			privateKey: nextPrivateKey,
			passphrase: input.passphrase,
		});

		await ports.homeRepository.writeEncryptedPrivateKey({
			ref: nextEncryptedPrivateKeyRef,
			encryptedKey: nextEncryptedKey,
		});
		await ports.homeRepository.saveCurrentHomeStateDocument({
			...homeState,
			identityUpdatedAt: rotatedAt,
			currentKey: {
				publicKey: nextPrivateKey.publicKey,
				fingerprint: nextPrivateKey.fingerprint,
				encryptedPrivateKeyRef: nextEncryptedPrivateKeyRef,
				createdAt: rotatedAt,
			},
			retiredKeys: [
				...homeState.retiredKeys,
				{
					...homeState.currentKey,
					retiredAt: rotatedAt,
				},
			],
		});

		return success("SELF_IDENTITY_ROTATED", {
			ownerId: homeState.ownerId,
			nextFingerprint: nextPrivateKey.fingerprint,
		});
	};

	const changeIdentityPassphrase = async (input: {
		readonly currentPassphrase: Passphrase;
		readonly nextPassphrase: Passphrase;
	}) => {
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		const keyRefs = [
			homeState.currentKey.encryptedPrivateKeyRef,
			...homeState.retiredKeys.map((key) => key.encryptedPrivateKeyRef),
		];

		for (const ref of keyRefs) {
			const encryptedKey =
				await ports.homeRepository.readEncryptedPrivateKey(ref);

			try {
				const privateKey = await ports.identityCrypto.decryptPrivateKey({
					encryptedKey,
					passphrase: input.currentPassphrase,
				});
				const nextEncryptedKey = await ports.identityCrypto.protectPrivateKey({
					privateKey,
					passphrase: input.nextPassphrase,
				});

				await ports.homeRepository.writeEncryptedPrivateKey({
					ref,
					encryptedKey: nextEncryptedKey,
				});
			} catch {
				return failure("PASSPHRASE_INCORRECT", undefined);
			}
		}

		return success("PASSPHRASE_CHANGED", {
			ownerId: homeState.ownerId,
		});
	};

	return {
		commands: {
			changeIdentityPassphrase,
			createSelfIdentity,
			forgetKnownIdentity,
			importKnownIdentity,
			rotateSelfIdentity,
		},
		queries: {
			exportSelfIdentityString,
			getSelfIdentity,
			listKnownIdentities,
			listRetiredKeys,
		},
	};
};
