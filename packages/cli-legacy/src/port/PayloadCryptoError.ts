import { Schema } from "effect";

export class PayloadDecryptError extends Schema.TaggedError<PayloadDecryptError>()(
	"PayloadDecryptError",
	{
		message: Schema.String,
	},
) {}

export class PayloadEncryptError extends Schema.TaggedError<PayloadEncryptError>()(
	"PayloadEncryptError",
	{
		message: Schema.String,
	},
) {}
