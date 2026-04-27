import { Schema } from "effect";

export class BetterAgeConfigError extends Schema.TaggedError<BetterAgeConfigError>()(
	"BetterAgeConfigError",
	{
		key: Schema.String,
		message: Schema.String,
	},
) {}
