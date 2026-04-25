import { Schema } from "effect";
import type { DisplayName } from "./DisplayName.js";
import type { OwnerId } from "./OwnerId.js";

export const Handle = Schema.NonEmptyTrimmedString.pipe(
	Schema.minLength(6),
	Schema.maxLength(96),
	Schema.pattern(/^[^#\s]+#[a-z0-9]{4,}$/),
	Schema.brand("@better-age/Handle"),
);

export type Handle = Schema.Schema.Type<typeof Handle>;

const ownerIdBody = (ownerId: OwnerId) => ownerId.slice("bsid1_".length);

const ownerIdPrefix = (ownerId: OwnerId) => ownerIdBody(ownerId).slice(0, 8);

export const toHandle = (input: {
	readonly displayName: DisplayName;
	readonly ownerId: OwnerId;
}): Handle =>
	Schema.decodeUnknownSync(Handle)(
		`${input.displayName}#${ownerIdPrefix(input.ownerId)}`,
	);
