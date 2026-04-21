import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema, TestClock } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { decodeIdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { InspectHomeIdentities } from "./InspectHomeIdentities.js";

const displayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
const handle = Schema.decodeUnknownSync(Handle)("isaac-mbp#069f7576");
const ownerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const fingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_0123456789abcdef",
);
const identityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2020-01-01T00:00:00.000Z",
);
const publicKey = Schema.decodeUnknownSync(PublicKey)("age1selfrecipient");
const privateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const knownDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const knownHandle = Schema.decodeUnknownSync(Handle)("paul#abcdef01");
const knownOwnerId = Schema.decodeUnknownSync(OwnerId)(
	"bsid1_abcdef0123456789",
);
const knownFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_abcdef0123456789",
);
const knownIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-02-01T00:00:00.000Z",
);
const knownPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paulrecipient");
const retiredFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_deadbeef01234567",
);
const retiredPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/retired-deadbeef.key.age",
);

describe("InspectHomeIdentities", () => {
	const homeRepositoryLayer = Layer.effect(
		HomeRepository,
		Effect.sync(() =>
			makeInMemoryHomeRepository({
				rootDirectory: "/virtual-home",
			}),
		),
	);

	layer(
		Layer.mergeAll(
			homeRepositoryLayer,
			Layer.provide(InspectHomeIdentities.Default, homeRepositoryLayer),
		),
	)("success", (it) => {
		it.effect("returns structured home inspection data", () =>
			Effect.gen(function* () {
				const homeRepository = yield* HomeRepository;
				const localAlias = yield* decodeIdentityAlias("paul-work");
				const state = yield* homeRepository.loadState;

				yield* homeRepository.saveState({
					...emptyHomeState(),
					activeKeyFingerprint: Option.some(fingerprint),
					knownIdentities: [
						{
							displayName: knownDisplayName,
							fingerprint: knownFingerprint,
							handle: knownHandle,
							identityUpdatedAt: knownIdentityUpdatedAt,
							localAlias: Option.some(localAlias),
							ownerId: knownOwnerId,
							publicKey: knownPublicKey,
						},
					],
					retiredKeys: [
						{
							fingerprint: retiredFingerprint,
							privateKeyPath: retiredPath,
							retiredAt: "2025-10-01T00:00:00.000Z",
						},
					],
					rotationTtl: "3m",
					self: Option.some({
						createdAt: "2025-12-15T00:00:00.000Z",
						displayName,
						fingerprint,
						handle,
						identityUpdatedAt,
						keyMode: "pq-hybrid",
						ownerId,
						privateKeyPath,
						publicKey,
					}),
				});
				yield* TestClock.setTime(
					new Date("2026-04-14T00:00:00.000Z").getTime(),
				);

				const result = yield* InspectHomeIdentities.execute;

				expect(result.me?._tag).toBe("Some");
				if (result.me?._tag === "Some") {
					expect(result.me.value.displayName).toBe(displayName);
					expect(result.me.value.handle).toBe(handle);
					expect(result.me.value.ownerId).toBe(ownerId);
					expect(result.me.value.fingerprint).toBe(fingerprint);
					expect(result.me.value.rotationTtl).toBe("3m");
					expect(result.me.value.rotationStatus).toEqual({
						dueAt: "2020-04-01T00:00:00.000Z",
						isOverdue: true,
					});
				}

				expect(result.knownIdentities).toHaveLength(1);
				expect(result.knownIdentities[0]).toEqual({
					displayName: knownDisplayName,
					fingerprint: knownFingerprint,
					handle: knownHandle,
					identityUpdatedAt: knownIdentityUpdatedAt,
					localAlias: Option.some(localAlias),
				});
				expect(result.retiredKeys).toEqual([
					{
						fingerprint: retiredFingerprint,
						retiredAt: "2025-10-01T00:00:00.000Z",
					},
				]);
				expect(result.retiredKeyCount).toBe(1);
				expect(result.rotationTtl).toBe("3m");
				expect(state.homeSchemaVersion).toBe(1);
			}),
		);
	});
});
