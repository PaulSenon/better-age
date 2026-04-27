import { Schema } from "effect";

export const OwnerId = Schema.NonEmptyTrimmedString.pipe(
	Schema.minLength(8),
	Schema.maxLength(64),
	Schema.pattern(/^[a-z0-9][a-z0-9_-]*$/),
	Schema.brand("@better-age/OwnerId"),
);

export type OwnerId = Schema.Schema.Type<typeof OwnerId>;
