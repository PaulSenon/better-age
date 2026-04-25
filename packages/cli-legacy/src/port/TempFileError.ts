import { Schema } from "effect";

export class TempFileCreateError extends Schema.TaggedError<TempFileCreateError>()(
	"TempFileCreateError",
	{
		message: Schema.String,
	},
) {}

export class TempFileReadError extends Schema.TaggedError<TempFileReadError>()(
	"TempFileReadError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

export class TempFileDeleteError extends Schema.TaggedError<TempFileDeleteError>()(
	"TempFileDeleteError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}
