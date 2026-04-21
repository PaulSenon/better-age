import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { PayloadEnvelope } from "../../../src/domain/payload/PayloadEnvelope.js";
import { makePayloadAgeCrypto } from "../../../src/infra/crypto/payloadAgeCrypto.js";
import { makeTypageCrypto } from "../../../src/infra/crypto/typageCrypto.js";
import { Crypto } from "../../../src/port/Crypto.js";
import { PayloadCrypto } from "../../../src/port/PayloadCrypto.js";

describe("PayloadAgeCrypto integration", () => {
	layer(
		Layer.mergeAll(
			Layer.succeed(Crypto, makeTypageCrypto()),
			Layer.succeed(PayloadCrypto, makePayloadAgeCrypto()),
		),
	)("round trip", (it) => {
		it.effect(
			"encrypts and decrypts payload envelope with passphrase-protected identity",
			() =>
				Effect.gen(function* () {
					const generatedIdentity = yield* Crypto.generateUserIdentity({
						keyMode: "pq-hybrid",
						passphrase: "integration-passphrase",
					});
					const envelope = yield* Schema.decodeUnknown(PayloadEnvelope)({
						createdAt: "2026-04-14T10:00:00.000Z",
						envText: "API_TOKEN=secret\n",
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						payloadId: "bspld_0123456789abcdef",
						recipients: [
							{
								displayNameSnapshot: "integration-host",
								fingerprint: generatedIdentity.fingerprint,
								identityUpdatedAt: generatedIdentity.identityUpdatedAt,
								ownerId: generatedIdentity.ownerId,
								publicKey: generatedIdentity.publicKey,
							},
						],
						version: 1,
					}).pipe(Effect.orDie);

					const armoredPayload = yield* PayloadCrypto.encryptEnvelope({
						envelope,
						recipients: [generatedIdentity.publicKey],
					});
					const decryptedEnvelope = yield* PayloadCrypto.decryptEnvelope({
						armoredPayload,
						encryptedPrivateKeys: [generatedIdentity.encryptedSecretKey],
						passphrase: "integration-passphrase",
					});

					const decodedEnvelope = yield* Schema.decodeUnknown(PayloadEnvelope)(
						decryptedEnvelope,
					).pipe(Effect.orDie);

					expect(decodedEnvelope).toEqual(envelope);
				}),
		);
	});
});
