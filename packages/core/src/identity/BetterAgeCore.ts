import { Either } from "effect";
import {
	encodePayloadDocument,
	encodePublicIdentityString,
	type HomeStateDocumentV1,
	type PayloadDocumentV1,
	type PayloadPlaintextV1,
	type PrivateKeyPlaintextV1,
	type PublicIdentityDocumentV1,
	parseHomeStateDocument,
	parsePayloadDocument,
	parsePayloadPlaintext,
	parsePublicIdentityString,
} from "../persistence/ArtifactDocument.js";

export type OwnerId = string;
export type DisplayName = string;
export type Passphrase = string;
export type IsoUtcTimestamp = string;
export type EncryptedPrivateKeyRef = string;
export type KeyFingerprint = string;
export type LocalAlias = string;
export type PayloadPath = string;
export type PayloadId = string;
export type EnvText = string;

export type HomeStateDocument = HomeStateDocumentV1;
export type PrivateKeyPlaintext = PrivateKeyPlaintextV1;
export type PayloadPlaintext = PayloadPlaintextV1;
export type PayloadDocument = PayloadDocumentV1;

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

export type PayloadRecipientSummary = {
	readonly ownerId: OwnerId;
	readonly displayName: DisplayName;
	readonly publicKey: string;
	readonly identityUpdatedAt: IsoUtcTimestamp;
	readonly handle: string;
	readonly fingerprint: KeyFingerprint;
	readonly localAlias: LocalAlias | null;
	readonly isSelf: boolean;
	readonly isStaleSelf: boolean;
};

export type DecryptedPayload = {
	readonly path: PayloadPath;
	readonly payloadId: PayloadId;
	readonly createdAt: IsoUtcTimestamp;
	readonly lastRewrittenAt: IsoUtcTimestamp;
	readonly schemaVersion: number;
	readonly compatibility: "up-to-date" | "readable-but-outdated";
	readonly envText: EnvText;
	readonly envKeys: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<PayloadRecipientSummary>;
};

export type CoreNotice = {
	readonly level: "warning";
	readonly code: "PAYLOAD_UPDATE_RECOMMENDED";
	readonly details: {
		readonly path: PayloadPath;
		readonly reasons: ReadonlyArray<"self-recipient-refresh">;
	};
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
	readonly notices: ReadonlyArray<CoreNotice>;
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

export type PayloadRepositoryPort = {
	readPayloadFile(path: PayloadPath): Promise<string>;
	writePayloadFile(path: PayloadPath, contents: string): Promise<void>;
	payloadExists(path: PayloadPath): Promise<boolean>;
};

export type PayloadCryptoPort = {
	encryptPayload(input: {
		readonly plaintext: PayloadPlaintext;
		readonly recipients: ReadonlyArray<string>;
	}): Promise<string>;
	decryptPayload(input: {
		readonly armoredPayload: string;
		readonly privateKeys: ReadonlyArray<PrivateKeyPlaintext>;
	}): Promise<unknown>;
};

export type ClockPort = {
	now(): Promise<IsoUtcTimestamp>;
};

export type RandomIdsPort = {
	nextOwnerId(): Promise<OwnerId>;
	nextPayloadId?: () => Promise<PayloadId>;
};

export type BetterAgeCorePorts = {
	readonly homeRepository: HomeRepositoryPort;
	readonly identityCrypto: IdentityCryptoPort;
	readonly payloadRepository?: PayloadRepositoryPort;
	readonly payloadCrypto?: PayloadCryptoPort;
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

const response = <TResult>(
	result: TResult,
	notices: ReadonlyArray<CoreNotice>,
): CoreResponse<TResult> => ({ result, notices });

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

const envKeysFromText = (envText: EnvText): ReadonlyArray<string> =>
	envText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => line.split("=", 1)[0])
		.filter((key): key is string => key !== undefined && key.length > 0);

const isValidEnvText = (envText: EnvText): boolean =>
	envText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.every(
			(line) =>
				line.length === 0 ||
				line.startsWith("#") ||
				/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(line),
		);

const isSamePublicIdentity = (
	left: PublicIdentitySnapshot,
	right: PublicIdentitySnapshot,
) => publicIdentityEquals(left, right);

const selfRecipientNeedsRefresh = (
	homeState: HomeStateDocument,
	payload: PayloadPlaintext,
) => {
	const self = toPublicIdentity(homeState);
	const payloadSelf = payload.recipients.find(
		(recipient) => recipient.ownerId === homeState.ownerId,
	);

	return payloadSelf === undefined || !isSamePublicIdentity(payloadSelf, self);
};

const payloadRewriteReasons = (
	homeState: HomeStateDocument,
	payload: PayloadPlaintext,
): ReadonlyArray<"self-recipient-refresh"> =>
	selfRecipientNeedsRefresh(homeState, payload)
		? ["self-recipient-refresh"]
		: [];

const toRecipientSummary = (
	homeState: HomeStateDocument,
	recipient: PayloadPlaintext["recipients"][number],
): PayloadRecipientSummary => {
	const knownIdentity = homeState.knownIdentities.find(
		(identity) => identity.ownerId === recipient.ownerId,
	);
	const localAlias = knownIdentity?.localAlias ?? null;
	const fingerprint = fingerprintFromPublicKey(recipient.publicKey);
	const isSelf = recipient.ownerId === homeState.ownerId;
	const displayName = toDisplayName({
		displayName: recipient.displayName,
		localAlias,
	});

	return {
		ownerId: recipient.ownerId,
		displayName: recipient.displayName,
		publicKey: recipient.publicKey,
		identityUpdatedAt: recipient.identityUpdatedAt,
		handle: toHandle({ displayName, fingerprint }),
		fingerprint,
		localAlias,
		isSelf,
		isStaleSelf:
			isSelf && !isSamePublicIdentity(recipient, toPublicIdentity(homeState)),
	};
};

const parsePayloadFile = (contents: string) => {
	try {
		return parsePayloadDocument(JSON.parse(contents));
	} catch {
		return parsePayloadDocument(undefined);
	}
};

export const createBetterAgeCore = (ports: BetterAgeCorePorts) => {
	const requirePayloadPorts = () => {
		if (
			ports.payloadRepository === undefined ||
			ports.payloadCrypto === undefined
		) {
			throw new Error("Payload ports are required");
		}

		return {
			payloadRepository: ports.payloadRepository,
			payloadCrypto: ports.payloadCrypto,
		};
	};

	const decryptCurrentPrivateKey = async (input: {
		readonly homeState: HomeStateDocument;
		readonly passphrase: Passphrase;
	}) => {
		const encryptedKey = await ports.homeRepository.readEncryptedPrivateKey(
			input.homeState.currentKey.encryptedPrivateKeyRef,
		);

		return ports.identityCrypto.decryptPrivateKey({
			encryptedKey,
			passphrase: input.passphrase,
		});
	};

	const decryptLocalPrivateKeys = async (input: {
		readonly homeState: HomeStateDocument;
		readonly passphrase: Passphrase;
	}) => {
		const keyRefs = [
			input.homeState.currentKey.encryptedPrivateKeyRef,
			...input.homeState.retiredKeys.map((key) => key.encryptedPrivateKeyRef),
		];
		const privateKeys: Array<PrivateKeyPlaintext> = [];

		for (const ref of keyRefs) {
			const encryptedKey =
				await ports.homeRepository.readEncryptedPrivateKey(ref);
			privateKeys.push(
				await ports.identityCrypto.decryptPrivateKey({
					encryptedKey,
					passphrase: input.passphrase,
				}),
			);
		}

		return privateKeys;
	};

	const createPayload = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}) => {
		const { payloadRepository, payloadCrypto } = requirePayloadPorts();
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		if (await payloadRepository.payloadExists(input.path)) {
			return failure("PAYLOAD_ALREADY_EXISTS", undefined);
		}

		try {
			await decryptCurrentPrivateKey({
				homeState,
				passphrase: input.passphrase,
			});
		} catch {
			return failure("PASSPHRASE_INCORRECT", undefined);
		}

		const now = await ports.clock.now();
		const payloadId =
			(await ports.randomIds.nextPayloadId?.()) ?? `payload_${Date.now()}`;
		const self = toPublicIdentity(homeState);
		const plaintext: PayloadPlaintext = {
			kind: "better-age/payload",
			version: 1,
			payloadId,
			createdAt: now,
			lastRewrittenAt: now,
			envText: "",
			recipients: [self],
		};
		const encryptedPayload = await payloadCrypto.encryptPayload({
			plaintext,
			recipients: [self.publicKey],
		});

		await payloadRepository.writePayloadFile(
			input.path,
			encodePayloadDocument({
				kind: "better-age/payload",
				version: 1,
				encryptedPayload,
			}),
		);

		return success("PAYLOAD_CREATED", {
			path: input.path,
			payloadId,
		});
	};

	const decryptPayload = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}) => {
		const { payloadRepository, payloadCrypto } = requirePayloadPorts();
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return failure("HOME_STATE_NOT_FOUND", undefined);
		}

		let privateKeys: ReadonlyArray<PrivateKeyPlaintext>;
		try {
			privateKeys = await decryptLocalPrivateKeys({
				homeState,
				passphrase: input.passphrase,
			});
		} catch {
			return failure("PASSPHRASE_INCORRECT", undefined);
		}

		let rawPayloadFile: string;
		try {
			rawPayloadFile = await payloadRepository.readPayloadFile(input.path);
		} catch {
			return failure("PAYLOAD_NOT_FOUND", undefined);
		}

		const payloadDocument = parsePayloadFile(rawPayloadFile);

		if (Either.isLeft(payloadDocument)) {
			return failure("PAYLOAD_INVALID", undefined);
		}

		let decryptedPayload: unknown;
		try {
			decryptedPayload = await payloadCrypto.decryptPayload({
				armoredPayload: payloadDocument.right.encryptedPayload,
				privateKeys,
			});
		} catch {
			return failure("PAYLOAD_ACCESS_DENIED", undefined);
		}
		const payloadPlaintext = parsePayloadPlaintext(decryptedPayload);

		if (Either.isLeft(payloadPlaintext)) {
			return failure("PAYLOAD_INVALID", undefined);
		}

		const plaintext = payloadPlaintext.right;
		const needsSelfRefresh = selfRecipientNeedsRefresh(homeState, plaintext);
		const notices: ReadonlyArray<CoreNotice> = needsSelfRefresh
			? [
					{
						level: "warning",
						code: "PAYLOAD_UPDATE_RECOMMENDED",
						details: {
							path: input.path,
							reasons: ["self-recipient-refresh"],
						},
					},
				]
			: [];

		return response(
			{
				kind: "success" as const,
				code: "PAYLOAD_DECRYPTED" as const,
				value: {
					path: input.path,
					payloadId: plaintext.payloadId,
					createdAt: plaintext.createdAt,
					lastRewrittenAt: plaintext.lastRewrittenAt,
					schemaVersion: plaintext.version,
					compatibility: needsSelfRefresh
						? "readable-but-outdated"
						: "up-to-date",
					envText: plaintext.envText,
					envKeys: envKeysFromText(plaintext.envText),
					recipients: plaintext.recipients.map((recipient) =>
						toRecipientSummary(homeState, recipient),
					),
				} satisfies DecryptedPayload,
			},
			notices,
		);
	};

	const openPayloadPlaintext = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}) => {
		const { payloadRepository, payloadCrypto } = requirePayloadPorts();
		const homeState = await loadCurrentHomeState(ports.homeRepository);

		if (homeState === null) {
			return {
				kind: "failure" as const,
				response: failure("HOME_STATE_NOT_FOUND", undefined),
			};
		}

		let privateKeys: ReadonlyArray<PrivateKeyPlaintext>;
		try {
			privateKeys = await decryptLocalPrivateKeys({
				homeState,
				passphrase: input.passphrase,
			});
		} catch {
			return {
				kind: "failure" as const,
				response: failure("PASSPHRASE_INCORRECT", undefined),
			};
		}

		let rawPayloadFile: string;
		try {
			rawPayloadFile = await payloadRepository.readPayloadFile(input.path);
		} catch {
			return {
				kind: "failure" as const,
				response: failure("PAYLOAD_NOT_FOUND", undefined),
			};
		}

		const payloadDocument = parsePayloadFile(rawPayloadFile);

		if (Either.isLeft(payloadDocument)) {
			return {
				kind: "failure" as const,
				response: failure("PAYLOAD_INVALID", undefined),
			};
		}

		let decryptedPayload: unknown;
		try {
			decryptedPayload = await payloadCrypto.decryptPayload({
				armoredPayload: payloadDocument.right.encryptedPayload,
				privateKeys,
			});
		} catch {
			return {
				kind: "failure" as const,
				response: failure("PAYLOAD_ACCESS_DENIED", undefined),
			};
		}
		const payloadPlaintext = parsePayloadPlaintext(decryptedPayload);

		if (Either.isLeft(payloadPlaintext)) {
			return {
				kind: "failure" as const,
				response: failure("PAYLOAD_INVALID", undefined),
			};
		}

		return {
			kind: "success" as const,
			homeState,
			payloadCrypto,
			payloadRepository,
			plaintext: payloadPlaintext.right,
		};
	};

	const writePayloadPlaintext = async (input: {
		readonly path: PayloadPath;
		readonly payloadCrypto: PayloadCryptoPort;
		readonly payloadRepository: PayloadRepositoryPort;
		readonly plaintext: PayloadPlaintext;
	}) => {
		const encryptedPayload = await input.payloadCrypto.encryptPayload({
			plaintext: input.plaintext,
			recipients: input.plaintext.recipients.map(
				(recipient) => recipient.publicKey,
			),
		});

		await input.payloadRepository.writePayloadFile(
			input.path,
			encodePayloadDocument({
				kind: "better-age/payload",
				version: 1,
				encryptedPayload,
			}),
		);
	};

	const editPayload = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly editedEnvText: EnvText;
	}) => {
		if (!isValidEnvText(input.editedEnvText)) {
			return failure("PAYLOAD_ENV_INVALID", undefined);
		}

		const opened = await openPayloadPlaintext(input);

		if (opened.kind === "failure") {
			return opened.response;
		}

		if (payloadRewriteReasons(opened.homeState, opened.plaintext).length > 0) {
			return failure("PAYLOAD_UPDATE_REQUIRED", {
				path: input.path,
				reasons: payloadRewriteReasons(opened.homeState, opened.plaintext),
			});
		}

		const outcome =
			opened.plaintext.envText === input.editedEnvText ? "unchanged" : "edited";

		if (outcome === "edited") {
			await writePayloadPlaintext({
				path: input.path,
				payloadCrypto: opened.payloadCrypto,
				payloadRepository: opened.payloadRepository,
				plaintext: {
					...opened.plaintext,
					envText: input.editedEnvText,
					lastRewrittenAt: await ports.clock.now(),
				},
			});
		}

		return success("PAYLOAD_EDITED", {
			path: input.path,
			payloadId: opened.plaintext.payloadId,
			outcome,
		});
	};

	const grantPayloadRecipient = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly recipient: PublicIdentitySnapshot;
	}) => {
		const opened = await openPayloadPlaintext(input);

		if (opened.kind === "failure") {
			return opened.response;
		}

		if (input.recipient.ownerId === opened.homeState.ownerId) {
			return failure("CANNOT_GRANT_SELF", undefined);
		}

		if (payloadRewriteReasons(opened.homeState, opened.plaintext).length > 0) {
			return failure("PAYLOAD_UPDATE_REQUIRED", {
				path: input.path,
				reasons: payloadRewriteReasons(opened.homeState, opened.plaintext),
			});
		}

		const existingRecipient = opened.plaintext.recipients.find(
			(recipient) => recipient.ownerId === input.recipient.ownerId,
		);
		const outcome =
			existingRecipient === undefined
				? "added"
				: publicIdentityEquals(existingRecipient, input.recipient)
					? "unchanged"
					: "updated";

		if (outcome !== "unchanged") {
			const recipients =
				existingRecipient === undefined
					? [...opened.plaintext.recipients, input.recipient]
					: opened.plaintext.recipients.map((recipient) =>
							recipient.ownerId === input.recipient.ownerId
								? input.recipient
								: recipient,
						);

			await writePayloadPlaintext({
				path: input.path,
				payloadCrypto: opened.payloadCrypto,
				payloadRepository: opened.payloadRepository,
				plaintext: {
					...opened.plaintext,
					recipients,
					lastRewrittenAt: await ports.clock.now(),
				},
			});
		}

		return success("PAYLOAD_RECIPIENT_GRANTED", {
			path: input.path,
			payloadId: opened.plaintext.payloadId,
			recipient: input.recipient,
			outcome,
			...(outcome === "unchanged"
				? { unchangedReason: "already-granted" as const }
				: {}),
		});
	};

	const revokePayloadRecipient = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly recipientOwnerId: OwnerId;
	}) => {
		const opened = await openPayloadPlaintext(input);

		if (opened.kind === "failure") {
			return opened.response;
		}

		if (input.recipientOwnerId === opened.homeState.ownerId) {
			return failure("CANNOT_REVOKE_SELF", undefined);
		}

		if (payloadRewriteReasons(opened.homeState, opened.plaintext).length > 0) {
			return failure("PAYLOAD_UPDATE_REQUIRED", {
				path: input.path,
				reasons: payloadRewriteReasons(opened.homeState, opened.plaintext),
			});
		}

		const existingRecipient = opened.plaintext.recipients.find(
			(recipient) => recipient.ownerId === input.recipientOwnerId,
		);
		const outcome = existingRecipient === undefined ? "unchanged" : "removed";

		if (outcome === "removed") {
			await writePayloadPlaintext({
				path: input.path,
				payloadCrypto: opened.payloadCrypto,
				payloadRepository: opened.payloadRepository,
				plaintext: {
					...opened.plaintext,
					recipients: opened.plaintext.recipients.filter(
						(recipient) => recipient.ownerId !== input.recipientOwnerId,
					),
					lastRewrittenAt: await ports.clock.now(),
				},
			});
		}

		return success("PAYLOAD_RECIPIENT_REVOKED", {
			path: input.path,
			payloadId: opened.plaintext.payloadId,
			recipientOwnerId: input.recipientOwnerId,
			outcome,
			...(outcome === "unchanged"
				? { unchangedReason: "recipient-not-granted" as const }
				: {}),
		});
	};

	const updatePayload = async (input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}) => {
		const opened = await openPayloadPlaintext(input);

		if (opened.kind === "failure") {
			return opened.response;
		}

		const rewriteReasons = payloadRewriteReasons(
			opened.homeState,
			opened.plaintext,
		);

		if (rewriteReasons.length === 0) {
			return success("PAYLOAD_UPDATED", {
				path: input.path,
				payloadId: opened.plaintext.payloadId,
				outcome: "unchanged",
				rewriteReasons,
			});
		}

		const self = toPublicIdentity(opened.homeState);
		const otherRecipients = opened.plaintext.recipients.filter(
			(recipient) => recipient.ownerId !== opened.homeState.ownerId,
		);

		await writePayloadPlaintext({
			path: input.path,
			payloadCrypto: opened.payloadCrypto,
			payloadRepository: opened.payloadRepository,
			plaintext: {
				...opened.plaintext,
				recipients: [self, ...otherRecipients],
				lastRewrittenAt: await ports.clock.now(),
			},
		});

		return success("PAYLOAD_UPDATED", {
			path: input.path,
			payloadId: opened.plaintext.payloadId,
			outcome: "updated",
			rewriteReasons,
		});
	};

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

		if (identity.ownerId === homeState.ownerId) {
			return failure("CANNOT_IMPORT_SELF_IDENTITY", undefined);
		}

		const existingIndex = homeState.knownIdentities.findIndex(
			(knownIdentity) => knownIdentity.ownerId === identity.ownerId,
		);
		const existingIdentity =
			existingIndex === -1
				? undefined
				: homeState.knownIdentities[existingIndex];
		const localAlias = input.localAlias ?? existingIdentity?.localAlias ?? null;

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
			createPayload,
			createSelfIdentity,
			editPayload,
			forgetKnownIdentity,
			grantPayloadRecipient,
			importKnownIdentity,
			rotateSelfIdentity,
			revokePayloadRecipient,
			updatePayload,
		},
		queries: {
			decryptPayload,
			exportSelfIdentityString,
			getSelfIdentity,
			listKnownIdentities,
			listRetiredKeys,
		},
	};
};
