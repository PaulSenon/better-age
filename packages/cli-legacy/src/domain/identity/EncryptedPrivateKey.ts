import { Schema } from "effect";

export const EncryptedPrivateKey = Schema.String.pipe(
	Schema.minLength(1),
	Schema.brand("@better-age/EncryptedPrivateKey"),
);

export type EncryptedPrivateKey = Schema.Schema.Type<
	typeof EncryptedPrivateKey
>;
