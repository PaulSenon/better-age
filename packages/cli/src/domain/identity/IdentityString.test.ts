import { describe, expect, it } from "@effect/vitest";
import { Either, Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { Handle } from "./Handle.js";
import {
	decodeIdentityString,
	encodeIdentityString,
	IdentityStringPayload,
} from "./IdentityString.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PublicKey } from "./PublicKey.js";

describe("IdentityString", () => {
	it("round-trips the canonical shared identity payload", () => {
		const payload = Schema.decodeUnknownSync(IdentityStringPayload)({
			displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
			fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
				"bs1_0123456789abcdef",
			),
			handle: Schema.decodeUnknownSync(Handle)("isaac-mbp#069f7576"),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T10:00:00.000Z",
			),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
			version: "v1",
		});

		const identityString = encodeIdentityString(payload);

		expect(identityString.startsWith("better-age://identity/v1/")).toBe(true);

		const decoded = decodeIdentityString(identityString);

		expect(Either.isRight(decoded)).toBe(true);
		if (Either.isRight(decoded)) {
			expect(decoded.right).toEqual(payload);
		}
	});
});
