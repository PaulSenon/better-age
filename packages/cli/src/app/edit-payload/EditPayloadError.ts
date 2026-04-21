import { Schema } from "effect";
import { PayloadId } from "../../domain/payload/PayloadId.js";

export class EditPayloadPersistenceError extends Schema.TaggedError<EditPayloadPersistenceError>()(
	"EditPayloadPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class EditPayloadCryptoError extends Schema.TaggedError<EditPayloadCryptoError>()(
	"EditPayloadCryptoError",
	{
		message: Schema.String,
	},
) {}

export class EditPayloadEnvError extends Schema.TaggedError<EditPayloadEnvError>()(
	"EditPayloadEnvError",
	{
		message: Schema.String,
	},
) {}

export class EditPayloadUpdateRequiredError extends Schema.TaggedError<EditPayloadUpdateRequiredError>()(
	"EditPayloadUpdateRequiredError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

export class EditPayloadOpenSuccess extends Schema.TaggedClass<EditPayloadOpenSuccess>()(
	"EditPayloadOpenSuccess",
	{
		envText: Schema.String,
		path: Schema.String,
	},
) {}

export class EditPayloadUnchangedSuccess extends Schema.TaggedClass<EditPayloadUnchangedSuccess>()(
	"EditPayloadUnchangedSuccess",
	{
		path: Schema.String,
	},
) {}

export class EditPayloadRewrittenSuccess extends Schema.TaggedClass<EditPayloadRewrittenSuccess>()(
	"EditPayloadRewrittenSuccess",
	{
		path: Schema.String,
		payloadId: PayloadId,
	},
) {}
