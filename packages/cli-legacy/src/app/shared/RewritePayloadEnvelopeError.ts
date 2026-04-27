import { Schema } from "effect";

export class RewritePayloadEnvelopePersistenceError extends Schema.TaggedError<RewritePayloadEnvelopePersistenceError>()(
	"RewritePayloadEnvelopePersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class RewritePayloadEnvelopeCryptoError extends Schema.TaggedError<RewritePayloadEnvelopeCryptoError>()(
	"RewritePayloadEnvelopeCryptoError",
	{
		message: Schema.String,
	},
) {}
