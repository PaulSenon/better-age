import { randomBytes } from "node:crypto";
import { Clock, Effect, Option, Schema } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { PayloadId } from "../../domain/payload/PayloadId.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import type { PayloadEncryptError } from "../../port/PayloadCryptoError.js";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import type { PayloadWriteError } from "../../port/PayloadRepositoryError.js";
import {
	CreatePayloadCryptoError,
	CreatePayloadNotSetUpError,
	CreatePayloadPersistenceError,
	CreatePayloadSuccess,
} from "./CreatePayloadError.js";

const makePayloadId = () =>
	Schema.decodeUnknownSync(PayloadId)(
		`bspld_${randomBytes(8).toString("hex")}`,
	);

const toPersistenceError = (
	operation: string,
	error: HomeStateDecodeError | HomeStateLoadError | PayloadWriteError,
) =>
	new CreatePayloadPersistenceError({
		message: error.message,
		operation,
	});

export class CreatePayload extends Effect.Service<CreatePayload>()(
	"CreatePayload",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;
			const payloadRepository = yield* PayloadRepository;
			const payloadCrypto = yield* PayloadCrypto;

			const execute = Effect.fn("CreatePayload.execute")(function* (input: {
				readonly path: string;
			}) {
				const state = yield* homeRepository.loadState.pipe(
					Effect.mapError((error) =>
						toPersistenceError("load home state", error),
					),
				);
				const selfIdentity = getSelfIdentity(state);

				if (Option.isNone(selfIdentity)) {
					return yield* new CreatePayloadNotSetUpError({
						message: "No local identity is configured",
					});
				}

				const now = new Date(yield* Clock.currentTimeMillis).toISOString();
				const envelope = yield* Schema.decodeUnknown(PayloadEnvelope)({
					createdAt: now,
					envText: "",
					lastRewrittenAt: now,
					payloadId: makePayloadId(),
					recipients: [
						{
							displayNameSnapshot: selfIdentity.value.displayName,
							fingerprint: selfIdentity.value.fingerprint,
							identityUpdatedAt: selfIdentity.value.identityUpdatedAt,
							ownerId: selfIdentity.value.ownerId,
							publicKey: selfIdentity.value.publicKey,
						},
					],
					version: 1,
				}).pipe(Effect.orDie);
				const armoredPayload = yield* payloadCrypto
					.encryptEnvelope({
						envelope,
						recipients: [selfIdentity.value.publicKey],
					})
					.pipe(
						Effect.mapError(
							(error: PayloadEncryptError) =>
								new CreatePayloadCryptoError({
									message: error.message,
								}),
						),
					);

				yield* payloadRepository
					.writeFile(
						input.path,
						serializePayloadFile({
							armoredPayload,
						}),
					)
					.pipe(
						Effect.mapError((error) =>
							toPersistenceError("write payload file", error),
						),
					);

				return new CreatePayloadSuccess({
					path: input.path,
					payloadId: envelope.payloadId,
				});
			});

			return { execute };
		}),
	},
) {}
