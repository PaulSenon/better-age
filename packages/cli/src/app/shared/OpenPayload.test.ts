import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
} from "../../domain/identity/PublicIdentity.js";
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import {
	makeInMemoryPayloadCrypto,
	makeInMemoryPayloadRepository,
} from "../create-payload/CreatePayload.test-support.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { OpenPayload } from "./OpenPayload.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_0123456789abcdef",
);
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
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T11:00:00.000Z",
);
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa");
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paulnew");

describe("OpenPayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(OpenPayload.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(payloadRepository.tag, payloadRepository.service),
			Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
		]),
	)("success", (it) => {
		it.effect(
			"returns envelope state, env keys, and imports unknown recipients",
			() =>
				Effect.gen(function* () {
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
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
							{
								displayName: selfDisplayName,
								identityUpdatedAt: selfIdentityUpdatedAt,
								ownerId: selfOwnerId,
								publicKey: selfPublicKey,
							},
							{
								displayName: paulDisplayName,
								identityUpdatedAt: paulIdentityUpdatedAt,
								ownerId: paulOwnerId,
								publicKey: paulPublicKey,
							},
						],
						version: 2,
					});

					const result = yield* OpenPayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result.path).toBe("/workspace/.env.enc");
					expect(result.envKeys).toEqual(["API_TOKEN", "EMPTY", "DEBUG"]);
					expect(result.needsUpdate).toEqual({
						isRequired: false,
						reason: Option.none(),
					});
					expect(result.envelope.payloadId).toBe("bspld_0123456789abcdef");
					expect(result.nextState.knownIdentities).toEqual([
						{
							displayName: paulDisplayName,
							identityUpdatedAt: paulIdentityUpdatedAt,
							ownerId: paulOwnerId,
							publicKey: paulPublicKey,
						},
					]);
					expect(result.nextState.localAliases).toEqual({});
					expect(payloadCrypto.snapshot().decryptCalls).toEqual([
						{
							armoredPayload: "FAKE-ARMORED-PAYLOAD",
							encryptedPrivateKeys: ["AGE-ENCRYPTED-ACTIVE-KEY"],
							passphrase: "test-passphrase",
						},
					]);
				}),
		);
	});
});
