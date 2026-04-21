import { Schema } from "effect";

export class OpenPayloadPersistenceError extends Schema.TaggedError<OpenPayloadPersistenceError>()(
	"OpenPayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class OpenPayloadFileFormatError extends Schema.TaggedError<OpenPayloadFileFormatError>()(
	"OpenPayloadFileFormatError",
	{
		message: Schema.String,
	},
) {}

export class OpenPayloadCryptoError extends Schema.TaggedError<OpenPayloadCryptoError>()(
	"OpenPayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class OpenPayloadEnvelopeError extends Schema.TaggedError<OpenPayloadEnvelopeError>()(
	"OpenPayloadEnvelopeError",
	{
		message: Schema.String,
	},
) {}

export class OpenPayloadVersionError extends Schema.TaggedError<OpenPayloadVersionError>()(
	"OpenPayloadVersionError",
	{
		message: Schema.String,
	},
) {}

export class OpenPayloadEnvError extends Schema.TaggedError<OpenPayloadEnvError>()(
	"OpenPayloadEnvError",
	{
		message: Schema.String,
	},
) {}
