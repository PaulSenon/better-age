import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PayloadRecipient } from "../payload/PayloadEnvelope.js";
import { DisplayName } from "./DisplayName.js";
import { Handle } from "./Handle.js";
import { KnownIdentity, SelfIdentity } from "./Identity.js";
import { IdentityAlias } from "./IdentityAlias.js";
import { encodeIdentityString } from "./IdentityString.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PrivateKeyRelativePath } from "./PrivateKeyRelativePath.js";
import { PublicKey } from "./PublicKey.js";
import {
	resolveGrantIdentityRef,
	resolveRevokeIdentityRef,
} from "./ResolveIdentityRef.js";

const self = Schema.decodeUnknownSync(SelfIdentity)({
	createdAt: "2026-04-14T10:00:00.000Z",
	displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_1111111111111111"),
	handle: Schema.decodeUnknownSync(Handle)("isaac#069f7576"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	keyMode: "pq-hybrid",
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
	privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
		"keys/active.key.age",
	),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
});

const paul = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_aaaaaaaaaaaaaaaa"),
	handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	localAlias: Schema.decodeUnknownSync(IdentityAlias)("ops-paul"),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
});

const paulTwo = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_bbbbbbbbbbbbbbbb"),
	handle: Schema.decodeUnknownSync(Handle)("paul#bbbbbbbb"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T11:00:00.000Z",
	),
	localAlias: null,
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_bbbbbbbbbbbbbbbb"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paultwo"),
});

const toRecipient = (identity: typeof paul) =>
	Schema.decodeUnknownSync(PayloadRecipient)({
		displayNameSnapshot: identity.displayName,
		fingerprint: identity.fingerprint,
		identityUpdatedAt: identity.identityUpdatedAt,
		ownerId: identity.ownerId,
		publicKey: identity.publicKey,
	});

describe("ResolveIdentityRef", () => {
	it("grant resolves exact local alias first", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "ops-paul",
			knownIdentities: [paul],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "resolved",
			identity: paul,
		});
	});

	it("grant resolves exact handle", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "isaac#069f7576",
			knownIdentities: [paul],
			selfIdentity: Option.some(self),
		});

		expect(result._tag).toBe("resolved");
		if (result._tag === "resolved") {
			expect(result.identity.ownerId).toBe(self.ownerId);
		}
	});

	it("grant resolves unique display name", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "isaac",
			knownIdentities: [paul],
			selfIdentity: Option.some(self),
		});

		expect(result._tag).toBe("resolved");
		if (result._tag === "resolved") {
			expect(result.identity.handle).toBe(self.handle);
		}
	});

	it("grant returns ambiguous on duplicate display name", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "paul",
			knownIdentities: [paul, paulTwo],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "ambiguous",
			candidates: [paul.handle, paulTwo.handle],
		});
	});

	it("grant resolves full Identity String directly", () => {
		const identityString = encodeIdentityString({
			displayName: paul.displayName,
			fingerprint: paul.fingerprint,
			handle: paul.handle,
			identityUpdatedAt: paul.identityUpdatedAt,
			ownerId: paul.ownerId,
			publicKey: paul.publicKey,
			version: "v1",
		});
		const result = resolveGrantIdentityRef({
			identityRef: identityString,
			knownIdentities: [],
			selfIdentity: Option.none(),
		});

		expect(result).toEqual({
			_tag: "resolved",
			identity: {
				...paul,
				localAlias: Option.none(),
			},
		});
	});

	it("revoke resolves local alias only when owner is present in payload", () => {
		const result = resolveRevokeIdentityRef({
			identityRef: "ops-paul",
			knownIdentities: [paul],
			payloadRecipients: [toRecipient(self as never), toRecipient(paul)],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "resolved",
			ownerId: paul.ownerId,
		});
	});

	it("revoke returns not-found when alias resolves to owner absent from payload", () => {
		const result = resolveRevokeIdentityRef({
			identityRef: "ops-paul",
			knownIdentities: [paul],
			payloadRecipients: [toRecipient(self as never)],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "not-found",
		});
	});

	it("revoke returns ambiguous on duplicate display name among payload recipients", () => {
		const result = resolveRevokeIdentityRef({
			identityRef: "paul",
			knownIdentities: [paul, paulTwo],
			payloadRecipients: [toRecipient(paul), toRecipient(paulTwo)],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "ambiguous",
			candidates: [paul.handle, paulTwo.handle],
		});
	});
});
