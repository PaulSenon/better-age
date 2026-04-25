import { Schema } from "effect";

export class HomeStatePreflightUnsupportedVersionError extends Schema.TaggedError<HomeStatePreflightUnsupportedVersionError>()(
	"HomeStatePreflightUnsupportedVersionError",
	{
		currentVersion: Schema.Number,
		homeVersion: Schema.Number,
		message: Schema.String,
	},
) {}

export class HomeStatePreflightMissingPathError extends Schema.TaggedError<HomeStatePreflightMissingPathError>()(
	"HomeStatePreflightMissingPathError",
	{
		currentVersion: Schema.Number,
		homeVersion: Schema.Number,
		message: Schema.String,
		missingFromVersion: Schema.Number,
		missingToVersion: Schema.Number,
	},
) {}
