import { Clock, Effect } from "effect";
import { resolveGrantIdentityRef } from "../../domain/identity/ResolveIdentityRef.js";
import { decideGrantRecipient } from "../../domain/payload/PayloadRecipientMutation.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import { RewritePayloadEnvelope } from "../shared/RewritePayloadEnvelope.js";
import {
	GrantPayloadRecipientAddedSuccess,
	GrantPayloadRecipientAmbiguousIdentityError,
	GrantPayloadRecipientCryptoError,
	GrantPayloadRecipientEnvError,
	GrantPayloadRecipientIdentityNotFoundError,
	GrantPayloadRecipientPersistenceError,
	GrantPayloadRecipientUnchangedSuccess,
	GrantPayloadRecipientUpdatedSuccess,
	GrantPayloadRecipientUpdateRequiredError,
	GrantPayloadRecipientVersionError,
} from "./GrantPayloadRecipientError.js";

export class GrantPayloadRecipient extends Effect.Service<GrantPayloadRecipient>()(
	"GrantPayloadRecipient",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const openPayload = yield* OpenPayload;
			const rewritePayloadEnvelope = yield* RewritePayloadEnvelope;

			const execute = Effect.fn("GrantPayloadRecipient.execute")(
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
										return new GrantPayloadRecipientPersistenceError({
											message: error.message,
											operation: "open payload",
										});
									case "OpenPayloadCryptoError":
										return new GrantPayloadRecipientCryptoError({
											message: error.message,
										});
									case "OpenPayloadEnvError":
										return new GrantPayloadRecipientEnvError({
											message: error.message,
										});
									case "OpenPayloadVersionError":
										return new GrantPayloadRecipientVersionError({
											message: error.message,
										});
								}
							}),
						);

					if (openedPayload.needsUpdate.isRequired) {
						return yield* new GrantPayloadRecipientUpdateRequiredError({
							message: "Payload must be updated before grant",
							path: input.path,
						});
					}

					const resolution = resolveGrantIdentityRef({
						identityRef: input.identityRef,
						knownIdentities: openedPayload.nextState.knownIdentities,
						localAliases: openedPayload.nextState.localAliases,
						selfIdentity: openedPayload.nextState.self,
					});

					switch (resolution._tag) {
						case "ambiguous":
							return yield* new GrantPayloadRecipientAmbiguousIdentityError({
								candidates: resolution.candidates,
								identityRef: input.identityRef,
								message: "Identity ref is ambiguous",
							});
						case "not-found":
							return yield* new GrantPayloadRecipientIdentityNotFoundError({
								identityRef: input.identityRef,
								message: "Identity ref did not match any known identity",
							});
						case "resolved":
							break;
					}

					const decision = decideGrantRecipient({
						currentRecipients: openedPayload.envelope.recipients,
						targetIdentity: resolution.identity,
					});

					switch (decision._tag) {
						case "unchanged-identical":
							return new GrantPayloadRecipientUnchangedSuccess({
								handle: resolution.identity.handle,
								path: input.path,
								reason: "already-granted",
							});
						case "unchanged-outdated-input":
							return new GrantPayloadRecipientUnchangedSuccess({
								handle: resolution.identity.handle,
								path: input.path,
								reason: "outdated-input",
							});
						case "add":
						case "replace": {
							const now = new Date(
								yield* Clock.currentTimeMillis,
							).toISOString();
							yield* rewritePayloadEnvelope
								.execute({
									envelope: {
										...openedPayload.envelope,
										lastRewrittenAt:
											now as typeof openedPayload.envelope.lastRewrittenAt,
										recipients: decision.nextRecipients,
									},
									path: input.path,
								})
								.pipe(
									Effect.mapError((error) => {
										switch (error._tag) {
											case "RewritePayloadEnvelopeCryptoError":
												return new GrantPayloadRecipientCryptoError({
													message: error.message,
												});
											case "RewritePayloadEnvelopePersistenceError":
												return new GrantPayloadRecipientPersistenceError({
													message: error.message,
													operation: error.operation,
												});
										}
									}),
								);

							return decision._tag === "add"
								? new GrantPayloadRecipientAddedSuccess({
										handle: resolution.identity.handle,
										path: input.path,
									})
								: new GrantPayloadRecipientUpdatedSuccess({
										handle: resolution.identity.handle,
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
