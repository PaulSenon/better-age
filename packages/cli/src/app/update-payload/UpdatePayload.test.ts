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
import { RewritePayloadEnvelope } from "../shared/RewritePayloadEnvelope.js";
import { UpdatePayload } from "./UpdatePayload.js";
import {
	UpdatePayloadNoSelfIdentityError,
	UpdatePayloadUnchangedSuccess,
	UpdatePayloadUpdatedSuccess,
	UpdatePayloadVersionError,
} from "./UpdatePayloadError.js";

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
const staleSelfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_9999999999999999",
);
const staleSelfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1stale");
const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_aaaaaaaaaaaaaaaa",
);
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T11:00:00.000Z",
);
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa");
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paul");

const selfState = {
	...emptyHomeState(),
	activeKeyFingerprint: Option.some(selfFingerprint),
	self: Option.some(selfIdentity),
};

const currentEnvelope = {
	createdAt: "2026-04-14T10:00:00.000Z",
	envText: "API_TOKEN=secret\n",
	lastRewrittenAt: "2026-04-14T10:00:00.000Z",
	payloadId: "bspld_0123456789abcdef" as const,
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
	version: 2 as const,
};

describe("UpdatePayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(UpdatePayload.Default, [
			Layer.provide(OpenPayload.Default, [
				Layer.succeed(HomeRepository, homeRepository),
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
			Layer.provide(RewritePayloadEnvelope.Default, [
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
		]),
	)("success", (it) => {
		it.effect("returns unchanged when payload is already current", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState(selfState);
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope(currentEnvelope);

				const result = yield* UpdatePayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new UpdatePayloadUnchangedSuccess({
						path: "/workspace/.env.enc",
						reasons: [],
					}),
				);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(0);
			}),
		);

		it.effect(
			"rewrites outdated payload schema and reports format migration only",
			() =>
				Effect.gen(function* () {
					payloadCrypto.snapshot().encryptCalls.length = 0;
					payloadRepository.snapshot().writeCalls.length = 0;
					yield* homeRepository.saveState(selfState);
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/legacy-v1.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						...currentEnvelope,
						version: 1 as const,
					});

					const result = yield* UpdatePayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/legacy-v1.env.enc",
					});

					expect(result).toEqual(
						new UpdatePayloadUpdatedSuccess({
							path: "/workspace/legacy-v1.env.enc",
							payloadId: "bspld_0123456789abcdef",
							reasons: ["payload schema is outdated"],
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(
						payloadCrypto.snapshot().encryptCalls[0]?.envelope,
					).toMatchObject({
						recipients: currentEnvelope.recipients,
						version: 2,
					});
				}),
		);

		it.effect(
			"rewrites oldest supported payload schema and reports format migration only",
			() =>
				Effect.gen(function* () {
					payloadCrypto.snapshot().encryptCalls.length = 0;
					payloadRepository.snapshot().writeCalls.length = 0;
					yield* homeRepository.saveState(selfState);
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/legacy-v0.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						createdAt: currentEnvelope.createdAt,
						envText: currentEnvelope.envText,
						lastRewrittenAt: currentEnvelope.lastRewrittenAt,
						payloadId: currentEnvelope.payloadId,
						recipients: [
							{
								...currentEnvelope.recipients[0],
								fingerprint: selfFingerprint,
								handle: selfHandle,
							},
							{
								...currentEnvelope.recipients[1],
								fingerprint: paulFingerprint,
								handle: "paul#aaaaaaaa",
							},
						],
						version: 0 as const,
					});

					const result = yield* UpdatePayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/legacy-v0.env.enc",
					});

					expect(result).toEqual(
						new UpdatePayloadUpdatedSuccess({
							path: "/workspace/legacy-v0.env.enc",
							payloadId: "bspld_0123456789abcdef",
							reasons: ["payload schema is outdated"],
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(
						payloadCrypto.snapshot().encryptCalls[0]?.envelope,
					).toMatchObject({
						recipients: currentEnvelope.recipients,
						version: 2,
					});
				}),
		);

		it.effect(
			"rewrites once when payload needs format migration and self refresh", () =>
				Effect.gen(function* () {
					payloadCrypto.snapshot().encryptCalls.length = 0;
					payloadRepository.snapshot().writeCalls.length = 0;
					yield* homeRepository.saveState(selfState);
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/legacy-and-stale.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						...currentEnvelope,
						recipients: [
							{
								...currentEnvelope.recipients[0],
								publicKey: staleSelfPublicKey,
							},
							currentEnvelope.recipients[1],
						],
						version: 1 as const,
					});

					const result = yield* UpdatePayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/legacy-and-stale.env.enc",
					});

					expect(result).toEqual(
						new UpdatePayloadUpdatedSuccess({
							path: "/workspace/legacy-and-stale.env.enc",
							payloadId: "bspld_0123456789abcdef",
							reasons: ["payload schema is outdated", "self key is stale"],
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(
						payloadCrypto.snapshot().encryptCalls[0]?.envelope,
					).toMatchObject({
						recipients: currentEnvelope.recipients,
						version: 2,
					});
				}),
		);

		it.effect(
			"rewrites stale self recipient and preserves non-self recipients",
			() =>
				Effect.gen(function* () {
					payloadCrypto.snapshot().encryptCalls.length = 0;
					payloadRepository.snapshot().writeCalls.length = 0;
					yield* homeRepository.saveState(selfState);
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						...currentEnvelope,
						recipients: [
							{
								...currentEnvelope.recipients[0],
								publicKey: staleSelfPublicKey,
							},
							currentEnvelope.recipients[1],
						],
					});

					const result = yield* UpdatePayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toBeInstanceOf(UpdatePayloadUpdatedSuccess);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(
						payloadCrypto.snapshot().encryptCalls[0]?.envelope,
					).toMatchObject({
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							currentEnvelope.recipients[0],
							currentEnvelope.recipients[1],
						],
					});
				}),
		);

		it.effect(
			"normalizes duplicate self recipients to one current snapshot",
			() =>
				Effect.gen(function* () {
					payloadCrypto.snapshot().encryptCalls.length = 0;
					payloadRepository.snapshot().writeCalls.length = 0;
					yield* homeRepository.saveState(selfState);
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						...currentEnvelope,
						recipients: [
							currentEnvelope.recipients[0],
							{
								...currentEnvelope.recipients[0],
								publicKey: staleSelfPublicKey,
							},
							currentEnvelope.recipients[1],
						],
					});

					yield* UpdatePayload.execute({
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(
						payloadCrypto.snapshot().encryptCalls[0]?.envelope,
					).toMatchObject({
						recipients: [
							currentEnvelope.recipients[0],
							currentEnvelope.recipients[1],
						],
					});
				}),
		);

		it.effect("is idempotent when rerun after successful update", () =>
			Effect.gen(function* () {
				payloadCrypto.snapshot().encryptCalls.length = 0;
				payloadRepository.snapshot().writeCalls.length = 0;
				yield* homeRepository.saveState(selfState);
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/idempotent.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					...currentEnvelope,
					version: 1 as const,
				});

				const firstResult = yield* UpdatePayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/idempotent.env.enc",
				});

				expect(firstResult).toBeInstanceOf(UpdatePayloadUpdatedSuccess);
				expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);

				payloadCrypto.seedDecryptedEnvelope(
					payloadCrypto.snapshot().encryptCalls[0]?.envelope,
				);
				payloadRepository.snapshot().writeCalls.length = 0;
				payloadCrypto.snapshot().encryptCalls.length = 0;

				const secondResult = yield* UpdatePayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/idempotent.env.enc",
				});

				expect(secondResult).toEqual(
					new UpdatePayloadUnchangedSuccess({
						path: "/workspace/idempotent.env.enc",
						reasons: [],
					}),
				);
				expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(0);
			}),
		);
	});

	layer(
		Layer.provide(UpdatePayload.Default, [
			Layer.provide(OpenPayload.Default, [
				Layer.succeed(HomeRepository, homeRepository),
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
			Layer.provide(RewritePayloadEnvelope.Default, [
				Layer.succeed(payloadRepository.tag, payloadRepository.service),
				Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
			]),
		]),
	)("failure", (it) => {
		it.effect("fails fast when payload version is newer than current CLI", () =>
			Effect.gen(function* () {
				payloadCrypto.snapshot().encryptCalls.length = 0;
				payloadRepository.snapshot().writeCalls.length = 0;
				yield* homeRepository.saveState(selfState);
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/newer.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					...currentEnvelope,
					version: 999,
				});

				const result = yield* UpdatePayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/newer.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toEqual(
						new UpdatePayloadVersionError({
							message:
								"CLI is too old to open this payload. Update CLI to latest version.",
						}),
					);
				}
				expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(0);
			}),
		);

		it.effect("fails when no local self identity exists", () =>
			Effect.gen(function* () {
				payloadCrypto.snapshot().encryptCalls.length = 0;
				payloadRepository.snapshot().writeCalls.length = 0;
				yield* homeRepository.saveState(emptyHomeState());
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope(currentEnvelope);

				const result = yield* UpdatePayload.execute({
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toEqual(
						new UpdatePayloadNoSelfIdentityError({
							message: ["No local self identity found", "Run: bage setup"].join(
								"\n",
							),
						}),
					);
				}
				expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(0);
			}),
		);
	});
});
