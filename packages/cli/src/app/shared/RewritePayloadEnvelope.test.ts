import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import {
	makeInMemoryPayloadCrypto,
	makeInMemoryPayloadRepository,
} from "../create-payload/CreatePayload.test-support.js";
import { RewritePayloadEnvelope } from "./RewritePayloadEnvelope.js";

const rewriteEnvelope = Schema.decodeUnknownSync(PayloadEnvelope)({
	createdAt: "2026-04-14T10:00:00.000Z",
	envText: "API_TOKEN=secret\n",
	lastRewrittenAt: "2026-04-14T11:00:00.000Z",
	payloadId: "bspld_0123456789abcdef",
	recipients: [
		{
			displayNameSnapshot: Schema.decodeUnknownSync(DisplayName)("isaac"),
			fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
				"bs1_1111111111111111",
			),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T10:00:00.000Z",
			),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
		},
		{
			displayNameSnapshot: Schema.decodeUnknownSync(DisplayName)("paul"),
			fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
				"bs1_aaaaaaaaaaaaaaaa",
			),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T11:00:00.000Z",
			),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
		},
	],
	version: 1,
});

describe("RewritePayloadEnvelope", () => {
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(RewritePayloadEnvelope.Default, [
			Layer.succeed(payloadRepository.tag, payloadRepository.service),
			Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
		]),
	)("success", (it) => {
		it.effect(
			"encrypts with recipient public keys and writes final payload file",
			() =>
				Effect.gen(function* () {
					yield* RewritePayloadEnvelope.execute({
						envelope: rewriteEnvelope,
						path: "/workspace/.env.enc",
					});

					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls[0]).toMatchObject({
						recipients: ["age1isaac", "age1paul"],
					});
					expect(payloadRepository.snapshot().writeCalls).toHaveLength(1);
					expect(payloadRepository.snapshot().writeCalls[0]?.path).toBe(
						"/workspace/.env.enc",
					);
				}),
		);
	});
});
