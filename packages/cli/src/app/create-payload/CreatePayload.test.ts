import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { parsePayloadFile } from "../../domain/payload/PayloadFile.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { HomeStateLoadError } from "../../port/HomeRepositoryError.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { CreatePayload } from "./CreatePayload.js";
import {
	makeInMemoryPayloadCrypto,
	makeInMemoryPayloadRepository,
} from "./CreatePayload.test-support.js";

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
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1testrecipient");

describe("CreatePayload", () => {
	const homeRepository = makeInMemoryHomeRepository();
	const payloadRepository = makeInMemoryPayloadRepository();
	const payloadCrypto = makeInMemoryPayloadCrypto();

	layer(
		Layer.provide(CreatePayload.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(payloadRepository.tag, payloadRepository.service),
			Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
		]),
	)("success", (it) => {
		it.effect(
			"creates a payload for self only and writes final payload file",
			() =>
				Effect.gen(function* () {
					yield* homeRepository.saveState({
						...homeRepository.snapshot().state,
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
					});

					const result = yield* CreatePayload.execute({
						path: "/workspace/.env.enc",
					});

					expect(result.path).toBe("/workspace/.env.enc");
					expect(result.payloadId).toMatch(/^bspld_[a-f0-9]{16}$/);

					const writtenFile = payloadRepository
						.snapshot()
						.files.get("/workspace/.env.enc");
					expect(writtenFile).toBeTruthy();

					const parsedFile = parsePayloadFile(writtenFile ?? "");
					expect(parsedFile._tag).toBe("Right");

					expect(payloadCrypto.snapshot().encryptCalls).toHaveLength(1);
					expect(payloadCrypto.snapshot().encryptCalls[0]?.recipients).toEqual([
						selfPublicKey,
					]);

					const envelope = payloadCrypto.snapshot().encryptCalls[0]?.envelope;
					expect(envelope).toBeTruthy();

					const decodedEnvelope = yield* Schema.decodeUnknown(PayloadEnvelope)(
						envelope,
					).pipe(Effect.orDie);
					expect(decodedEnvelope.payloadId).toBe(result.payloadId);
					expect(decodedEnvelope.envText).toBe("");
					expect(decodedEnvelope.createdAt).toBe(
						decodedEnvelope.lastRewrittenAt,
					);
					expect(decodedEnvelope.recipients).toEqual([
						{
							displayNameSnapshot: selfDisplayName,
							fingerprint: selfFingerprint,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							publicKey: selfPublicKey,
						},
					]);
				}),
		);
	});

	layer(
		Layer.provide(CreatePayload.Default, [
			Layer.succeed(
				HomeRepository,
				HomeRepository.make({
					deletePrivateKey: () => Effect.void,
					getActiveKey: Effect.succeed(Option.none()),
					getLocation: Effect.die("unused"),
					loadState: Effect.fail(
						new HomeStateLoadError({
							message: "Failed to load home state",
							stateFile: "/virtual-home/state.json",
						}),
					),
					readPrivateKey: () => Effect.die("unused"),
					saveState: () => Effect.void,
					writePrivateKey: () => Effect.die("unused"),
					writePrivateKeyAtPath: () => Effect.die("unused"),
				}),
			),
			Layer.succeed(payloadRepository.tag, payloadRepository.service),
			Layer.succeed(payloadCrypto.tag, payloadCrypto.service),
		]),
	)("failure", (it) => {
		it.effect("fails when home state cannot be loaded", () =>
			Effect.gen(function* () {
				const result = yield* CreatePayload.execute({
					path: "/workspace/.env.enc",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
			}),
		);
	});
});
