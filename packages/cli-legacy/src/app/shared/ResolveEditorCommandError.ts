import { Schema } from "effect";

export class ResolveEditorCommandPersistenceError extends Schema.TaggedError<ResolveEditorCommandPersistenceError>()(
	"ResolveEditorCommandPersistenceError",
	{
		message: Schema.String,
	},
) {}

export class ResolveEditorCommandUnavailableError extends Schema.TaggedError<ResolveEditorCommandUnavailableError>()(
	"ResolveEditorCommandUnavailableError",
	{
		message: Schema.String,
	},
) {}
