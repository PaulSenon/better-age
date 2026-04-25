import { Schema } from "effect";

export class ResolveIdentityInputError extends Schema.TaggedError<ResolveIdentityInputError>()(
	"ResolveIdentityInputError",
	{
		message: Schema.String,
	},
) {}
