import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	emptyLocalAliasMap,
	materializeKnownIdentity,
	materializeSelfIdentity,
	SelfIdentity,
	setLocalAlias,
	toPublicIdentityFromSelfIdentity,
} from "./Identity.js";
import { IdentityAlias } from "./IdentityAlias.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { OwnerId } from "./OwnerId.js";
import { PublicIdentity } from "./PublicIdentity.js";
import { PublicKey } from "./PublicKey.js";

const ownerId = Schema.decodeUnknownSync(OwnerId)("ownerops1234");

const publicIdentity = Schema.decodeUnknownSync(PublicIdentity)({
	displayName: "Ops",
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2025-01-03T00:00:00.000Z",
	),
	ownerId,
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1opspublickey"),
});

describe("Identity", () => {
	it("materializes known identity aliases from the alias map only", () => {
		const legacyAnnotatedIdentity = {
			...publicIdentity,
			localAlias: Schema.decodeUnknownSync(IdentityAlias)("LegacyAlias"),
		};

		expect(
			materializeKnownIdentity({
				identity: legacyAnnotatedIdentity,
				localAliases: emptyLocalAliasMap(),
			}).localAlias,
		).toEqual(Option.none());

		expect(
			materializeKnownIdentity({
				identity: legacyAnnotatedIdentity,
				localAliases: setLocalAlias({
					localAlias: Option.some(
						Schema.decodeUnknownSync(IdentityAlias)("MappedAlias"),
					),
					localAliases: emptyLocalAliasMap(),
					ownerId,
				}),
			}).localAlias,
		).toEqual(
			Option.some(Schema.decodeUnknownSync(IdentityAlias)("MappedAlias")),
		);
	});

	it("derives self identity details from embedded public identity only", () => {
		const selfIdentity = Schema.decodeUnknownSync(SelfIdentity)({
			createdAt: "2025-01-01T00:00:00.000Z",
			keyMode: "pq-hybrid",
			privateKeyPath: "keys/active.key.age",
			publicIdentity,
		});

		expect(toPublicIdentityFromSelfIdentity(selfIdentity)).toEqual(
			publicIdentity,
		);
		expect(materializeSelfIdentity(selfIdentity).ownerId).toBe(ownerId);
	});
});
