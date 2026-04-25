import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { emptyHomeState } from "../home/HomeState.js";
import { DisplayName } from "../identity/DisplayName.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadEnvelope } from "./PayloadEnvelope.js";
import { computePayloadUpdateState } from "./PayloadUpdateState.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const staleSelfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1stale");
const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T11:00:00.000Z",
);
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa");
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paul");

const expectValue = <A>(value: A | undefined): A => {
	if (value === undefined) {
		throw new Error("Expected test value to be present");
	}

	return value;
};

const state = {
	...emptyHomeState(),
	self: Option.some({
		createdAt: "2026-04-14T10:00:00.000Z",
		keyMode: "pq-hybrid" as const,
		privateKeyPath: selfPrivateKeyPath,
		publicIdentity: {
			displayName: selfDisplayName,
			identityUpdatedAt: selfIdentityUpdatedAt,
			ownerId: selfOwnerId,
			publicKey: selfPublicKey,
		},
	}),
};

const currentEnvelope = Schema.decodeUnknownSync(PayloadEnvelope)({
	createdAt: "2026-04-14T10:00:00.000Z",
	envText: "API_TOKEN=secret\n",
	lastRewrittenAt: "2026-04-14T10:00:00.000Z",
	payloadId: "bspld_0123456789abcdef",
	recipients: [
		{
			displayName: selfDisplayName,
			identityUpdatedAt: selfIdentityUpdatedAt,
			ownerId: selfOwnerId,
			publicKey: selfPublicKey,
		},
		{
			displayName: paulDisplayName,
			identityUpdatedAt: paulIdentityUpdatedAt,
			ownerId: paulOwnerId,
			publicKey: paulPublicKey,
		},
	],
	version: 2,
});
const currentSelfRecipient = expectValue(currentEnvelope.recipients[0]);
const currentPaulRecipient = expectValue(currentEnvelope.recipients[1]);

describe("computePayloadUpdateState", () => {
	it("returns no update when self snapshot is current", () => {
		expect(computePayloadUpdateState(state, currentEnvelope)).toEqual({
			isRequired: false,
			reasons: [],
		});
	});

	it("requires update when self snapshot is stale", () => {
		expect(
			computePayloadUpdateState(state, {
				...currentEnvelope,
				recipients: [
					{
						...currentSelfRecipient,
						publicKey: staleSelfPublicKey,
					},
					currentPaulRecipient,
				],
			}),
		).toEqual({
			isRequired: true,
			reasons: ["self-stale"],
		});
	});

	it("requires update when duplicate self recipient exists", () => {
		expect(
			computePayloadUpdateState(state, {
				...currentEnvelope,
				recipients: [
					currentSelfRecipient,
					{
						...currentSelfRecipient,
						publicKey: staleSelfPublicKey,
					},
					currentPaulRecipient,
				],
			}),
		).toEqual({
			isRequired: true,
			reasons: ["duplicate-self-recipient", "self-stale"],
		});
	});

	it("ignores stale non-self snapshots", () => {
		expect(
			computePayloadUpdateState(state, {
				...currentEnvelope,
				recipients: [
					currentSelfRecipient,
					{
						...currentPaulRecipient,
						publicKey: staleSelfPublicKey,
					},
				],
			}),
		).toEqual({
			isRequired: false,
			reasons: [],
		});
	});

	it("requires update when persisted schema version is outdated even if normalized envelope is current", () => {
		expect(
			computePayloadUpdateState(state, currentEnvelope, {
				persistedSchemaVersion: 1,
			}),
		).toEqual({
			isRequired: true,
			reasons: ["schema-outdated"],
		});
	});
});
