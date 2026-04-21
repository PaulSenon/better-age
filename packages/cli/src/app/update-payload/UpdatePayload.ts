import { Clock, Effect, Option } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import type { PayloadRecipient } from "../../domain/payload/PayloadEnvelope.js";
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
} from "./UpdatePayloadError.js";

const chooseSelfRecipient = (
	selfRecipients: ReadonlyArray<PayloadRecipient>,
	currentSelfRecipient: PayloadRecipient,
): PayloadRecipient => {
	const matchingCurrentRecipient = selfRecipients.find(
		(recipient) =>
			recipient.displayNameSnapshot ===
				currentSelfRecipient.displayNameSnapshot &&
			recipient.fingerprint === currentSelfRecipient.fingerprint &&
			recipient.identityUpdatedAt === currentSelfRecipient.identityUpdatedAt &&
			recipient.ownerId === currentSelfRecipient.ownerId &&
			recipient.publicKey === currentSelfRecipient.publicKey,
	);

	if (matchingCurrentRecipient !== undefined) {
		return matchingCurrentRecipient;
	}

	return (
		selfRecipients
			.slice()
			.sort((left, right) =>
				left.identityUpdatedAt > right.identityUpdatedAt ? -1 : 1,
			)[0] ?? currentSelfRecipient
	);
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
				const selfRecipients = openedPayload.envelope.recipients.filter(
					(recipient) => recipient.ownerId === selfIdentity.value.ownerId,
				);
				const fallbackSelfRecipient = chooseSelfRecipient(
					selfRecipients,
					currentSelfRecipient,
				);
				const nextRecipients = [
					...openedPayload.envelope.recipients.filter(
						(recipient) => recipient.ownerId !== selfIdentity.value.ownerId,
					),
					updateState.reasons.includes("self-stale")
						? currentSelfRecipient
						: fallbackSelfRecipient,
				];
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
