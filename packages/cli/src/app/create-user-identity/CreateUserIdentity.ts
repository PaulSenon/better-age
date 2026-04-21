import { Clock, Effect, Either, Option, Schema } from "effect";
import {
	ActiveKeyAlreadyExistsError,
	InvalidIdentityAliasError,
} from "../../domain/error/IdentityDomainError.js";
import {
	DisplayName,
	decodeDisplayName,
} from "../../domain/identity/DisplayName.js";
import { toHandle } from "../../domain/identity/Handle.js";
import { Crypto } from "../../port/Crypto.js";
import type { IdentityGenerationError } from "../../port/CryptoError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
	PrivateKeyDeleteError,
	PrivateKeyWriteError,
} from "../../port/HomeRepositoryError.js";
import {
	CreateUserIdentityCryptoError,
	CreateUserIdentityPersistenceError,
	CreateUserIdentitySuccess,
} from "./CreateUserIdentityError.js";

const toPersistenceError = (
	operation: string,
	error:
		| HomeStateDecodeError
		| HomeStateLoadError
		| HomeStateSaveError
		| PrivateKeyDeleteError
		| PrivateKeyWriteError,
) =>
	new CreateUserIdentityPersistenceError({
		message: error.message,
		operation,
	});

export class CreateUserIdentity extends Effect.Service<CreateUserIdentity>()(
	"CreateUserIdentity",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const crypto = yield* Crypto;
			const homeRepository = yield* HomeRepository;
			const execute = Effect.fn("CreateUserIdentity.execute")(
				function* (input: {
					readonly displayName: string;
					readonly passphrase: string;
				}) {
					yield* Effect.annotateCurrentSpan("keyMode", "pq-hybrid");

					const displayName = yield* decodeDisplayName(input.displayName).pipe(
						Effect.mapError(
							() =>
								new InvalidIdentityAliasError({
									displayName: input.displayName,
									message:
										"Display name must be 3-64 chars, trimmed, and use only letters, numbers, '.', '_', '-', '@'",
								}),
						),
					);
					const existingActiveKey = yield* homeRepository.getActiveKey.pipe(
						Effect.mapError((error) =>
							toPersistenceError("load active key", error),
						),
					);

					if (Option.isSome(existingActiveKey)) {
						const existingDisplayName = yield* Schema.decodeUnknown(
							DisplayName,
						)(existingActiveKey.value.alias).pipe(Effect.orDie);

						return yield* new ActiveKeyAlreadyExistsError({
							displayName: existingDisplayName,
							fingerprint: existingActiveKey.value.fingerprint,
							message: "An active key already exists",
						});
					}

					const state = yield* homeRepository.loadState.pipe(
						Effect.mapError((error) =>
							toPersistenceError("load home state", error),
						),
					);
					const generatedIdentity = yield* crypto
						.generateUserIdentity({
							keyMode: "pq-hybrid",
							passphrase: input.passphrase,
						})
						.pipe(
							Effect.mapError(
								(error: IdentityGenerationError) =>
									new CreateUserIdentityCryptoError({
										message: error.message,
									}),
							),
						);
					const privateKeyPath = yield* homeRepository
						.writePrivateKey(
							generatedIdentity.fingerprint,
							generatedIdentity.encryptedSecretKey,
						)
						.pipe(
							Effect.mapError((error) =>
								toPersistenceError("write private key", error),
							),
						);
					const createdAt = new Date(
						yield* Clock.currentTimeMillis,
					).toISOString();
					const selfIdentity = {
						createdAt,
						displayName,
						fingerprint: generatedIdentity.fingerprint,
						handle: toHandle({
							displayName,
							ownerId: generatedIdentity.ownerId,
						}),
						identityUpdatedAt: generatedIdentity.identityUpdatedAt,
						keyMode: generatedIdentity.keyMode,
						ownerId: generatedIdentity.ownerId,
						privateKeyPath,
						publicKey: generatedIdentity.publicKey,
					} as const;
					const nextState = {
						...state,
						activeKeyFingerprint: Option.some(generatedIdentity.fingerprint),
						self: Option.some(selfIdentity),
					};
					const saveResult = yield* homeRepository
						.saveState(nextState)
						.pipe(Effect.either);

					if (Either.isLeft(saveResult)) {
						yield* homeRepository.deletePrivateKey(privateKeyPath).pipe(
							Effect.tapError((rollbackError) =>
								Effect.logWarning("Private-key rollback failed").pipe(
									Effect.annotateLogs({
										privateKeyPath,
										rollbackError: rollbackError.message,
									}),
								),
							),
							Effect.ignore,
						);
						return yield* toPersistenceError(
							"save home state",
							saveResult.left,
						);
					}

					yield* Effect.logInfo("Created user identity").pipe(
						Effect.annotateLogs({
							fingerprint: generatedIdentity.fingerprint,
							keyMode: generatedIdentity.keyMode,
						}),
					);

					return new CreateUserIdentitySuccess({
						displayName,
						fingerprint: generatedIdentity.fingerprint,
						handle: selfIdentity.handle,
						ownerId: generatedIdentity.ownerId,
						privateKeyPath,
						publicKey: generatedIdentity.publicKey,
					});
				},
			);

			return { execute };
		}),
	},
) {}
