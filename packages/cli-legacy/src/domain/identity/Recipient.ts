import { Schema } from "effect";

export const Recipient = Schema.String.pipe(
	Schema.pattern(/^age1[0-9a-z]+$/),
	Schema.brand("@better-age/Recipient"),
);

export type Recipient = Schema.Schema.Type<typeof Recipient>;
