import { Schema } from "effect";

export const PrivateKeyRelativePath = Schema.String.pipe(
	Schema.pattern(/^keys(?:\/[^/]+)+\.key\.age$/),
	Schema.brand("@better-age/PrivateKeyRelativePath"),
);

export type PrivateKeyRelativePath = Schema.Schema.Type<
	typeof PrivateKeyRelativePath
>;
