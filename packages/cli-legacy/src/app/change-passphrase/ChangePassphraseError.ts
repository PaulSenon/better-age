import { Schema } from "effect";

export class ChangePassphraseCryptoError extends Schema.TaggedError<ChangePassphraseCryptoError>()(
	"ChangePassphraseCryptoError",
	{
		message: Schema.String,
	},
) {}

export class ChangePassphrasePersistenceError extends Schema.TaggedError<ChangePassphrasePersistenceError>()(
	"ChangePassphrasePersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class ChangePassphraseNoActiveIdentityError extends Schema.TaggedError<ChangePassphraseNoActiveIdentityError>()(
	"ChangePassphraseNoActiveIdentityError",
	{
		message: Schema.String,
	},
) {}

export class ChangePassphraseSuccess extends Schema.TaggedClass<ChangePassphraseSuccess>()(
	"ChangePassphraseSuccess",
	{},
) {}
