import { Schema } from "effect";

export const IdentityUpdatedAt = Schema.String.pipe(
	Schema.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
	Schema.brand("@better-age/IdentityUpdatedAt"),
);

export type IdentityUpdatedAt = Schema.Schema.Type<typeof IdentityUpdatedAt>;
