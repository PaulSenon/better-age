import { Schema } from "effect";

export class IdentityGenerationError extends Schema.TaggedError<IdentityGenerationError>()(
	"IdentityGenerationError",
	{
		message: Schema.String,
	},
) {}

export class PrivateKeyEncryptionError extends Schema.TaggedError<PrivateKeyEncryptionError>()(
	"PrivateKeyEncryptionError",
	{
		message: Schema.String,
	},
) {}

export class PrivateKeyDecryptionError extends Schema.TaggedError<PrivateKeyDecryptionError>()(
	"PrivateKeyDecryptionError",
	{
		message: Schema.String,
	},
) {}
