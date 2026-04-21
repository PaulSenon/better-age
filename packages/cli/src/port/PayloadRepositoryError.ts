import { Schema } from "effect";

export class PayloadReadError extends Schema.TaggedError<PayloadReadError>()(
	"PayloadReadError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

export class PayloadWriteError extends Schema.TaggedError<PayloadWriteError>()(
	"PayloadWriteError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}
