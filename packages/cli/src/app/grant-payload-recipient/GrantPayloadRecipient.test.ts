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

const paulOld = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_aaaaaaaaaaaaaaaa"),
	handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	localAlias: null,
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulold"),
});

const paulNew = {
	...paulOld,
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_bbbbbbbbbbbbbbbb"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-15T10:00:00.000Z",
	),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulnew"),
};

const otherPaul = {
	...paulOld,
	handle: Schema.decodeUnknownSync(Handle)("paul#bbbbbbbb"),
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
		| "fingerprint"
		| "identityUpdatedAt"
		| "ownerId"
		| "publicKey"
	>,
) => ({
	displayNameSnapshot: identity.displayName,
	fingerprint: identity.fingerprint,
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
						toRecipient({
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						}),
					],
					version: 1,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new GrantPayloadRecipientAddedSuccess({
						handle: paulNew.handle,
						path: "/workspace/.env.enc",
					}),
				);
				expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
				expect(
					payloadCrypto.snapshot().encryptCalls[0]?.envelope,
				).toMatchObject({
					recipients: [
						toRecipient({
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						}),
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
							toRecipient({
								displayName: selfDisplayName,
								fingerprint: selfFingerprint,
								identityUpdatedAt: selfIdentityUpdatedAt,
								ownerId: selfOwnerId,
								publicKey: selfPublicKey,
							}),
							toRecipient(paulOld),
						],
						version: 1,
					});

					const result = yield* GrantPayloadRecipient.execute({
						identityRef: "paul#aaaaaaaa",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new GrantPayloadRecipientUpdatedSuccess({
							handle: paulNew.handle,
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
							toRecipient({
								displayName: selfDisplayName,
								fingerprint: selfFingerprint,
								identityUpdatedAt: selfIdentityUpdatedAt,
								ownerId: selfOwnerId,
								publicKey: selfPublicKey,
							}),
							toRecipient(paulNew),
						],
						version: 1,
					});

					const result = yield* GrantPayloadRecipient.execute({
						identityRef: "paul#aaaaaaaa",
						passphrase: "test-passphrase",
						path: "/workspace/.env.enc",
					});

					expect(result).toEqual(
						new GrantPayloadRecipientUnchangedSuccess({
							handle: paulNew.handle,
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
						toRecipient({
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						}),
						toRecipient(paulNew),
					],
					version: 1,
				});

				const result = yield* GrantPayloadRecipient.execute({
					identityRef: encodeIdentityString({
						displayName: paulOld.displayName,
						fingerprint: paulOld.fingerprint,
						handle: paulOld.handle,
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
						handle: paulOld.handle,
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
						toRecipient({
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						}),
					],
					version: 1,
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
							displayNameSnapshot: selfDisplayName,
							fingerprint: staleSelfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: staleSelfPublicKey,
						},
					],
					version: 1,
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
	});
});
