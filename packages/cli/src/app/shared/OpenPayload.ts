import { Effect, Option, Schema } from "effect";
import type { HomeState } from "../../domain/home/HomeState.js";
import { isSelfOwnerId } from "../../domain/home/SelfIdentityGuard.js";
import { Handle } from "../../domain/identity/Handle.js";
import {
	KnownIdentity,
	type KnownIdentity as KnownIdentityType,
} from "../../domain/identity/Identity.js";
import { getEnvKeyNames } from "../../domain/payload/EnvText.js";
import { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { parsePayloadFile } from "../../domain/payload/PayloadFile.js";
import {
	getPayloadNeedsUpdate,
	type PayloadNeedsUpdate,
} from "../../domain/payload/PayloadNeedsUpdate.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
	PrivateKeyReadError,
} from "../../port/HomeRepositoryError.js";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import type { PayloadDecryptError } from "../../port/PayloadCryptoError.js";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import type {
	PayloadReadError,
	PayloadWriteError,
} from "../../port/PayloadRepositoryError.js";
import {
	OpenPayloadCryptoError,
	OpenPayloadEnvError,
	OpenPayloadEnvelopeError,
	OpenPayloadFileFormatError,
	OpenPayloadPersistenceError,
} from "./OpenPayloadError.js";

const toPersistenceError = (
	operation: string,
	error:
		| HomeStateDecodeError
		| HomeStateLoadError
		| HomeStateSaveError
		| PrivateKeyReadError
		| PayloadReadError
		| PayloadWriteError,
) =>
	new OpenPayloadPersistenceError({
		message: error.message,
		operation,
	});

const toHandle = (displayName: string, ownerId: string) =>
	Schema.decodeUnknownSync(Handle)(
		`${displayName}#${ownerId.slice("bsid1_".length, "bsid1_".length + 8)}`,
	);

const toKnownIdentity = (
	recipient: Schema.Schema.Type<typeof PayloadEnvelope>["recipients"][number],
): KnownIdentityType =>
	Schema.decodeUnknownSync(KnownIdentity)({
		displayName: recipient.displayNameSnapshot,
		fingerprint: recipient.fingerprint,
		handle: toHandle(recipient.displayNameSnapshot, recipient.ownerId),
		identityUpdatedAt: recipient.identityUpdatedAt,
		localAlias: null,
		ownerId: recipient.ownerId,
		publicKey: recipient.publicKey,
	});

const mergeKnownIdentities = (
	state: HomeState,
	recipients: Schema.Schema.Type<typeof PayloadEnvelope>["recipients"],
): HomeState => {
	let didChange = false;
	const nextKnownIdentities = [...state.knownIdentities];

	for (const recipient of recipients) {
		if (isSelfOwnerId(state, recipient.ownerId)) {
			continue;
		}

		const existingIndex = nextKnownIdentities.findIndex(
			(identity) => identity.ownerId === recipient.ownerId,
		);
		const nextIdentity = toKnownIdentity(recipient);

		if (existingIndex === -1) {
			nextKnownIdentities.push(nextIdentity);
			didChange = true;
			continue;
		}

		const existingIdentity = nextKnownIdentities[existingIndex];

		if (existingIdentity === undefined) {
			continue;
		}

		if (existingIdentity.identityUpdatedAt >= recipient.identityUpdatedAt) {
			continue;
		}

		nextKnownIdentities[existingIndex] = {
			...nextIdentity,
			localAlias: existingIdentity.localAlias,
		};
		didChange = true;
	}

	return didChange
		? {
				...state,
				knownIdentities: nextKnownIdentities,
			}
		: state;
};

export type OpenPayloadSuccess = {
	readonly envelope: Schema.Schema.Type<typeof PayloadEnvelope>;
	readonly envKeys: ReadonlyArray<string>;
	readonly needsUpdate: PayloadNeedsUpdate;
	readonly nextState: HomeState;
	readonly path: string;
	readonly state: HomeState;
};

export class OpenPayload extends Effect.Service<OpenPayload>()("OpenPayload", {
	accessors: true,
	effect: Effect.gen(function* () {
		const homeRepository = yield* HomeRepository;
		const payloadRepository = yield* PayloadRepository;
		const payloadCrypto = yield* PayloadCrypto;

		const execute = Effect.fn("OpenPayload.execute")(function* (input: {
			readonly passphrase: string;
			readonly path: string;
		}) {
			const state = yield* homeRepository.loadState.pipe(
				Effect.mapError((error) =>
					toPersistenceError("load home state", error),
				),
			);
			const rawPayloadFile = yield* payloadRepository
				.readFile(input.path)
				.pipe(
					Effect.mapError((error) =>
						toPersistenceError("read payload file", error),
					),
				);
			const parsedPayloadFile = parsePayloadFile(rawPayloadFile);

			if (parsedPayloadFile._tag === "Left") {
				return yield* new OpenPayloadFileFormatError({
					message: parsedPayloadFile.left.message,
				});
			}

			const privateKeyPaths = [
				...(Option.isSome(state.self) ? [state.self.value.privateKeyPath] : []),
				...state.retiredKeys.map((key) => key.privateKeyPath),
			];
			const encryptedPrivateKeys = yield* Effect.forEach(
				privateKeyPaths,
				(privateKeyPath) =>
					homeRepository
						.readPrivateKey(privateKeyPath)
						.pipe(
							Effect.mapError((error) =>
								toPersistenceError("read private key", error),
							),
						),
			);

			const decryptedEnvelope = yield* payloadCrypto
				.decryptEnvelope({
					armoredPayload: parsedPayloadFile.right.armoredPayload,
					encryptedPrivateKeys,
					passphrase: input.passphrase,
				})
				.pipe(
					Effect.mapError(
						(error: PayloadDecryptError) =>
							new OpenPayloadCryptoError({
								message: error.message,
							}),
					),
				);
			const envelope = yield* Schema.decodeUnknown(PayloadEnvelope)(
				decryptedEnvelope,
			).pipe(
				Effect.mapError(
					() =>
						new OpenPayloadEnvelopeError({
							message: "Decrypted payload envelope did not match schema",
						}),
				),
			);
			const envKeys = yield* Effect.try({
				catch: (cause) =>
					cause instanceof Error
						? new OpenPayloadEnvError({
								message: cause.message,
							})
						: new OpenPayloadEnvError({
								message: "Env text could not be parsed",
							}),
				try: () => getEnvKeyNames(envelope.envText),
			});

			const nextState = mergeKnownIdentities(state, envelope.recipients);

			if (nextState !== state) {
				yield* homeRepository
					.saveState(nextState)
					.pipe(
						Effect.mapError((error) =>
							toPersistenceError("save home state", error),
						),
					);
			}

			return {
				envelope,
				envKeys,
				needsUpdate: getPayloadNeedsUpdate(nextState, envelope),
				nextState,
				path: input.path,
				state,
			} satisfies OpenPayloadSuccess;
		});

		return { execute };
	}),
}) {}
