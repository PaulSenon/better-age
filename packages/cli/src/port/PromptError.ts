import { Schema } from "effect";

export class PromptUnavailableError extends Schema.TaggedError<PromptUnavailableError>()(
	"PromptUnavailableError",
	{
		field: Schema.String,
		message: Schema.String,
	},
) {}

export class PromptReadAbortedError extends Schema.TaggedError<PromptReadAbortedError>()(
	"PromptReadAbortedError",
	{
		message: Schema.String,
		prompt: Schema.String,
	},
) {}
