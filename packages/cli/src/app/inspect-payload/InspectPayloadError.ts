import { Schema } from "effect";
import { PayloadId } from "../../domain/payload/PayloadId.js";

export class InspectPayloadPersistenceError extends Schema.TaggedError<InspectPayloadPersistenceError>()(
	"InspectPayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class InspectPayloadFileFormatError extends Schema.TaggedError<InspectPayloadFileFormatError>()(
	"InspectPayloadFileFormatError",
	{
		message: Schema.String,
	},
) {}

export class InspectPayloadCryptoError extends Schema.TaggedError<InspectPayloadCryptoError>()(
	"InspectPayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class InspectPayloadEnvelopeError extends Schema.TaggedError<InspectPayloadEnvelopeError>()(
	"InspectPayloadEnvelopeError",
	{
		message: Schema.String,
	},
) {}

export class InspectPayloadEnvError extends Schema.TaggedError<InspectPayloadEnvError>()(
	"InspectPayloadEnvError",
	{
		message: Schema.String,
	},
) {}

export class InspectPayloadSuccess extends Schema.TaggedClass<InspectPayloadSuccess>()(
	"InspectPayloadSuccess",
	{
		createdAt: Schema.String,
		envKeys: Schema.Array(Schema.String),
		lastRewrittenAt: Schema.String,
		needsUpdate: Schema.Struct({
			isRequired: Schema.Boolean,
			reason: Schema.OptionFromNullOr(Schema.String),
		}),
		path: Schema.String,
		payloadId: PayloadId,
		recipientCount: Schema.Number,
		recipients: Schema.Array(
			Schema.Struct({
				displayName: Schema.String,
				fingerprint: Schema.String,
				handle: Schema.String,
				isMe: Schema.Boolean,
				isStaleSelf: Schema.Boolean,
				localAlias: Schema.OptionFromNullOr(Schema.String),
			}),
		),
		secretCount: Schema.Number,
		version: Schema.Literal(1),
	},
) {}
