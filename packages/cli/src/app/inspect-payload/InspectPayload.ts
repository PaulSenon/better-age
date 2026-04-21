import { Effect, Option, Schema } from "effect";
import { getSelfIdentity } from "../../domain/home/HomeState.js";
import {
	getLocalAlias,
	materializeSelfIdentity,
} from "../../domain/identity/Identity.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
} from "../../domain/identity/PublicIdentity.js";
import { OpenPayload } from "../shared/OpenPayload.js";
import {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
	InspectPayloadSuccess,
	InspectPayloadVersionError,
} from "./InspectPayloadError.js";

export class InspectPayload extends Effect.Service<InspectPayload>()(
	"InspectPayload",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const openPayload = yield* OpenPayload;

			const execute = Effect.fn("InspectPayload.execute")(function* (input: {
				readonly passphrase: string;
				readonly path: string;
			}) {
				const openedPayload = yield* openPayload.execute(input).pipe(
					Effect.mapError((error) => {
						switch (error._tag) {
							case "OpenPayloadPersistenceError":
								return new InspectPayloadPersistenceError({
									message: error.message,
									operation: error.operation,
								});
							case "OpenPayloadFileFormatError":
								return new InspectPayloadFileFormatError({
									message: error.message,
								});
							case "OpenPayloadCryptoError":
								return new InspectPayloadCryptoError({
									message: error.message,
								});
							case "OpenPayloadEnvelopeError":
								return new InspectPayloadEnvelopeError({
								message: error.message,
							});
							case "OpenPayloadVersionError":
								return new InspectPayloadVersionError({
									message: error.message,
								});
							case "OpenPayloadEnvError":
								return new InspectPayloadEnvError({
									message: error.message,
								});
						}
					}),
				);
				const { envelope, envKeys, needsUpdate, nextState } = openedPayload;
				const selfIdentity = getSelfIdentity(nextState);

				return new InspectPayloadSuccess({
					createdAt: envelope.createdAt,
					envKeys,
					lastRewrittenAt: envelope.lastRewrittenAt,
					needsUpdate,
					path: openedPayload.path,
					payloadId: envelope.payloadId,
					recipientCount: envelope.recipients.length,
					recipients: envelope.recipients.map((recipient) => {
						const knownIdentity = nextState.knownIdentities.find(
							(identity) => identity.ownerId === recipient.ownerId,
						);
						const isMe =
							Option.isSome(selfIdentity) &&
							selfIdentity.value.publicIdentity.ownerId === recipient.ownerId;
						const resolvedSelfIdentity =
							Option.isSome(selfIdentity)
								? materializeSelfIdentity(selfIdentity.value)
								: null;

						return {
							displayName: recipient.displayName,
							fingerprint: derivePublicIdentityFingerprint(recipient),
							handle:
								isMe && resolvedSelfIdentity !== null
									? resolvedSelfIdentity.handle
									: derivePublicIdentityHandle(knownIdentity ?? recipient),
							isMe,
							isStaleSelf:
								isMe &&
								needsUpdate.isRequired &&
								recipient.ownerId === selfIdentity.value?.publicIdentity.ownerId,
							localAlias:
								knownIdentity === undefined
									? Option.none()
									: getLocalAlias(nextState.localAliases, knownIdentity.ownerId),
						};
					}),
					secretCount: envKeys.length,
					version: envelope.version,
				});
			});

			return { execute };
		}),
	},
) {}
