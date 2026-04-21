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
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import {
	makeInMemoryPayloadCrypto,
	makeInMemoryPayloadRepository,
} from "../create-payload/CreatePayload.test-support.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import { EditPayload } from "./EditPayload.js";
import {
	EditPayloadEnvError,
	EditPayloadOpenSuccess,
	EditPayloadRewrittenSuccess,
	EditPayloadUnchangedSuccess,
	EditPayloadUpdateRequiredError,
} from "./EditPayloadError.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_0123456789abcdef",
);
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac-mbp#069f7576");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1self");

describe("EditPayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();
	const resetSnapshots = () => {
		payloadRepository.snapshot().writeCalls.length = 0;
		payloadCrypto.snapshot().encryptCalls.length = 0;
		payloadCrypto.snapshot().decryptCalls.length = 0;
	};

	layer(
		Layer.provide(EditPayload.Default, [
			Layer.provide(OpenPayload.Default, [
				Layer.succeed(HomeRepository, homeRepository),
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
			Layer.succeed(payloadRepository.tag, payloadRepository.service),
			Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
		]),
	)("success", (it) => {
		it.effect("opens plaintext env only when payload is editable", () =>
			Effect.gen(function* () {
				resetSnapshots();
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
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey(
					"keys/active.key.age",
					"AGE-ENCRYPTED-ACTIVE-KEY",
				);
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({
						armoredPayload: "FAKE-ARMORED-PAYLOAD",
					}),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\nDEBUG=true\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						{
							displayNameSnapshot: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						},
					],
					version: 1,
				});

				const result = yield* EditPayload.open({
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new EditPayloadOpenSuccess({
						envText: "API_TOKEN=secret\nDEBUG=true\n",
						path: "/workspace/.env.enc",
					}),
				);
			}),
		);

		it.effect(
			"returns unchanged when edited env matches current env exactly",
			() =>
				Effect.gen(function* () {
					resetSnapshots();
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
						rotationTtl: "3m",
					});
					homeRepository.seedPrivateKey(
						"keys/active.key.age",
						"AGE-ENCRYPTED-ACTIVE-KEY",
					);
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({
							armoredPayload: "FAKE-ARMORED-PAYLOAD",
						}),
					);
					payloadCrypto.seedDecryptedEnvelope({
						createdAt: "2026-04-14T10:00:00.000Z",
						envText: "API_TOKEN=secret\nDEBUG=true\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							{
								displayNameSnapshot: selfDisplayName,
								fingerprint: selfFingerprint,
								identityUpdatedAt: selfIdentityUpdatedAt,
								ownerId: selfOwnerId,
								publicKey: selfPublicKey,
							},
						],
						version: 1,
					});

					const result = yield* EditPayload.save({
						editedEnvText: "API_TOKEN=secret\nDEBUG=true\n",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new EditPayloadUnchangedSuccess({
							path: "/workspace/.env.enc",
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
				}),
		);

		it.effect(
			"rewrites payload with same payload id and recipients when env changed",
			() =>
				Effect.gen(function* () {
					resetSnapshots();
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
						rotationTtl: "3m",
					});
					homeRepository.seedPrivateKey(
						"keys/active.key.age",
						"AGE-ENCRYPTED-ACTIVE-KEY",
					);
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({
							armoredPayload: "FAKE-ARMORED-PAYLOAD",
						}),
					);
					payloadCrypto.seedDecryptedEnvelope({
						createdAt: "2026-04-14T10:00:00.000Z",
						envText: "API_TOKEN=secret\nDEBUG=true\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							{
								displayNameSnapshot: selfDisplayName,
								fingerprint: selfFingerprint,
								identityUpdatedAt: selfIdentityUpdatedAt,
								ownerId: selfOwnerId,
								publicKey: selfPublicKey,
							},
						],
						version: 1,
					});

					const result = yield* EditPayload.save({
						editedEnvText: "API_TOKEN=secret\nDEBUG=false\n",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new EditPayloadRewrittenSuccess({
							path: "/workspace/.env.enc",
							payloadId: "bspld_0123456789abcdef" as never,
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls[0]).toMatchObject({
						envelope: {
							createdAt: "2026-04-14T10:00:00.000Z",
							envText: "API_TOKEN=secret\nDEBUG=false\n",
							payloadId: "bspld_0123456789abcdef",
							recipients: [
								{
									displayNameSnapshot: selfDisplayName,
									fingerprint: selfFingerprint,
									identityUpdatedAt: selfIdentityUpdatedAt,
									ownerId: selfOwnerId,
									publicKey: selfPublicKey,
								},
							],
							version: 1,
						},
						recipients: [selfPublicKey],
					});
				}),
		);

		it.effect("fails on invalid env text without mutating payload", () =>
			Effect.gen(function* () {
				resetSnapshots();
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
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey(
					"keys/active.key.age",
					"AGE-ENCRYPTED-ACTIVE-KEY",
				);
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({
						armoredPayload: "FAKE-ARMORED-PAYLOAD",
					}),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\nDEBUG=true\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						{
							displayNameSnapshot: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						},
					],
					version: 1,
				});

				const result = yield* EditPayload.save({
					editedEnvText: "API_TOKEN=one\nAPI_TOKEN=two\n",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(EditPayloadEnvError);
				}
				expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
			}),
		);

		it.effect("fails before edit when payload needs update", () =>
			Effect.gen(function* () {
				resetSnapshots();
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
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey(
					"keys/active.key.age",
					"AGE-ENCRYPTED-ACTIVE-KEY",
				);
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({
						armoredPayload: "FAKE-ARMORED-PAYLOAD",
					}),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						{
							displayNameSnapshot: selfDisplayName,
							fingerprint: "bs1_bbbbbbbbbbbbbbbb",
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: "age1stale",
						},
					],
					version: 1,
				});

				const result = yield* EditPayload.open({
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(EditPayloadUpdateRequiredError);
				}
			}),
		);
	});
});
