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
import { derivePublicIdentityFingerprint } from "../../domain/identity/PublicIdentity.js";
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import {
	makeInMemoryPayloadCrypto,
	makeInMemoryPayloadRepository,
} from "../create-payload/CreatePayload.test-support.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import { InspectPayload } from "./InspectPayload.js";

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
const selfIdentity = {
	createdAt: "2026-04-14T10:00:00.000Z",
	keyMode: "pq-hybrid" as const,
	privateKeyPath: selfPrivateKeyPath,
	publicIdentity: {
		displayName: selfDisplayName,
		identityUpdatedAt: selfIdentityUpdatedAt,
		ownerId: selfOwnerId,
		publicKey: selfPublicKey,
	},
};
const selfRecipient = {
	displayName: selfDisplayName,
	identityUpdatedAt: selfIdentityUpdatedAt,
	ownerId: selfOwnerId,
	publicKey: selfPublicKey,
};

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
const paulRecipient = {
	displayName: paulDisplayName,
	identityUpdatedAt: paulIdentityUpdatedAt,
	ownerId: paulOwnerId,
	publicKey: paulPublicKey,
};

describe("InspectPayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(InspectPayload.Default, [
			Layer.provide(OpenPayload.Default, [
				Layer.succeed(HomeRepository, homeRepository),
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
		]),
	)("success", (it) => {
		it.effect(
			"returns inspect dto, imports unknown recipients, and does not rewrite payload",
			() =>
				Effect.gen(function* () {
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						self: Option.some(selfIdentity),
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
						envText: "API_TOKEN=secret\nEMPTY=\nDEBUG=true\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							selfRecipient,
							paulRecipient,
						],
						version: 2,
					});

					const result = yield* InspectPayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result.path).toBe("/workspace/.env.enc");
					expect(result.version).toBe(2);
					expect(result.payloadId).toBe("bspld_0123456789abcdef");
					expect(result.secretCount).toBe(3);
					expect(result.recipientCount).toBe(2);
					expect(result.envKeys).toEqual(["API_TOKEN", "EMPTY", "DEBUG"]);
					expect(result.needsUpdate).toEqual({
						isRequired: false,
						reason: Option.none(),
					});
					expect(result.recipients).toEqual([
						{
							displayName: selfDisplayName,
							fingerprint: derivePublicIdentityFingerprint(selfRecipient),
							handle: selfHandle,
							isMe: true,
							isStaleSelf: false,
							localAlias: Option.none(),
						},
						{
							displayName: paulDisplayName,
							fingerprint: derivePublicIdentityFingerprint(paulRecipient),
							handle: paulHandle,
							isMe: false,
							isStaleSelf: false,
							localAlias: Option.none(),
						},
					]);
					expect(homeRepository.snapshot().state.knownIdentities).toEqual([
						{
							displayName: paulDisplayName,
							identityUpdatedAt: paulIdentityUpdatedAt,
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

		it.effect("marks stale self when payload grants older self key", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					self: Option.some(selfIdentity),
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
							displayName: selfDisplayName,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: "age1stale",
						},
					],
					version: 2,
				});

				const result = yield* InspectPayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/stale.env.enc",
				});

				expect(result.needsUpdate).toEqual({
					isRequired: true,
					reason: Option.some("self key is stale"),
				});
				expect(result.recipients).toEqual([
					{
						displayName: selfDisplayName,
						fingerprint: derivePublicIdentityFingerprint({
							displayName: selfDisplayName,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: "age1stale" as never,
						}),
						handle: selfHandle,
						isMe: true,
						isStaleSelf: true,
						localAlias: Option.none(),
					},
				]);
			}),
		);
	});
});
