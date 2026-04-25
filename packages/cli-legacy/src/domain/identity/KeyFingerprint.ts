import { Schema } from "effect";

export const KeyFingerprint = Schema.String.pipe(
	Schema.pattern(/^bs1_[a-f0-9]{16}$/),
	Schema.brand("@better-age/KeyFingerprint"),
);

export type KeyFingerprint = Schema.Schema.Type<typeof KeyFingerprint>;
