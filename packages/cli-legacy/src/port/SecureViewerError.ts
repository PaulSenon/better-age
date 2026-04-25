import { Schema } from "effect";

export class SecureViewerUnavailableError extends Schema.TaggedError<SecureViewerUnavailableError>()(
	"SecureViewerUnavailableError",
	{
		message: Schema.String,
	},
) {}

export class SecureViewerDisplayError extends Schema.TaggedError<SecureViewerDisplayError>()(
	"SecureViewerDisplayError",
	{
		message: Schema.String,
	},
) {}
