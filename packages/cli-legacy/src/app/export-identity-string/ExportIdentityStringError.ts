import { Schema } from "effect";

export class ExportIdentityStringPersistenceError extends Schema.TaggedError<ExportIdentityStringPersistenceError>()(
	"ExportIdentityStringPersistenceError",
	{
		message: Schema.String,
	},
) {}

export class ExportIdentityStringNotSetUpError extends Schema.TaggedError<ExportIdentityStringNotSetUpError>()(
	"ExportIdentityStringNotSetUpError",
	{
		message: Schema.String,
	},
) {}
