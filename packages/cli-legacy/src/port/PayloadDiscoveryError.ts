import { Schema } from "effect";

export class PayloadDiscoveryError extends Schema.TaggedError<PayloadDiscoveryError>()(
	"PayloadDiscoveryError",
	{
		message: Schema.String,
	},
) {}
