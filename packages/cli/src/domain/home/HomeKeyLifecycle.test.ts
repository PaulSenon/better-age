import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { GeneratedIdentity } from "../../port/Crypto.js";
import { DisplayName } from "../identity/DisplayName.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../identity/PublicKey.js";
import { derivePublicIdentityFingerprint } from "../identity/PublicIdentity.js";
import {
	buildRotatedHomeState,
	toRetiredPrivateKeyPath,
} from "./HomeKeyLifecycle.js";
import { emptyHomeState } from "./HomeState.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const rotatedIdentity = Schema.decodeUnknownSync(GeneratedIdentity)({
	encryptedSecretKey: "NEW-ENCRYPTED-KEY",
	fingerprint: "bs1_2222222222222222",
	identityUpdatedAt: "2026-04-15T10:00:00.000Z",
	keyMode: "pq-hybrid",
	ownerId: "bsid1_069f7576d2ab43ef",
	publicKey: "age1rotated",
});

describe("HomeKeyLifecycle", () => {
	it("builds rotated state preserving owner id and retiring prior key", () => {
		const nextState = buildRotatedHomeState({
			now: "2026-04-15T10:30:00.000Z",
			previousState: {
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
			},
			privateKeyPath: selfPrivateKeyPath,
			rotatedIdentity,
		});

		expect(nextState.activeKeyFingerprint).toEqual(
			Option.some(rotatedIdentity.fingerprint),
		);
		expect(nextState.self).toEqual(
			Option.some({
				createdAt: "2026-04-14T10:00:00.000Z",
				keyMode: "pq-hybrid",
				privateKeyPath: selfPrivateKeyPath,
				publicIdentity: {
					displayName: selfDisplayName,
					identityUpdatedAt: rotatedIdentity.identityUpdatedAt,
					ownerId: selfOwnerId,
					publicKey: rotatedIdentity.publicKey,
				},
			}),
		);
		expect(nextState.retiredKeys).toEqual([
			{
				fingerprint: derivePublicIdentityFingerprint({
					displayName: selfDisplayName,
					identityUpdatedAt: selfIdentityUpdatedAt,
					ownerId: selfOwnerId,
					publicKey: selfPublicKey,
				}),
				privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
					"keys/retired/bs1_3bfa41d75f2637e0.key.age",
				),
				retiredAt: "2026-04-15T10:30:00.000Z",
			},
		]);
	});

	it("derives retired key paths under retired key directory", () => {
		expect(toRetiredPrivateKeyPath("bs1_1111111111111111")).toBe(
			"keys/retired/bs1_1111111111111111.key.age",
		);
	});
});
