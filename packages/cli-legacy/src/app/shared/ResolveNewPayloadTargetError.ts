import { Schema } from "effect";

export class ResolveNewPayloadTargetError extends Schema.TaggedError<ResolveNewPayloadTargetError>()(
	"ResolveNewPayloadTargetError",
	{
		message: Schema.String,
	},
) {}
