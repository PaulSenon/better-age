import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { KnownIdentity } from "../../domain/identity/Identity.js";
import { encodeIdentityString } from "../../domain/identity/IdentityString.js";
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
import { GrantPayloadRecipient } from "./GrantPayloadRecipient.js";
import {
	GrantPayloadRecipientAddedSuccess,
	GrantPayloadRecipientAmbiguousIdentityError,
	GrantPayloadRecipientUnchangedSuccess,
	GrantPayloadRecipientUpdatedSuccess,
	GrantPayloadRecipientUpdateRequiredError,
	GrantPayloadRecipientVersionError,
} from "./GrantPayloadRecipientError.js";

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
const selfRecipient = {
	displayName: selfDisplayName,
	identityUpdatedAt: selfIdentityUpdatedAt,
	ownerId: selfOwnerId,
	publicKey: selfPublicKey,
};

const paulHandle = Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa");
const paulOld = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulold"),
});

const paulNew = {
	...paulOld,
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-15T10:00:00.000Z",
	),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulnew"),
};

const otherPaulHandle = Schema.decodeUnknownSync(Handle)("paul#bbbbbbbb");
const otherPaul = {
	...paulOld,
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_bbbbbbbbbbbbbbbb"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1otherpaul"),
};

const staleSelfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_9999999999999999",
);
const staleSelfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1stale");

const toRecipient = (
	identity: Pick<
		typeof paulOld,
		| "displayName"
		| "identityUpdatedAt"
		| "ownerId"
		| "publicKey"
	>,
) => ({
	displayName: identity.displayName,
	identityUpdatedAt: identity.identityUpdatedAt,
	ownerId: identity.ownerId,
	publicKey: identity.publicKey,
});

describe("GrantPayloadRecipient", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(GrantPayloadRecipient.Default, [
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
		it.effect("adds a new recipient when owner is absent", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paulNew],
					self: Option.some(selfIdentity),
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						selfRecipient,
					],
					version: 2,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new GrantPayloadRecipientAddedSuccess({
						handle: paulHandle,
						path: "/workspace/.env.enc",
					}),
				);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
				expect(
					payloadCrypto.snapshot().encryptCalls[0]?.envelope,
				).toMatchObject({
					recipients: [
						selfRecipient,
						toRecipient(paulNew),
					],
				});
			}),
		);

		it.effect(
			"updates older recipient snapshot when same owner is granted newer identity",
			() =>
				Effect.gen(function* () {
					payloadRepository.snapshot().writeCalls.length = 0;
					payloadCrypto.snapshot().encryptCalls.length = 0;
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						knownIdentities: [paulNew],
						self: Option.some(selfIdentity),
						rotationTtl: "3m",
					});
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						createdAt: "2026-04-14T10:00:00.000Z",
						envText: "API_TOKEN=secret\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							selfRecipient,
							toRecipient(paulOld),
						],
						version: 2,
					});

					const result = yield* GrantPayloadRecipient.execute({
						identityRef: "paul#aaaaaaaa",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new GrantPayloadRecipientUpdatedSuccess({
							handle: paulHandle,
							path: "/workspace/.env.enc",
						}),
					);
				}),
		);

		it.effect(
			"returns unchanged when identical snapshot is already granted",
			() =>
				Effect.gen(function* () {
					payloadRepository.snapshot().writeCalls.length = 0;
					payloadCrypto.snapshot().encryptCalls.length = 0;
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						knownIdentities: [paulNew],
						self: Option.some(selfIdentity),
						rotationTtl: "3m",
					});
					homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
					payloadRepository.seedFile(
						"/workspace/.env.enc",
						serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
					);
					payloadCrypto.seedDecryptedEnvelope({
						createdAt: "2026-04-14T10:00:00.000Z",
						envText: "API_TOKEN=secret\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							selfRecipient,
							toRecipient(paulNew),
						],
						version: 2,
					});

					const result = yield* GrantPayloadRecipient.execute({
						identityRef: "paul#aaaaaaaa",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new GrantPayloadRecipientUnchangedSuccess({
							handle: paulHandle,
							path: "/workspace/.env.enc",
							reason: "already-granted",
						}),
					);
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(0);
				}),
		);

		it.effect("returns unchanged when supplied identity is outdated", () =>
			Effect.gen(function* () {
				payloadRepository.snapshot().writeCalls.length = 0;
				payloadCrypto.snapshot().encryptCalls.length = 0;
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paulOld],
					self: Option.some(selfIdentity),
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						selfRecipient,
						toRecipient(paulNew),
					],
					version: 2,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: encodeIdentityString({
						displayName: paulOld.displayName,
						identityUpdatedAt: paulOld.identityUpdatedAt,
						ownerId: paulOld.ownerId,
						publicKey: paulOld.publicKey,
						version: "v1",
					}),
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new GrantPayloadRecipientUnchangedSuccess({
						handle: paulHandle,
						path: "/workspace/.env.enc",
						reason: "outdated-input",
					}),
				);
			}),
		);

		it.effect("fails when identity ref is ambiguous", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paulOld, otherPaul],
					self: Option.some(selfIdentity),
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						selfRecipient,
					],
					version: 2,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: "paul",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						GrantPayloadRecipientAmbiguousIdentityError,
					);
				}
			}),
		);

		it.effect("fails when payload needs update first", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paulNew],
					self: Option.some(selfIdentity),
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [
						{
							displayName: selfDisplayName,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: staleSelfPublicKey,
						},
					],
					version: 2,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						GrantPayloadRecipientUpdateRequiredError,
					);
				}
			}),
		);

		it.effect("fails with version remediation when payload is newer than CLI", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paulNew],
					self: Option.some(selfIdentity),
					rotationTtl: "3m",
				});
				homeRepository.seedPrivateKey("keys/active.key.age", "AGE-ENCRYPTED");
				payloadRepository.seedFile(
					"/workspace/newer.env.enc",
					serializePayloadFile({ armoredPayload: "FAKE-ARMORED-PAYLOAD" }),
				);
				payloadCrypto.seedDecryptedEnvelope({
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_0123456789abcdef",
					recipients: [selfRecipient],
					version: 999,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/newer.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toEqual(
						new GrantPayloadRecipientVersionError({
							message:
								"CLI is too old to open this payload. Update CLI to latest version.",
						}),
					);
				}
			}),
		);
	});
});
