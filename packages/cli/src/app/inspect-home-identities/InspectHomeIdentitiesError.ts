import { Schema } from "effect";

export class InspectHomeIdentitiesPersistenceError extends Schema.TaggedError<InspectHomeIdentitiesPersistenceError>()(
	"InspectHomeIdentitiesPersistenceError",
	{
		message: Schema.String,
	},
) {}
