import { Effect } from "effect";
import type { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import type { PayloadEncryptError } from "../../port/PayloadCryptoError.js";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import type { PayloadWriteError } from "../../port/PayloadRepositoryError.js";
import {
	RewritePayloadEnvelopeCryptoError,
	RewritePayloadEnvelopePersistenceError,
} from "./RewritePayloadEnvelopeError.js";

const toPersistenceError = (operation: string, error: PayloadWriteError) =>
	new RewritePayloadEnvelopePersistenceError({
		message: error.message,
		operation,
	});

export class RewritePayloadEnvelope extends Effect.Service<RewritePayloadEnvelope>()(
	"RewritePayloadEnvelope",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const payloadCrypto = yield* PayloadCrypto;
			const payloadRepository = yield* PayloadRepository;

			const execute = Effect.fn("RewritePayloadEnvelope.execute")(
				function* (input: {
					readonly envelope: PayloadEnvelope;
					readonly path: string;
				}) {
					const armoredPayload = yield* payloadCrypto
						.encryptEnvelope({
							envelope: input.envelope,
							recipients: input.envelope.recipients.map(
								(recipient) => recipient.publicKey,
							),
						})
						.pipe(
							Effect.mapError(
								(error: PayloadEncryptError) =>
									new RewritePayloadEnvelopeCryptoError({
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
				},
			);

			return { execute };
		}),
	},
) {}
