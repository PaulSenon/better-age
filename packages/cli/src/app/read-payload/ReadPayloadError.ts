import { Schema } from "effect";

export class ReadPayloadPersistenceError extends Schema.TaggedError<ReadPayloadPersistenceError>()(
	"ReadPayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class ReadPayloadFileFormatError extends Schema.TaggedError<ReadPayloadFileFormatError>()(
	"ReadPayloadFileFormatError",
	{
		message: Schema.String,
	},
) {}

export class ReadPayloadCryptoError extends Schema.TaggedError<ReadPayloadCryptoError>()(
	"ReadPayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class ReadPayloadEnvelopeError extends Schema.TaggedError<ReadPayloadEnvelopeError>()(
	"ReadPayloadEnvelopeError",
	{
		message: Schema.String,
	},
) {}

export class ReadPayloadVersionError extends Schema.TaggedError<ReadPayloadVersionError>()(
	"ReadPayloadVersionError",
	{
		message: Schema.String,
	},
) {}

export class ReadPayloadEnvError extends Schema.TaggedError<ReadPayloadEnvError>()(
	"ReadPayloadEnvError",
	{
		message: Schema.String,
	},
) {}

export class ReadPayloadSuccess extends Schema.TaggedClass<ReadPayloadSuccess>()(
	"ReadPayloadSuccess",
	{
		envText: Schema.String,
		needsUpdate: Schema.Struct({
			isRequired: Schema.Boolean,
			reason: Schema.OptionFromNullOr(Schema.String),
		}),
		path: Schema.String,
	},
) {}
