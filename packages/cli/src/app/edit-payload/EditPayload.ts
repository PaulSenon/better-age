import { Clock, Effect } from "effect";
import {
	parseEnvDocument,
	serializeEnvDocument,
} from "../../domain/payload/EnvDocument.js";
import { serializePayloadFile } from "../../domain/payload/PayloadFile.js";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import type { PayloadEncryptError } from "../../port/PayloadCryptoError.js";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import type { PayloadWriteError } from "../../port/PayloadRepositoryError.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import {
	EditPayloadCryptoError,
	EditPayloadEnvError,
	EditPayloadOpenSuccess,
	EditPayloadPersistenceError,
	EditPayloadRewrittenSuccess,
	EditPayloadUnchangedSuccess,
	EditPayloadUpdateRequiredError,
} from "./EditPayloadError.js";

const toPersistenceError = (operation: string, error: PayloadWriteError) =>
	new EditPayloadPersistenceError({
		message: error.message,
		operation,
	});

const updateRequiredMessage = "Payload must be updated before edit";

export class EditPayload extends Effect.Service<EditPayload>()("EditPayload", {
	accessors: true,
	effect: Effect.gen(function* () {
		const openPayload = yield* OpenPayload;
		const payloadCrypto = yield* PayloadCrypto;
		const payloadRepository = yield* PayloadRepository;

		const open = Effect.fn("EditPayload.open")(function* (input: {
			readonly passphrase: string;
			readonly path: string;
		}) {
			const openedPayload = yield* openPayload.execute(input).pipe(
				Effect.mapError((error) => {
					switch (error._tag) {
						case "OpenPayloadPersistenceError":
							return new EditPayloadPersistenceError({
								message: error.message,
								operation: error.operation,
							});
						case "OpenPayloadCryptoError":
							return new EditPayloadCryptoError({
								message: error.message,
							});
						case "OpenPayloadEnvError":
							return new EditPayloadEnvError({
								message: error.message,
							});
						case "OpenPayloadFileFormatError":
							return new EditPayloadPersistenceError({
								message: error.message,
								operation: "open payload file",
							});
						case "OpenPayloadEnvelopeError":
							return new EditPayloadPersistenceError({
								message: error.message,
								operation: "decode payload envelope",
							});
					}
				}),
			);

			if (openedPayload.needsUpdate.isRequired) {
				return yield* new EditPayloadUpdateRequiredError({
					message: updateRequiredMessage,
					path: input.path,
				});
			}

			return new EditPayloadOpenSuccess({
				envText: openedPayload.envelope.envText,
				path: input.path,
			});
		});

		const save = Effect.fn("EditPayload.save")(function* (input: {
			readonly editedEnvText: string;
			readonly passphrase: string;
			readonly path: string;
		}) {
			const openedPayload = yield* openPayload
				.execute({
					passphrase: input.passphrase,
					path: input.path,
				})
				.pipe(
					Effect.mapError((error) => {
						switch (error._tag) {
							case "OpenPayloadPersistenceError":
								return new EditPayloadPersistenceError({
									message: error.message,
									operation: error.operation,
								});
							case "OpenPayloadCryptoError":
								return new EditPayloadCryptoError({
									message: error.message,
								});
							case "OpenPayloadEnvError":
								return new EditPayloadEnvError({
									message: error.message,
								});
							case "OpenPayloadFileFormatError":
								return new EditPayloadPersistenceError({
									message: error.message,
									operation: "open payload file",
								});
							case "OpenPayloadEnvelopeError":
								return new EditPayloadPersistenceError({
									message: error.message,
									operation: "decode payload envelope",
								});
						}
					}),
				);

			if (openedPayload.needsUpdate.isRequired) {
				return yield* new EditPayloadUpdateRequiredError({
					message: updateRequiredMessage,
					path: input.path,
				});
			}

			const normalizedEnvText = yield* Effect.try({
				catch: (cause) =>
					cause instanceof Error
						? new EditPayloadEnvError({
								message: cause.message,
							})
						: new EditPayloadEnvError({
								message: "Env text could not be parsed",
							}),
				try: () => serializeEnvDocument(parseEnvDocument(input.editedEnvText)),
			});

			if (input.editedEnvText === openedPayload.envelope.envText) {
				return new EditPayloadUnchangedSuccess({
					path: input.path,
				});
			}

			const now = new Date(yield* Clock.currentTimeMillis).toISOString();
			const nextEnvelope = {
				...openedPayload.envelope,
				envText: normalizedEnvText,
				lastRewrittenAt: now as typeof openedPayload.envelope.lastRewrittenAt,
			};
			const armoredPayload = yield* payloadCrypto
				.encryptEnvelope({
					envelope: nextEnvelope,
					recipients: openedPayload.envelope.recipients.map(
						(recipient) => recipient.publicKey,
					),
				})
				.pipe(
					Effect.mapError(
						(error: PayloadEncryptError) =>
							new EditPayloadCryptoError({
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

			return new EditPayloadRewrittenSuccess({
				path: input.path,
				payloadId: openedPayload.envelope.payloadId,
			});
		});

		return { open, save };
	}),
}) {}
