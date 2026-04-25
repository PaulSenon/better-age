import { Schema } from "effect";

export const PublicKey = Schema.String.pipe(
	Schema.pattern(/^age1[0-9a-z]+$/),
	Schema.brand("@better-age/PublicKey"),
);

export type PublicKey = Schema.Schema.Type<typeof PublicKey>;
