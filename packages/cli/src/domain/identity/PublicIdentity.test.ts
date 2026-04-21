import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
	PublicIdentity,
} from "./PublicIdentity.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PublicKey } from "./PublicKey.js";

describe("PublicIdentity", () => {
	it("builds one canonical public identity and derives handle and fingerprint", () => {
		const identity = Schema.decodeUnknownSync(PublicIdentity)({
			displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T10:00:00.000Z",
			),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
		});

		expect(derivePublicIdentityHandle(identity)).toBe("isaac-mbp#069f7576");
		expect(derivePublicIdentityFingerprint(identity)).toBe(
			Schema.decodeUnknownSync(KeyFingerprint)("bs1_b00a4ee688018d90"),
		);
	});
});
