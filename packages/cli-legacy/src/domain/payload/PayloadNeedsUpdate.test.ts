import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { HomeState } from "../home/HomeState.js";
import { emptyHomeState } from "../home/HomeState.js";
import { DisplayName } from "../identity/DisplayName.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadEnvelope } from "./PayloadEnvelope.js";
import { getPayloadNeedsUpdate } from "./PayloadNeedsUpdate.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_0123456789abcdef",
);
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1currentkey");

const makeHomeState = (): HomeState => ({
	...emptyHomeState(),
	activeKeyFingerprint: Option.some(selfFingerprint),
	self: Option.some({
		createdAt: "2026-04-14T10:00:00.000Z",
		keyMode: "pq-hybrid",
		privateKeyPath: selfPrivateKeyPath,
		publicIdentity: {
			displayName: selfDisplayName,
			identityUpdatedAt: selfIdentityUpdatedAt,
			ownerId: selfOwnerId,
			publicKey: selfPublicKey,
		},
	}),
});

describe("PayloadNeedsUpdate", () => {
	it("returns no when self recipient matches current local self identity", () => {
		const envelope = Schema.decodeUnknownSync(PayloadEnvelope)({
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_0123456789abcdef",
			recipients: [
				{
					displayName: selfDisplayName,
					identityUpdatedAt: selfIdentityUpdatedAt,
					ownerId: selfOwnerId,
					publicKey: selfPublicKey,
				},
			],
			version: 2,
		});

		expect(getPayloadNeedsUpdate(makeHomeState(), envelope)).toEqual({
			isRequired: false,
			reason: Option.none(),
		});
	});

	it("returns yes when self recipient is stale", () => {
		const envelope = Schema.decodeUnknownSync(PayloadEnvelope)({
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_0123456789abcdef",
			recipients: [
				{
					displayName: selfDisplayName,
					identityUpdatedAt: selfIdentityUpdatedAt,
					ownerId: selfOwnerId,
					publicKey: "age1stale",
				},
			],
			version: 2,
		});

		expect(getPayloadNeedsUpdate(makeHomeState(), envelope)).toEqual({
			isRequired: true,
			reason: Option.some("self key is stale"),
		});
	});

	it("returns schema-outdated when persisted schema version is older than runtime", () => {
		const envelope = Schema.decodeUnknownSync(PayloadEnvelope)({
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_0123456789abcdef",
			recipients: [
				{
					displayName: selfDisplayName,
					identityUpdatedAt: selfIdentityUpdatedAt,
					ownerId: selfOwnerId,
					publicKey: selfPublicKey,
				},
			],
			version: 2,
		});

		expect(
			getPayloadNeedsUpdate(makeHomeState(), envelope, {
				persistedSchemaVersion: 1,
			}),
		).toEqual({
			isRequired: true,
			reason: Option.some("payload schema is outdated"),
		});
	});
});
