import { Schema } from "effect";

export class UpdatePayloadPersistenceError extends Schema.TaggedError<UpdatePayloadPersistenceError>()(
	"UpdatePayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class UpdatePayloadFileFormatError extends Schema.TaggedError<UpdatePayloadFileFormatError>()(
	"UpdatePayloadFileFormatError",
	{
		message: Schema.String,
	},
) {}

export class UpdatePayloadCryptoError extends Schema.TaggedError<UpdatePayloadCryptoError>()(
	"UpdatePayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class UpdatePayloadEnvelopeError extends Schema.TaggedError<UpdatePayloadEnvelopeError>()(
	"UpdatePayloadEnvelopeError",
	{
		message: Schema.String,
	},
) {}

export class UpdatePayloadEnvError extends Schema.TaggedError<UpdatePayloadEnvError>()(
	"UpdatePayloadEnvError",
	{
		message: Schema.String,
	},
) {}

export class UpdatePayloadNoSelfIdentityError extends Schema.TaggedError<UpdatePayloadNoSelfIdentityError>()(
	"UpdatePayloadNoSelfIdentityError",
	{
		message: Schema.String,
	},
) {}

export class UpdatePayloadUnchangedSuccess extends Schema.TaggedClass<UpdatePayloadUnchangedSuccess>()(
	"UpdatePayloadUnchangedSuccess",
	{
		path: Schema.String,
		reasons: Schema.Array(Schema.String),
	},
) {}

export class UpdatePayloadUpdatedSuccess extends Schema.TaggedClass<UpdatePayloadUpdatedSuccess>()(
	"UpdatePayloadUpdatedSuccess",
	{
		path: Schema.String,
		payloadId: Schema.String,
		reasons: Schema.Array(Schema.String),
	},
) {}
