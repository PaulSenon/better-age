import { Schema } from "effect";
import { PayloadId } from "../../domain/payload/PayloadId.js";

export class CreatePayloadNotSetUpError extends Schema.TaggedError<CreatePayloadNotSetUpError>()(
	"CreatePayloadNotSetUpError",
	{
		message: Schema.String,
	},
) {}

export class CreatePayloadPersistenceError extends Schema.TaggedError<CreatePayloadPersistenceError>()(
	"CreatePayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class CreatePayloadCryptoError extends Schema.TaggedError<CreatePayloadCryptoError>()(
	"CreatePayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class CreatePayloadSuccess extends Schema.TaggedClass<CreatePayloadSuccess>()(
	"CreatePayloadSuccess",
	{
		path: Schema.String,
		payloadId: PayloadId,
	},
) {}
