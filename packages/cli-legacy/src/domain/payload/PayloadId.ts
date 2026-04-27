import { Schema } from "effect";

export const PayloadId = Schema.NonEmptyTrimmedString.pipe(
	Schema.pattern(/^bspld_[a-f0-9]{16}$/),
	Schema.brand("@better-age/PayloadId"),
);

export type PayloadId = Schema.Schema.Type<typeof PayloadId>;
