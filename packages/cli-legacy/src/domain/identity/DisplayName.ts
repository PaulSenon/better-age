import { Schema } from "effect";

const DISPLAY_NAME_PATTERN =
	/^[a-zA-Z0-9](?:[a-zA-Z0-9._@-]{0,62}[a-zA-Z0-9])?$/;

export const DisplayName = Schema.NonEmptyTrimmedString.pipe(
	Schema.minLength(3),
	Schema.maxLength(64),
	Schema.pattern(DISPLAY_NAME_PATTERN),
	Schema.brand("@better-age/DisplayName"),
);

export type DisplayName = Schema.Schema.Type<typeof DisplayName>;

export const decodeDisplayName = (rawDisplayName: string) =>
	Schema.decodeUnknown(DisplayName)(rawDisplayName.trim());
