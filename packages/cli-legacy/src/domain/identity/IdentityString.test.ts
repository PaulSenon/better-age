import { describe, expect, it } from "@effect/vitest";
import { Either, Encoding, Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import {
	decodeIdentityString,
	encodeIdentityString,
	IdentityStringDecodeError,
	IdentityStringPayload,
	normalizeIdentityStringPayloadToCurrent,
	toIdentityStringPayload,
	toPublicIdentityFromIdentityStringPayload,
} from "./IdentityString.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { OwnerId } from "./OwnerId.js";
import { PublicIdentity } from "./PublicIdentity.js";
import { PublicKey } from "./PublicKey.js";

const publicIdentity = Schema.decodeUnknownSync(PublicIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
});

describe("IdentityString", () => {
	it("round-trips canonical public identity through identity-string payload", () => {
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

	it("classifies current identity-string payload through shared migration contract", () => {
		const payload = Schema.decodeUnknownSync(IdentityStringPayload)(
			toIdentityStringPayload(publicIdentity),
		);

		expect(normalizeIdentityStringPayloadToCurrent({ payload })).toEqual({
			_tag: "current",
			artifact: payload,
			artifactId: "identity-string",
			version: 1,
		});
	});

	it("rejects newer identity-string payload versions with update-cli remediation", () => {
		const futurePayload = {
			...publicIdentity,
			version: "v2",
		};
		const identityString = `better-age://identity/v2/${Encoding.encodeBase64Url(
			JSON.stringify(futurePayload),
		)}`;

		const decoded = decodeIdentityString(identityString);

		expect(Either.isLeft(decoded)).toBe(true);
		if (Either.isLeft(decoded)) {
			expect(decoded.left).toBeInstanceOf(IdentityStringDecodeError);
			expect(decoded.left.message).toContain("Update CLI");
		}
	});

	it("rejects prefix and payload version mismatches", () => {
		const mismatchedPayload = {
			...publicIdentity,
			version: "v1",
		};
		const identityString = `better-age://identity/v2/${Encoding.encodeBase64Url(
			JSON.stringify(mismatchedPayload),
		)}`;

		const decoded = decodeIdentityString(identityString);

		expect(Either.isLeft(decoded)).toBe(true);
		if (Either.isLeft(decoded)) {
			expect(decoded.left).toBeInstanceOf(IdentityStringDecodeError);
			expect(decoded.left.message).toContain("does not match");
		}
	});
});
