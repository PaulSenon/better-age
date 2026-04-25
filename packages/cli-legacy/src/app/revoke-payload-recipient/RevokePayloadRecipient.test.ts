import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { KnownIdentity } from "../../domain/identity/Identity.js";
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
import { RevokePayloadRecipient } from "./RevokePayloadRecipient.js";
import {
	RevokePayloadRecipientAmbiguousIdentityError,
	RevokePayloadRecipientForbiddenSelfError,
	RevokePayloadRecipientRemovedSuccess,
	RevokePayloadRecipientUnchangedSuccess,
	RevokePayloadRecipientUpdateRequiredError,
	RevokePayloadRecipientVersionError,
} from "./RevokePayloadRecipientError.js";

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

const paul = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
});

const staleSelfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_9999999999999999",
);
const staleSelfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1stale");

const paulTwo = {
	...paul,
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_bbbbbbbbbbbbbbbb"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paultwo"),
};

const toRecipient = (
	identity: Pick<
		typeof paul,
		"displayName" | "identityUpdatedAt" | "ownerId" | "publicKey"
	>,
) => ({
	displayName: identity.displayName,
	identityUpdatedAt: identity.identityUpdatedAt,
	ownerId: identity.ownerId,
	publicKey: identity.publicKey,
});

describe("RevokePayloadRecipient", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(RevokePayloadRecipient.Default, [
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
		it.effect("removes granted recipient by ownerId", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paul],
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
					recipients: [selfRecipient, toRecipient(paul)],
					version: 2,
				});

				const result = yield* RevokePayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new RevokePayloadRecipientRemovedSuccess({
						path: "/workspace/.env.enc",
					}),
				);
				expect(
					payloadCrypto.snapshot().encryptCalls[0]?.envelope,
				).toMatchObject({
					recipients: [selfRecipient],
				});
			}),
		);

		it.effect("returns unchanged when recipient is not granted", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paul],
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
					recipients: [selfRecipient],
					version: 2,
				});

				const result = yield* RevokePayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				});

				expect(result).toEqual(
					new RevokePayloadRecipientUnchangedSuccess({
						path: "/workspace/.env.enc",
						reason: "recipient-not-granted",
					}),
				);
			}),
		);

		it.effect("forbids revoking current self identity", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paul],
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
					recipients: [selfRecipient],
					version: 2,
				});

				const result = yield* RevokePayloadRecipient.execute({
					identityRef: "isaac#069f7576",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						RevokePayloadRecipientForbiddenSelfError,
					);
				}
			}),
		);

		it.effect("fails when identity ref is ambiguous", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paul, paulTwo],
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
					recipients: [toRecipient(paul), toRecipient(paulTwo), selfRecipient],
					version: 2,
				});

				const result = yield* RevokePayloadRecipient.execute({
					identityRef: "paul",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						RevokePayloadRecipientAmbiguousIdentityError,
					);
				}
			}),
		);

		it.effect("fails when payload needs update first", () =>
			Effect.gen(function* () {
				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(selfFingerprint),
					knownIdentities: [paul],
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
						toRecipient(paul),
					],
					version: 2,
				});

				const result = yield* RevokePayloadRecipient.execute({
					identityRef: "paul#aaaaaaaa",
					passphrase: "test-passphrase",
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						RevokePayloadRecipientUpdateRequiredError,
					);
				}
			}),
		);

		it.effect(
			"fails with version remediation when payload is newer than CLI",
			() =>
				Effect.gen(function* () {
					yield* homeRepository.saveState({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(selfFingerprint),
						knownIdentities: [paul],
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

					const result = yield* RevokePayloadRecipient.execute({
						identityRef: "paul#aaaaaaaa",
						passphrase: "test-passphrase",
						path: "/workspace/newer.env.enc",
					}).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toEqual(
							new RevokePayloadRecipientVersionError({
								message:
									"CLI is too old to open this payload. Update CLI to latest version.",
							}),
						);
					}
				}),
		);
	});
});
