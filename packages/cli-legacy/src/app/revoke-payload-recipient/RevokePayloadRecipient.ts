import { Clock, Effect, Option } from "effect";
import { resolveRevokeIdentityRef } from "../../domain/identity/ResolveIdentityRef.js";
import type { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { decideRevokeRecipient } from "../../domain/payload/PayloadRecipientMutation.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import { RewritePayloadEnvelope } from "../shared/RewritePayloadEnvelope.js";
import {
	RevokePayloadRecipientAmbiguousIdentityError,
	RevokePayloadRecipientCryptoError,
	RevokePayloadRecipientEnvError,
	RevokePayloadRecipientForbiddenSelfError,
	RevokePayloadRecipientPersistenceError,
	RevokePayloadRecipientRemovedSuccess,
	RevokePayloadRecipientUnchangedSuccess,
	RevokePayloadRecipientUpdateRequiredError,
	RevokePayloadRecipientVersionError,
} from "./RevokePayloadRecipientError.js";

export class RevokePayloadRecipient extends Effect.Service<RevokePayloadRecipient>()(
	"RevokePayloadRecipient",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const openPayload = yield* OpenPayload;
			const rewritePayloadEnvelope = yield* RewritePayloadEnvelope;

			const execute = Effect.fn("RevokePayloadRecipient.execute")(
				function* (input: {
					readonly identityRef: string;
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
									case "OpenPayloadFileFormatError":
									case "OpenPayloadEnvelopeError":
										return new RevokePayloadRecipientPersistenceError({
											message: error.message,
											operation: "open payload",
										});
									case "OpenPayloadCryptoError":
										return new RevokePayloadRecipientCryptoError({
											message: error.message,
										});
									case "OpenPayloadEnvError":
										return new RevokePayloadRecipientEnvError({
											message: error.message,
										});
									case "OpenPayloadVersionError":
										return new RevokePayloadRecipientVersionError({
											message: error.message,
										});
								}
							}),
						);

					if (openedPayload.needsUpdate.isRequired) {
						return yield* new RevokePayloadRecipientUpdateRequiredError({
							message: "Payload must be updated before revoke",
							path: input.path,
						});
					}

					const resolution = resolveRevokeIdentityRef({
						identityRef: input.identityRef,
						knownIdentities: openedPayload.nextState.knownIdentities,
						localAliases: openedPayload.nextState.localAliases,
						payloadRecipients: openedPayload.envelope.recipients,
						selfIdentity: openedPayload.nextState.self,
					});

					switch (resolution._tag) {
						case "ambiguous":
							return yield* new RevokePayloadRecipientAmbiguousIdentityError({
								candidates: resolution.candidates,
								identityRef: input.identityRef,
								message: "Identity ref is ambiguous",
							});
						case "not-found":
							return new RevokePayloadRecipientUnchangedSuccess({
								path: input.path,
								reason: "recipient-not-granted",
							});
						case "resolved":
							break;
					}

					const decision = decideRevokeRecipient({
						currentRecipients: openedPayload.envelope.recipients,
						selfOwnerId: Option.getOrNull(
							Option.map(
								openedPayload.nextState.self,
								(selfIdentity) => selfIdentity.publicIdentity.ownerId,
							),
						),
						targetOwnerId: resolution.ownerId,
					});

					switch (decision._tag) {
						case "forbidden-self":
							return yield* new RevokePayloadRecipientForbiddenSelfError({
								message: "Revoking current self identity is forbidden in v0",
							});
						case "unchanged-absent":
							return new RevokePayloadRecipientUnchangedSuccess({
								path: input.path,
								reason: "recipient-not-granted",
							});
						case "remove": {
							const now = new Date(
								yield* Clock.currentTimeMillis,
							).toISOString();
							const nextEnvelope: PayloadEnvelope = {
								...openedPayload.envelope,
								lastRewrittenAt:
									now as typeof openedPayload.envelope.lastRewrittenAt,
								recipients: decision.nextRecipients,
							};
							yield* rewritePayloadEnvelope
								.execute({
									envelope: nextEnvelope,
									path: input.path,
								})
								.pipe(
									Effect.mapError((error) => {
										switch (error._tag) {
											case "RewritePayloadEnvelopeCryptoError":
												return new RevokePayloadRecipientCryptoError({
													message: error.message,
												});
											case "RewritePayloadEnvelopePersistenceError":
												return new RevokePayloadRecipientPersistenceError({
													message: error.message,
													operation: error.operation,
												});
										}
									}),
								);

							return new RevokePayloadRecipientRemovedSuccess({
								path: input.path,
							});
						}
					}
				},
			);

			return { execute };
		}),
	},
) {}
