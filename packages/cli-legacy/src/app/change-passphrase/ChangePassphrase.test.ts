import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { Crypto, PlaintextPrivateKey } from "../../port/Crypto.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { PrivateKeyPathWriteError } from "../../port/HomeRepositoryError.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { ChangePassphrase } from "./ChangePassphrase.js";
import {
	ChangePassphrasePersistenceError,
	ChangePassphraseSuccess,
} from "./ChangePassphraseError.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const retiredPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/retired/bs1_aaaaaaaaaaaaaaaa.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const retiredFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_aaaaaaaaaaaaaaaa",
);

const makeCrypto = () =>
	Crypto.make({
		decryptPrivateKey: ({ encryptedPrivateKey }) =>
			Effect.succeed(
				Schema.decodeUnknownSync(PlaintextPrivateKey)(
					`decrypted:${encryptedPrivateKey}`,
				),
			),
		encryptPrivateKey: ({ passphrase, privateKey }) =>
			Effect.succeed(`${passphrase}:${privateKey}` as never),
		generateUserIdentity: () => Effect.die("unused"),
	});

describe("ChangePassphrase", () => {
	const homeRepository = makeInMemoryHomeRepository();

	layer(
		Layer.provide(ChangePassphrase.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("success", (it) => {
		it.effect("rewrites active and retired keys with new passphrase", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					retiredKeys: [
						{
							fingerprint: retiredFingerprint,
							privateKeyPath: retiredPrivateKeyPath,
							retiredAt: "2026-04-15T10:00:00.000Z",
						},
					],
					self: Option.some({
						createdAt: "2026-04-14T10:00:00.000Z",
						keyMode: "pq-hybrid",
						privateKeyPath: selfPrivateKeyPath,
						publicIdentity: {
							displayName: selfDisplayName,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						},
					}),
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "old-active");
				homeRepository.seedPrivateKey(
					"keys/retired/bs1_aaaaaaaaaaaaaaaa.key.age",
					"old-retired",
				);

				const result = yield* ChangePassphrase.execute({
					currentPassphrase: "old-passphrase",
					nextPassphrase: "new-passphrase",
				});

				expect(result).toEqual(new ChangePassphraseSuccess({}));
				expect(homeRepository.snapshot().files.get("keys/active.key.age")).toBe(
					"new-passphrase:decrypted:old-active",
				);
				expect(
					homeRepository
						.snapshot()
						.files.get("keys/retired/bs1_aaaaaaaaaaaaaaaa.key.age"),
				).toBe("new-passphrase:decrypted:old-retired");
			}),
		);
	});

	layer(
		Layer.provide(ChangePassphrase.Default, [
			Layer.succeed(
				HomeRepository,
				Object.assign(
					HomeRepository.make({
						...makeInMemoryHomeRepository(),
						writePrivateKeyAtPath: ({ privateKeyPath }) =>
							privateKeyPath === retiredPrivateKeyPath
								? Effect.fail(
										new PrivateKeyPathWriteError({
											message: "Failed to write private key file",
											privateKeyPath,
										}),
									)
								: Effect.void,
					}),
					{
						seedPrivateKey: (path: string, contents: string) => {
							void path;
							void contents;
						},
						snapshot: () => ({
							files: new Map<string, string>(),
							location: {
								keysDirectory: "/virtual-home/keys",
								rootDirectory: "/virtual-home",
								stateFile: "/virtual-home/state.json",
							},
							state: emptyHomeState(),
						}),
					},
				),
			),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("failure", (it) => {
		it.effect("fails cleanly on write error", () =>
			Effect.gen(function* () {
				const baseRepository = makeInMemoryHomeRepository();
				yield* baseRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					retiredKeys: [
						{
							fingerprint: retiredFingerprint,
							privateKeyPath: retiredPrivateKeyPath,
							retiredAt: "2026-04-15T10:00:00.000Z",
						},
					],
					self: Option.some({
						createdAt: "2026-04-14T10:00:00.000Z",
						keyMode: "pq-hybrid",
						privateKeyPath: selfPrivateKeyPath,
						publicIdentity: {
							displayName: selfDisplayName,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						},
					}),
				});
				baseRepository.seedPrivateKey("keys/active.key.age", "old-active");
				baseRepository.seedPrivateKey(
					"keys/retired/bs1_aaaaaaaaaaaaaaaa.key.age",
					"old-retired",
				);

				const failingRepository = Object.assign(
					HomeRepository.make({
						...baseRepository,
						writePrivateKeyAtPath: ({ contents, privateKeyPath }) =>
							privateKeyPath === retiredPrivateKeyPath
								? Effect.fail(
										new PrivateKeyPathWriteError({
											message: "Failed to write private key file",
											privateKeyPath,
										}),
									)
								: baseRepository.writePrivateKeyAtPath({
										contents,
										privateKeyPath,
									}),
					}),
					{
						seedPrivateKey: baseRepository.seedPrivateKey,
						snapshot: baseRepository.snapshot,
					},
				);

				const result = yield* ChangePassphrase.execute({
					currentPassphrase: "old-passphrase",
					nextPassphrase: "new-passphrase",
				}).pipe(
					Effect.provide(
						Layer.provide(ChangePassphrase.Default, [
							Layer.succeed(HomeRepository, failingRepository),
							Layer.succeed(Crypto, makeCrypto()),
						]),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ChangePassphrasePersistenceError);
				}
				expect(
					failingRepository.snapshot().files.get("keys/active.key.age"),
				).toBe("old-active");
			}),
		);
	});
});
