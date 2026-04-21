import { Schema } from "effect";

export class EditorUnavailableError extends Schema.TaggedError<EditorUnavailableError>()(
	"EditorUnavailableError",
	{
		message: Schema.String,
	},
) {}

export class EditorLaunchError extends Schema.TaggedError<EditorLaunchError>()(
	"EditorLaunchError",
	{
		message: Schema.String,
	},
) {}

export class EditorExitError extends Schema.TaggedError<EditorExitError>()(
	"EditorExitError",
	{
		message: Schema.String,
	},
) {}
