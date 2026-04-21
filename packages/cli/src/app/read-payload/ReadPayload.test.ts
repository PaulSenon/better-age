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
import { OpenPayloadCryptoError } from "../shared/OpenPayloadError.js";
import { ReadPayload } from "./ReadPayload.js";
import { ReadPayloadCryptoError } from "./ReadPayloadError.js";

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

const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_aaaaaaaaaaaaaaaa",
);
const paulHandle = Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa");
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T11:00:00.000Z",
);
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa");
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paulnew");

describe("ReadPayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(ReadPayload.Default, [
			Layer.provide(OpenPayload.Default, [
				Layer.succeed(HomeRepository, homeRepository),
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
		]),
	)("success", (it) => {
		it.effect(
			"decrypts env text, learns recipients, and does not rewrite payload",
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
						knownIdentities: [],
						retiredKeys: [],
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
							{
								displayNameSnapshot: paulDisplayName,
								fingerprint: paulFingerprint,
								identityUpdatedAt: paulIdentityUpdatedAt,
								ownerId: paulOwnerId,
								publicKey: paulPublicKey,
							},
						],
						version: 1,
					});

					const result = yield* ReadPayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual({
						_tag: "ReadPayloadSuccess",
						envText: "API_TOKEN=secret\nDEBUG=true\n",
						needsUpdate: {
							isRequired: false,
							reason: Option.none(),
						},
						path: "/workspace/.env.enc",
					});
					expect(homeRepository.snapshot().state.knownIdentities).toEqual([
						{
							displayName: paulDisplayName,
							fingerprint: paulFingerprint,
							handle: paulHandle,
							identityUpdatedAt: paulIdentityUpdatedAt,
							localAlias: Option.none(),
							ownerId: paulOwnerId,
							publicKey: paulPublicKey,
						},
					]);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
					expect(payloadCrypto.snapshot().decryptCalls).toEqual([
						{
							armoredPayload: "FAKE-ARMORED-PAYLOAD",
							encryptedPrivateKeys: ["AGE-ENCRYPTED-ACTIVE-KEY"],
							passphrase: "test-passphrase",
						},
					]);
				}),
		);

		it.effect("reports update-required when self key is stale", () =>
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
					knownIdentities: [],
					retiredKeys: [],
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey(
					"keys/active.key.age",
					"AGE-ENCRYPTED-ACTIVE-KEY",
				);
				payloadRepository.seedFile(
					"/workspace/stale.env.enc",
					serializePayloadFile({
						armoredPayload: "FAKE-ARMORED-PAYLOAD",
					}),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_fedcba9876543210",
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

				const result = yield* ReadPayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/stale.env.enc",
				});

				expect(result.needsUpdate).toEqual({
					isRequired: true,
					reason: Option.some("self key is stale"),
				});
			}),
		);
	});

	layer(
		Layer.provide(ReadPayload.Default, [
			Layer.succeed(
				OpenPayload,
				OpenPayload.make({
					execute: () =>
						Effect.fail(
							new OpenPayloadCryptoError({
								message: "Failed to decrypt payload envelope",
							}),
						),
				}),
			),
		]),
	)("failure", (it) => {
		it.effect("maps open-payload crypto failures without parse crashing", () =>
			Effect.gen(function* () {
				const result = yield* ReadPayload.execute({
					passphrase: "wrong-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ReadPayloadCryptoError);
					expect(result.left.message).toBe(
						"Failed to decrypt payload envelope",
					);
				}
			}),
		);
	});
});
