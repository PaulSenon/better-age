import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { emptyHomeState } from "../home/HomeState.js";
import { DisplayName } from "../identity/DisplayName.js";
import { Handle } from "../identity/Handle.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadEnvelope } from "./PayloadEnvelope.js";
import { computePayloadUpdateState } from "./PayloadUpdateState.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac#069f7576");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const staleSelfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_9999999999999999",
);
const staleSelfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1stale");
const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_aaaaaaaaaaaaaaaa",
);
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
		displayName: selfDisplayName,
		fingerprint: selfFingerprint,
		handle: selfHandle,
		identityUpdatedAt: selfIdentityUpdatedAt,
		keyMode: "pq-hybrid" as const,
		ownerId: selfOwnerId,
		privateKeyPath: selfPrivateKeyPath,
		publicKey: selfPublicKey,
	}),
};

const currentEnvelope = Schema.decodeUnknownSync(PayloadEnvelope)({
	createdAt: "2026-04-14T10:00:00.000Z",
	envText: "API_TOKEN=secret\n",
	lastRewrittenAt: "2026-04-14T10:00:00.000Z",
	payloadId: "bspld_0123456789abcdef",
	recipients: [
		{
			displayNameSnapshot: selfDisplayName,
			fingerprint: selfFingerprint,
			identityUpdatedAt: selfIdentityUpdatedAt,
			ownerId: selfOwnerId,
			publicKey: selfPublicKey,
		},
		{
			displayNameSnapshot: paulDisplayName,
			fingerprint: paulFingerprint,
			identityUpdatedAt: paulIdentityUpdatedAt,
			ownerId: paulOwnerId,
			publicKey: paulPublicKey,
		},
	],
	version: 1,
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
						fingerprint: staleSelfFingerprint,
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
						fingerprint: staleSelfFingerprint,
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
						fingerprint: staleSelfFingerprint,
						publicKey: staleSelfPublicKey,
					},
				],
			}),
		).toEqual({
			isRequired: false,
			reasons: [],
		});
	});
});
