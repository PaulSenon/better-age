import { Clock, Effect, Option } from "effect";
import {
	buildRotatedHomeState,
	toRetiredPrivateKeyPath,
} from "../../domain/home/HomeKeyLifecycle.js";
import { materializeSelfIdentity } from "../../domain/identity/Identity.js";
import { Crypto } from "../../port/Crypto.js";
import type {
	IdentityGenerationError,
	PrivateKeyDecryptionError,
	PrivateKeyEncryptionError,
} from "../../port/CryptoError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
	PrivateKeyDeleteError,
	PrivateKeyPathWriteError,
	PrivateKeyReadError,
} from "../../port/HomeRepositoryError.js";
import {
	RotateUserIdentityCryptoError,
	RotateUserIdentityNoActiveIdentityError,
	RotateUserIdentityPersistenceError,
	RotateUserIdentitySuccess,
} from "./RotateUserIdentityError.js";

const toPersistenceError = (
	operation: string,
	error:
		| HomeStateDecodeError
		| HomeStateLoadError
		| HomeStateSaveError
		| PrivateKeyDeleteError
		| PrivateKeyPathWriteError
		| PrivateKeyReadError,
) =>
	new RotateUserIdentityPersistenceError({
		message: error.message,
		operation,
	});

export class RotateUserIdentity extends Effect.Service<RotateUserIdentity>()(
	"RotateUserIdentity",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const crypto = yield* Crypto;
			const homeRepository = yield* HomeRepository;

			const execute = Effect.fn("RotateUserIdentity.execute")(
				function* (input: { readonly passphrase: string }) {
					const state = yield* homeRepository.loadState.pipe(
						Effect.mapError((error) =>
							toPersistenceError("load home state", error),
						),
					);
					const selfIdentity = state.self.pipe(Option.getOrUndefined);

					if (selfIdentity === undefined) {
						return yield* new RotateUserIdentityNoActiveIdentityError({
							message: "No active identity configured",
						});
					}
					const resolvedSelfIdentity = materializeSelfIdentity(selfIdentity);

					const previousEncryptedPrivateKey = yield* homeRepository
						.readPrivateKey(resolvedSelfIdentity.privateKeyPath)
						.pipe(
							Effect.mapError((error) =>
								toPersistenceError("read active private key", error),
							),
						);
					yield* crypto
						.decryptPrivateKey({
							encryptedPrivateKey: previousEncryptedPrivateKey,
							passphrase: input.passphrase,
						})
						.pipe(
							Effect.catchTag(
								"PrivateKeyDecryptionError",
								(error: PrivateKeyDecryptionError) =>
									Effect.fail(
										new RotateUserIdentityCryptoError({
											message: error.message,
										}),
									),
							),
						);
					const rotatedIdentity = yield* crypto
						.generateUserIdentity({
							keyMode: selfIdentity.keyMode,
							ownerId: resolvedSelfIdentity.ownerId,
							passphrase: input.passphrase,
						})
						.pipe(
							Effect.mapError(
								(error: IdentityGenerationError | PrivateKeyEncryptionError) =>
									new RotateUserIdentityCryptoError({
										message: error.message,
									}),
							),
						);
					const retiredPrivateKeyPath = toRetiredPrivateKeyPath(
						resolvedSelfIdentity.fingerprint,
					);
					const now = new Date(yield* Clock.currentTimeMillis).toISOString();
					const nextState = buildRotatedHomeState({
						now,
						previousState: state,
						privateKeyPath: resolvedSelfIdentity.privateKeyPath,
						rotatedIdentity,
					});

					yield* homeRepository
						.writePrivateKeyAtPath({
							contents: previousEncryptedPrivateKey,
							privateKeyPath: retiredPrivateKeyPath,
						})
						.pipe(
							Effect.mapError((error) =>
								toPersistenceError("write retired private key", error),
							),
						);
					yield* homeRepository
						.writePrivateKeyAtPath({
							contents: rotatedIdentity.encryptedSecretKey,
							privateKeyPath: resolvedSelfIdentity.privateKeyPath,
						})
						.pipe(
							Effect.mapError((error) =>
								toPersistenceError("write active private key", error),
							),
						);
					const saveResult = yield* homeRepository
						.saveState(nextState)
						.pipe(Effect.either);

					if (saveResult._tag === "Left") {
						yield* homeRepository
							.writePrivateKeyAtPath({
								contents: previousEncryptedPrivateKey,
								privateKeyPath: resolvedSelfIdentity.privateKeyPath,
							})
							.pipe(Effect.catchAll(() => Effect.void));
						yield* homeRepository
							.deletePrivateKey(retiredPrivateKeyPath)
							.pipe(Effect.catchAll(() => Effect.void));
						return yield* toPersistenceError(
							"save home state",
							saveResult.left,
						);
					}

					return new RotateUserIdentitySuccess({
						newFingerprint: rotatedIdentity.fingerprint,
						oldFingerprint: resolvedSelfIdentity.fingerprint,
						ownerId: rotatedIdentity.ownerId,
					});
				},
			);

			return { execute };
		}),
	},
) {}
