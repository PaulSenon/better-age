import { describe, expect, it } from "@effect/vitest";
import { Either, Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import {
	decodeIdentityString,
	encodeIdentityString,
	IdentityStringPayload,
	toIdentityStringPayload,
	toPublicIdentityFromIdentityStringPayload,
} from "./IdentityString.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { OwnerId } from "./OwnerId.js";
import { PublicIdentity } from "./PublicIdentity.js";
import { PublicKey } from "./PublicKey.js";

describe("IdentityString", () => {
	it("round-trips canonical public identity through identity-string payload", () => {
		const publicIdentity = Schema.decodeUnknownSync(PublicIdentity)({
			displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T10:00:00.000Z",
			),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
		});
		const payload = Schema.decodeUnknownSync(IdentityStringPayload)(
			toIdentityStringPayload(publicIdentity),
		);

		const identityString = encodeIdentityString(payload);

		expect(identityString.startsWith("better-age://identity/v1/")).toBe(true);

		const decoded = decodeIdentityString(identityString);

		expect(Either.isRight(decoded)).toBe(true);
		if (Either.isRight(decoded)) {
			expect(decoded.right).toEqual(payload);
			expect(toPublicIdentityFromIdentityStringPayload(decoded.right)).toEqual(
				publicIdentity,
			);
		}
	});
});
