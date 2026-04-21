import { Clock, Effect, Option } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import { materializeSelfIdentity } from "../../domain/identity/Identity.js";
import type { PayloadRecipient } from "../../domain/payload/PayloadEnvelope.js";
import type { PayloadUpdateReason } from "../../domain/payload/PayloadUpdateState.js";
import {
	computePayloadUpdateState,
	getPayloadUpdateReasonMessage,
	toPayloadRecipientFromSelfIdentity,
} from "../../domain/payload/PayloadUpdateState.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import { RewritePayloadEnvelope } from "../shared/RewritePayloadEnvelope.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadEnvelopeError,
	UpdatePayloadFileFormatError,
	UpdatePayloadNoSelfIdentityError,
	UpdatePayloadPersistenceError,
	UpdatePayloadUnchangedSuccess,
	UpdatePayloadUpdatedSuccess,
	UpdatePayloadVersionError,
} from "./UpdatePayloadError.js";

const synthesizeNextRecipients = (input: {
	readonly currentSelfRecipient: PayloadRecipient;
	readonly ownerId: string;
	readonly reasons: ReadonlyArray<PayloadUpdateReason>;
	readonly recipients: ReadonlyArray<PayloadRecipient>;
}): ReadonlyArray<PayloadRecipient> => {
	if (
		!input.reasons.includes("self-stale") &&
		!input.reasons.includes("duplicate-self-recipient")
	) {
		return input.recipients;
	}

	const nextRecipients: Array<PayloadRecipient> = [];
	let didWriteSelfRecipient = false;

	for (const recipient of input.recipients) {
		if (recipient.ownerId !== input.ownerId) {
			nextRecipients.push(recipient);
			continue;
		}

		if (didWriteSelfRecipient) {
			continue;
		}

		nextRecipients.push(input.currentSelfRecipient);
		didWriteSelfRecipient = true;
	}

	return nextRecipients;
};

export class UpdatePayload extends Effect.Service<UpdatePayload>()(
	"UpdatePayload",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const openPayload = yield* OpenPayload;
			const rewritePayloadEnvelope = yield* RewritePayloadEnvelope;

			const execute = Effect.fn("UpdatePayload.execute")(function* (input: {
				readonly passphrase: string;
				readonly path: string;
			}) {
				const openedPayload = yield* openPayload.execute(input).pipe(
					Effect.mapError((error) => {
						switch (error._tag) {
							case "OpenPayloadPersistenceError":
								return new UpdatePayloadPersistenceError({
									message: error.message,
									operation: "open payload",
								});
							case "OpenPayloadFileFormatError":
								return new UpdatePayloadFileFormatError({
									message: error.message,
								});
							case "OpenPayloadCryptoError":
								return new UpdatePayloadCryptoError({
									message: error.message,
								});
							case "OpenPayloadEnvelopeError":
								return new UpdatePayloadEnvelopeError({
									message: error.message,
								});
							case "OpenPayloadVersionError":
								return new UpdatePayloadVersionError({
									message: error.message,
								});
							case "OpenPayloadEnvError":
								return new UpdatePayloadEnvError({
									message: error.message,
								});
						}
					}),
				);
				const updateState = computePayloadUpdateState(
					openedPayload.nextState,
					openedPayload.envelope,
					openedPayload.persistedSchemaVersion === undefined
						? {}
						: {
								persistedSchemaVersion: openedPayload.persistedSchemaVersion,
							},
				);
				const reasons = updateState.reasons.map(getPayloadUpdateReasonMessage);
				const selfIdentity = getSelfIdentity(openedPayload.nextState);

				if (Option.isNone(selfIdentity)) {
					return yield* new UpdatePayloadNoSelfIdentityError({
						message: ["No local self identity found", "Run: bage setup"].join(
							"\n",
						),
					});
				}

				if (!updateState.isRequired) {
					return new UpdatePayloadUnchangedSuccess({
						path: input.path,
						reasons,
					});
				}

				const currentSelfRecipient = toPayloadRecipientFromSelfIdentity(
					selfIdentity.value,
				);
				const resolvedSelfIdentity = materializeSelfIdentity(
					selfIdentity.value,
				);
				const nextRecipients = synthesizeNextRecipients({
					currentSelfRecipient,
					ownerId: resolvedSelfIdentity.ownerId,
					reasons: updateState.reasons,
					recipients: openedPayload.envelope.recipients,
				});
				const now = new Date(yield* Clock.currentTimeMillis).toISOString();

				yield* rewritePayloadEnvelope
					.execute({
						envelope: {
							...openedPayload.envelope,
							lastRewrittenAt:
								now as typeof openedPayload.envelope.lastRewrittenAt,
							recipients: nextRecipients,
						},
						path: input.path,
					})
					.pipe(
						Effect.mapError((error) => {
							switch (error._tag) {
								case "RewritePayloadEnvelopeCryptoError":
									return new UpdatePayloadCryptoError({
										message: error.message,
									});
								case "RewritePayloadEnvelopePersistenceError":
									return new UpdatePayloadPersistenceError({
										message: error.message,
										operation: error.operation,
									});
							}
						}),
					);

				return new UpdatePayloadUpdatedSuccess({
					path: input.path,
					payloadId: openedPayload.envelope.payloadId,
					reasons,
				});
			});

			return { execute };
		}),
	},
) {}
