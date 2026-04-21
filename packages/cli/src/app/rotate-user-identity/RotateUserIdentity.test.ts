import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import {
	Crypto,
	GeneratedIdentity,
	PlaintextPrivateKey,
} from "../../port/Crypto.js";
import { PrivateKeyDecryptionError } from "../../port/CryptoError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { HomeStateSaveError } from "../../port/HomeRepositoryError.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { RotateUserIdentity } from "./RotateUserIdentity.js";
import {
	RotateUserIdentityCryptoError,
	RotateUserIdentityPersistenceError,
	RotateUserIdentitySuccess,
} from "./RotateUserIdentityError.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac#069f7576");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const rotatedFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_2222222222222222",
);

const makeCrypto = () =>
	Crypto.make({
		decryptPrivateKey: () =>
			Effect.succeed(
				Schema.decodeUnknownSync(PlaintextPrivateKey)(
					"AGE-SECRET-KEY-PLAINTEXT",
				),
			),
		encryptPrivateKey: () => Effect.succeed("ENCRYPTED" as never),
		generateUserIdentity: ({ ownerId }) =>
			Effect.succeed(
				Schema.decodeUnknownSync(GeneratedIdentity)({
					encryptedSecretKey: "NEW-ENCRYPTED-KEY",
					fingerprint: "bs1_2222222222222222",
					identityUpdatedAt: "2026-04-15T10:00:00.000Z",
					keyMode: "pq-hybrid",
					ownerId: ownerId ?? "bsid1_069f7576d2ab43ef",
					publicKey: "age1rotated",
				}),
			),
	});

describe("RotateUserIdentity", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const authHomeRepository = makeInMemoryHomeRepository();
	const rollbackBaseRepository = makeInMemoryHomeRepository();
	let hasSeededRollbackState = false;
	const rollbackHomeRepository = Object.assign(
		HomeRepository.make({
			...rollbackBaseRepository,
			saveState: (state) =>
				hasSeededRollbackState
					? Effect.fail(
							new HomeStateSaveError({
								message: "Failed to save home state",
								stateFile: "/virtual-home/state.json",
							}),
						)
					: rollbackBaseRepository.saveState(state).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									hasSeededRollbackState = true;
								}),
							),
						),
		}),
		{
			seedPrivateKey: rollbackBaseRepository.seedPrivateKey,
			snapshot: rollbackBaseRepository.snapshot,
		},
	);

	layer(
		Layer.provide(RotateUserIdentity.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("success", (it) => {
		it.effect(
			"rotates active identity, preserves owner id, and retires prior key",
			() =>
				Effect.gen(function* () {
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						self: Option.some({
							createdAt: "2026-04-14T10:00:00.000Z",
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							handle: selfHandle,
							identityUpdatedAt: selfIdentityUpdatedAt,
							keyMode: "pq-hybrid",
							ownerId: selfOwnerId,
							privateKeyPath: selfPrivateKeyPath,
							publicKey: selfPublicKey,
						}),
					});
					homeRepository.seedPrivateKey(
						"keys/active.key.age",
						"OLD-ENCRYPTED-KEY",
					);

					const result = yield* RotateUserIdentity.execute({
						passphrase: "test-passphrase",
					});
					const snapshot = homeRepository.snapshot();

					expect(result).toEqual(
						new RotateUserIdentitySuccess({
							newFingerprint: rotatedFingerprint,
							oldFingerprint: selfFingerprint,
							ownerId: selfOwnerId,
						}),
					);
					expect(snapshot.files.get("keys/active.key.age")).toBe(
						"NEW-ENCRYPTED-KEY",
					);
					expect(
						snapshot.files.get("keys/retired/bs1_1111111111111111.key.age"),
					).toBe("OLD-ENCRYPTED-KEY");
					expect(snapshot.state.retiredKeys).toHaveLength(1);
					expect(snapshot.state.self._tag).toBe("Some");
					if (snapshot.state.self._tag === "Some") {
						expect(snapshot.state.self.value.ownerId).toBe(selfOwnerId);
						expect(snapshot.state.self.value.fingerprint).toBe(
							rotatedFingerprint,
						);
					}
				}),
		);
	});

	layer(
		Layer.provide(RotateUserIdentity.Default, [
			Layer.succeed(HomeRepository, authHomeRepository),
			Layer.succeed(
				Crypto,
				Crypto.make({
					decryptPrivateKey: () =>
						Effect.fail(
							new PrivateKeyDecryptionError({
								message:
									"Failed to decrypt private key with provided passphrase",
							}),
						),
					encryptPrivateKey: () => Effect.die("unused"),
					generateUserIdentity: () => Effect.die("unused"),
				}),
			),
		]),
	)("auth", (it) => {
		it.effect(
			"fails and leaves local key state unchanged when passphrase cannot decrypt current key",
			() =>
				Effect.gen(function* () {
					yield* authHomeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						self: Option.some({
							createdAt: "2026-04-14T10:00:00.000Z",
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							handle: selfHandle,
							identityUpdatedAt: selfIdentityUpdatedAt,
							keyMode: "pq-hybrid",
							ownerId: selfOwnerId,
							privateKeyPath: selfPrivateKeyPath,
							publicKey: selfPublicKey,
						}),
					});
					authHomeRepository.seedPrivateKey(
						"keys/active.key.age",
						"OLD-ENCRYPTED-KEY",
					);

					const result = yield* RotateUserIdentity.execute({
						passphrase: "wrong-passphrase",
					}).pipe(Effect.either);
					const snapshot = authHomeRepository.snapshot();

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(RotateUserIdentityCryptoError);
						expect(result.left.message).toBe(
							"Failed to decrypt private key with provided passphrase",
						);
					}
					expect(snapshot.files.get("keys/active.key.age")).toBe(
						"OLD-ENCRYPTED-KEY",
					);
					expect(
						snapshot.files.get("keys/retired/bs1_1111111111111111.key.age"),
					).toBeUndefined();
					expect(snapshot.state.retiredKeys).toHaveLength(0);
					expect(snapshot.state.self).toEqual(
						Option.some({
							createdAt: "2026-04-14T10:00:00.000Z",
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							handle: selfHandle,
							identityUpdatedAt: selfIdentityUpdatedAt,
							keyMode: "pq-hybrid",
							ownerId: selfOwnerId,
							privateKeyPath: selfPrivateKeyPath,
							publicKey: selfPublicKey,
						}),
					);
				}),
		);
	});

	layer(
		Layer.provide(RotateUserIdentity.Default, [
			Layer.succeed(HomeRepository, rollbackHomeRepository),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("rollback", (it) => {
		it.effect(
			"restores previous active key and removes retired copy on save failure",
			() =>
				Effect.gen(function* () {
					hasSeededRollbackState = false;
					yield* rollbackHomeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						self: Option.some({
							createdAt: "2026-04-14T10:00:00.000Z",
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							handle: selfHandle,
							identityUpdatedAt: selfIdentityUpdatedAt,
							keyMode: "pq-hybrid",
							ownerId: selfOwnerId,
							privateKeyPath: selfPrivateKeyPath,
							publicKey: selfPublicKey,
						}),
					});
					rollbackHomeRepository.seedPrivateKey(
						"keys/active.key.age",
						"OLD-ENCRYPTED-KEY",
					);

					const result = yield* RotateUserIdentity.execute({
						passphrase: "test-passphrase",
					}).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(
							RotateUserIdentityPersistenceError,
						);
					}
					expect(
						rollbackHomeRepository.snapshot().files.get("keys/active.key.age"),
					).toBe("OLD-ENCRYPTED-KEY");
					expect(
						rollbackHomeRepository
							.snapshot()
							.files.get("keys/retired/bs1_1111111111111111.key.age"),
					).toBeUndefined();
				}),
		);
	});
});
