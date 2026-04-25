import { Schema } from "effect";

const IDENTITY_ALIAS_PATTERN =
	/^[a-zA-Z0-9](?:[a-zA-Z0-9._@-]{0,62}[a-zA-Z0-9])?$/;

export const IdentityAlias = Schema.NonEmptyTrimmedString.pipe(
	Schema.minLength(3),
	Schema.maxLength(64),
	Schema.pattern(IDENTITY_ALIAS_PATTERN),
	Schema.brand("@better-age/IdentityAlias"),
);

export type IdentityAlias = Schema.Schema.Type<typeof IdentityAlias>;

export const decodeIdentityAlias = (rawAlias: string) =>
	Schema.decodeUnknown(IdentityAlias)(rawAlias.trim());
