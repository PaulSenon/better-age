import { Schema } from "effect";

export class ResolvePayloadTargetError extends Schema.TaggedError<ResolvePayloadTargetError>()(
	"ResolvePayloadTargetError",
	{
		message: Schema.String,
	},
) {}
