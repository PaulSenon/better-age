import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PayloadRecipient } from "../payload/PayloadEnvelope.js";
import { DisplayName } from "./DisplayName.js";
import { IdentityAlias } from "./IdentityAlias.js";
import {
	KnownIdentity,
	SelfIdentity,
	toPublicIdentityFromSelfIdentity,
} from "./Identity.js";
import { encodeIdentityString, toIdentityStringPayload } from "./IdentityString.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { OwnerId } from "./OwnerId.js";
import { PrivateKeyRelativePath } from "./PrivateKeyRelativePath.js";
import { PublicKey } from "./PublicKey.js";
import {
	derivePublicIdentityFingerprint,
	derivePublicIdentityHandle,
} from "./PublicIdentity.js";
import {
	resolveGrantIdentityRef,
	resolveRevokeIdentityRef,
} from "./ResolveIdentityRef.js";

const self = Schema.decodeUnknownSync(SelfIdentity)({
	createdAt: "2026-04-14T10:00:00.000Z",
	keyMode: "pq-hybrid",
	privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
		"keys/active.key.age",
	),
	publicIdentity: {
		displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
		identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
			"2026-04-14T10:00:00.000Z",
		),
		ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
		publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
	},
});

const paul = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
});

const paulTwo = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T11:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_bbbbbbbbbbbbbbbb"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paultwo"),
});

const toRecipient = (identity: typeof paul) =>
	Schema.decodeUnknownSync(PayloadRecipient)({
		displayName: identity.displayName,
		identityUpdatedAt: identity.identityUpdatedAt,
		ownerId: identity.ownerId,
		publicKey: identity.publicKey,
	});

const selfRecipient = Schema.decodeUnknownSync(PayloadRecipient)(
	toPublicIdentityFromSelfIdentity(self),
);

describe("ResolveIdentityRef", () => {
	it("grant resolves exact local alias first", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "ops-paul",
			knownIdentities: [paul],
			localAliases: {
				[paul.ownerId]: Schema.decodeUnknownSync(IdentityAlias)("ops-paul"),
			},
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "resolved",
			identity: {
				...paul,
				fingerprint: derivePublicIdentityFingerprint(paul),
				handle: derivePublicIdentityHandle(paul),
				localAlias: Option.some(
					Schema.decodeUnknownSync(IdentityAlias)("ops-paul"),
				),
			},
		});
	});

	it("grant resolves exact handle", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "isaac#069f7576",
			knownIdentities: [paul],
			localAliases: {},
			selfIdentity: Option.some(self),
		});

		expect(result._tag).toBe("resolved");
		if (result._tag === "resolved") {
			expect(result.identity.ownerId).toBe(self.publicIdentity.ownerId);
		}
	});

	it("grant resolves unique display name", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "isaac",
			knownIdentities: [paul],
			localAliases: {},
			selfIdentity: Option.some(self),
		});

		expect(result._tag).toBe("resolved");
		if (result._tag === "resolved") {
			expect(result.identity.handle).toBe(
				derivePublicIdentityHandle(self.publicIdentity),
			);
		}
	});

	it("grant returns ambiguous on duplicate display name", () => {
		const result = resolveGrantIdentityRef({
			identityRef: "paul",
			knownIdentities: [paul, paulTwo],
			localAliases: {},
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "ambiguous",
			candidates: [
				derivePublicIdentityHandle(paul),
				derivePublicIdentityHandle(paulTwo),
			],
		});
	});

	it("grant resolves full Identity String directly", () => {
		const identityString = encodeIdentityString(
			toIdentityStringPayload({
				displayName: paul.displayName,
				identityUpdatedAt: paul.identityUpdatedAt,
				ownerId: paul.ownerId,
				publicKey: paul.publicKey,
			}),
		);
		const result = resolveGrantIdentityRef({
			identityRef: identityString,
			knownIdentities: [],
			localAliases: {},
			selfIdentity: Option.none(),
		});

		expect(result).toEqual({
			_tag: "resolved",
			identity: {
				...paul,
				handle: derivePublicIdentityHandle(paul),
				fingerprint: derivePublicIdentityFingerprint({
					displayName: paul.displayName,
					identityUpdatedAt: paul.identityUpdatedAt,
					ownerId: paul.ownerId,
					publicKey: paul.publicKey,
				}),
				localAlias: Option.none(),
			},
		});
	});

	it("revoke resolves local alias only when owner is present in payload", () => {
		const result = resolveRevokeIdentityRef({
			identityRef: "ops-paul",
			knownIdentities: [paul],
			localAliases: {
				[paul.ownerId]: Schema.decodeUnknownSync(IdentityAlias)("ops-paul"),
			},
			payloadRecipients: [selfRecipient, toRecipient(paul)],
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
			localAliases: {
				[paul.ownerId]: Schema.decodeUnknownSync(IdentityAlias)("ops-paul"),
			},
			payloadRecipients: [selfRecipient],
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
			localAliases: {},
			payloadRecipients: [toRecipient(paul), toRecipient(paulTwo)],
			selfIdentity: Option.some(self),
		});

		expect(result).toEqual({
			_tag: "ambiguous",
			candidates: [
				derivePublicIdentityHandle(paul),
				derivePublicIdentityHandle(paulTwo),
			],
		});
	});
});
