import { Effect, Option } from "effect";
import { Crypto, type PlaintextPrivateKey } from "../../port/Crypto.js";
import type {
	PrivateKeyDecryptionError,
	PrivateKeyEncryptionError,
} from "../../port/CryptoError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	PrivateKeyPathWriteError,
	PrivateKeyReadError,
} from "../../port/HomeRepositoryError.js";
import {
	ChangePassphraseCryptoError,
	ChangePassphraseNoActiveIdentityError,
	ChangePassphrasePersistenceError,
	ChangePassphraseSuccess,
} from "./ChangePassphraseError.js";

const toPersistenceError = (
	operation: string,
	error:
		| HomeStateDecodeError
		| HomeStateLoadError
		| PrivateKeyPathWriteError
		| PrivateKeyReadError,
) =>
	new ChangePassphrasePersistenceError({
		message: error.message,
		operation,
	});

export class ChangePassphrase extends Effect.Service<ChangePassphrase>()(
	"ChangePassphrase",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const crypto = yield* Crypto;
			const homeRepository = yield* HomeRepository;

			const execute = Effect.fn("ChangePassphrase.execute")(function* (input: {
				readonly currentPassphrase: string;
				readonly nextPassphrase: string;
			}) {
				const state = yield* homeRepository.loadState.pipe(
					Effect.mapError((error) =>
						toPersistenceError("load home state", error),
					),
				);

				if (Option.isNone(state.self)) {
					return yield* new ChangePassphraseNoActiveIdentityError({
						message: "No active identity configured",
					});
				}

				const privateKeyPaths = [
					state.self.value.privateKeyPath,
					...state.retiredKeys.map((key) => key.privateKeyPath),
				];
				const currentEncryptedKeys = yield* Effect.forEach(
					privateKeyPaths,
					(privateKeyPath) =>
						homeRepository.readPrivateKey(privateKeyPath).pipe(
							Effect.mapError((error) =>
								toPersistenceError("read private key", error),
							),
							Effect.map((contents) => ({ contents, privateKeyPath })),
						),
				);
				const decryptedKeys = yield* Effect.forEach(
					currentEncryptedKeys,
					(key) =>
						crypto
							.decryptPrivateKey({
								encryptedPrivateKey: key.contents,
								passphrase: input.currentPassphrase,
							})
							.pipe(
								Effect.mapError(
									(
										error:
											| PrivateKeyDecryptionError
											| PrivateKeyEncryptionError,
									) =>
										new ChangePassphraseCryptoError({
											message: error.message,
										}),
								),
								Effect.map((privateKey) => ({
									privateKey,
									privateKeyPath: key.privateKeyPath,
									previousContents: key.contents,
								})),
							),
				);
				const reencryptedKeys = yield* Effect.forEach(decryptedKeys, (key) =>
					crypto
						.encryptPrivateKey({
							passphrase: input.nextPassphrase,
							privateKey: key.privateKey as PlaintextPrivateKey,
						})
						.pipe(
							Effect.mapError(
								(
									error: PrivateKeyDecryptionError | PrivateKeyEncryptionError,
								) =>
									new ChangePassphraseCryptoError({
										message: error.message,
									}),
							),
							Effect.map((contents) => ({
								nextContents: contents,
								previousContents: key.previousContents,
								privateKeyPath: key.privateKeyPath,
							})),
						),
				);

				const writtenKeys: Array<{
					readonly previousContents: string;
					readonly privateKeyPath: string;
				}> = [];
				const writeResult = yield* Effect.forEach(
					reencryptedKeys,
					(key) =>
						homeRepository
							.writePrivateKeyAtPath({
								contents: key.nextContents,
								privateKeyPath: key.privateKeyPath,
							})
							.pipe(
								Effect.tap(() =>
									Effect.sync(() => {
										writtenKeys.push({
											previousContents: key.previousContents,
											privateKeyPath: key.privateKeyPath,
										});
									}),
								),
								Effect.mapError((error) =>
									toPersistenceError("write private key", error),
								),
							),
					{ concurrency: 1 },
				).pipe(Effect.either);

				if (writeResult._tag === "Left") {
					yield* Effect.forEach(
						writtenKeys.reverse(),
						(key) =>
							homeRepository
								.writePrivateKeyAtPath({
									contents: key.previousContents as never,
									privateKeyPath: key.privateKeyPath as never,
								})
								.pipe(Effect.catchAll(() => Effect.void)),
						{ concurrency: 1 },
					);
					return yield* writeResult.left;
				}

				return new ChangePassphraseSuccess({});
			});

			return { execute };
		}),
	},
) {}
