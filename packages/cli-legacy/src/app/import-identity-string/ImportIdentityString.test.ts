import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { decodeIdentityAlias } from "../../domain/identity/IdentityAlias.js";
import {
	encodeIdentityString,
	IdentityStringPayload,
	toIdentityStringPayload,
} from "../../domain/identity/IdentityString.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import {
	derivePublicIdentityFingerprint,
	type PublicIdentity,
} from "../../domain/identity/PublicIdentity.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { ImportIdentityString } from "./ImportIdentityString.js";
import {
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
} from "./ImportIdentityStringError.js";

const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_abcdef0123456789",
);
const paulHandle = Schema.decodeUnknownSync(Handle)("paul#abcdef01");
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_abcdef0123456789");
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paulrecipient");
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T12:00:00.000Z",
);
const paulPublicIdentity: PublicIdentity = {
	displayName: paulDisplayName,
	identityUpdatedAt: paulIdentityUpdatedAt,
	ownerId: paulOwnerId,
	publicKey: paulPublicKey,
};
const olderPaulFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_deadbeef01234567",
);
const olderPaulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-01T12:00:00.000Z",
);
const newerPaulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-20T12:00:00.000Z",
);
const olderPaulPublicKey =
	Schema.decodeUnknownSync(PublicKey)("age1oldrecipient");
const newerPaulPublicKey =
	Schema.decodeUnknownSync(PublicKey)("age1newerrecipient");
const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac#069f7576");
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaacrecipient");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfIdentityString = encodeIdentityString(
	Schema.decodeUnknownSync(IdentityStringPayload)(
		toIdentityStringPayload({
			displayName: selfDisplayName,
			identityUpdatedAt: selfIdentityUpdatedAt,
			ownerId: selfOwnerId,
			publicKey: selfPublicKey,
		}),
	),
);

const makeIdentityString = () =>
	encodeIdentityString(
		Schema.decodeUnknownSync(IdentityStringPayload)(
			toIdentityStringPayload(paulPublicIdentity),
		),
	);

describe("ImportIdentityString", () => {
	const homeRepositoryLayer = Layer.effect(
		HomeRepository,
		Effect.sync(() => makeInMemoryHomeRepository()),
	);

	layer(
		Layer.mergeAll(
			homeRepositoryLayer,
			Layer.provide(ImportIdentityString.Default, homeRepositoryLayer),
		),
	)("success", (it) => {
		it.effect("adds an unknown identity to known identities", () =>
			Effect.gen(function* () {
				const homeRepository = yield* HomeRepository;

				const result = yield* ImportIdentityString.execute({
					identityString: makeIdentityString(),
				});
				const state = yield* homeRepository.loadState;

				expect(result.outcome).toBe("added");
				expect(state.knownIdentities).toHaveLength(1);
				expect(state.knownIdentities[0]).toEqual({
					displayName: paulDisplayName,
					identityUpdatedAt: paulIdentityUpdatedAt,
					ownerId: paulOwnerId,
					publicKey: paulPublicKey,
				});
				expect(state.localAliases).toEqual({});
			}),
		);

		it.effect(
			"stores supplied local alias when adding an unknown identity",
			() =>
				Effect.gen(function* () {
					const homeRepository = yield* HomeRepository;
					const localAlias = yield* decodeIdentityAlias("ops-paul");

					yield* homeRepository.saveState(emptyHomeState());
					yield* ImportIdentityString.execute({
						identityString: makeIdentityString(),
						localAlias: Option.some(localAlias),
					});
					const state = yield* homeRepository.loadState;

					expect(state.localAliases).toEqual({
						[paulOwnerId]: localAlias,
					});
				}),
		);

		it.effect(
			"updates a known identity when the imported snapshot is newer",
			() =>
				Effect.gen(function* () {
					const homeRepository = yield* HomeRepository;
					const state = yield* homeRepository.loadState;
					const localAlias = yield* decodeIdentityAlias("paul-work");

					yield* homeRepository.saveState({
						...state,
						knownIdentities: [
							{
								displayName: paulDisplayName,
								identityUpdatedAt: olderPaulIdentityUpdatedAt,
								ownerId: paulOwnerId,
								publicKey: olderPaulPublicKey,
							},
						],
						localAliases: {
							[paulOwnerId]: localAlias,
						},
					});

					const result = yield* ImportIdentityString.execute({
						identityString: makeIdentityString(),
					});
					const nextState = yield* homeRepository.loadState;

					expect(result.outcome).toBe("updated");
					expect(nextState.knownIdentities).toHaveLength(1);
					expect(nextState.localAliases).toEqual({
						[paulOwnerId]: localAlias,
					});
					expect(nextState.knownIdentities[0]?.publicKey).toBe(paulPublicKey);
					expect(nextState.knownIdentities[0]?.identityUpdatedAt).toBe(
						paulIdentityUpdatedAt,
					);
				}),
		);

		it.effect(
			"replaces local alias on update when an override is supplied",
			() =>
				Effect.gen(function* () {
					const homeRepository = yield* HomeRepository;
					const state = yield* homeRepository.loadState;
					const previousAlias = yield* decodeIdentityAlias("paul-work");
					const nextAlias = yield* decodeIdentityAlias("ops-paul");

					yield* homeRepository.saveState({
						...state,
						knownIdentities: [
							{
								displayName: paulDisplayName,
								identityUpdatedAt: olderPaulIdentityUpdatedAt,
								ownerId: paulOwnerId,
								publicKey: olderPaulPublicKey,
							},
						],
						localAliases: {
							[paulOwnerId]: previousAlias,
						},
					});

					yield* ImportIdentityString.execute({
						identityString: makeIdentityString(),
						localAlias: Option.some(nextAlias),
					});
					const nextState = yield* homeRepository.loadState;

					expect(nextState.localAliases).toEqual({
						[paulOwnerId]: nextAlias,
					});
				}),
		);

		it.effect("returns unchanged when the imported snapshot is older", () =>
			Effect.gen(function* () {
				const homeRepository = yield* HomeRepository;
				const state = yield* homeRepository.loadState;
				const localAlias = yield* decodeIdentityAlias("paul-work");

				yield* homeRepository.saveState({
					...state,
					knownIdentities: [
						{
							displayName: paulDisplayName,
							identityUpdatedAt: newerPaulIdentityUpdatedAt,
							ownerId: paulOwnerId,
							publicKey: newerPaulPublicKey,
						},
					],
					localAliases: {
						[paulOwnerId]: localAlias,
					},
				});

				const result = yield* ImportIdentityString.execute({
					identityString: makeIdentityString(),
				});
				const nextState = yield* homeRepository.loadState;

				expect(result.outcome).toBe("unchanged");
				expect(nextState.localAliases).toEqual({
					[paulOwnerId]: localAlias,
				});
				expect(nextState.knownIdentities[0]?.publicKey).toBe(
					newerPaulPublicKey,
				);
				expect(nextState.knownIdentities[0]?.identityUpdatedAt).toBe(
					newerPaulIdentityUpdatedAt,
				);
			}),
		);

		it.effect("fails when the identity string is malformed", () =>
			Effect.gen(function* () {
				const result = yield* ImportIdentityString.execute({
					identityString: "bad-value",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ImportIdentityStringDecodeError);
				}
			}),
		);

		it.effect("fails and never stores self in known identities", () =>
			Effect.gen(function* () {
				const homeRepository = yield* HomeRepository;

				yield* homeRepository.saveState({
					...emptyHomeState(),
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

				const result = yield* ImportIdentityString.execute({
					identityString: selfIdentityString,
				}).pipe(Effect.either);
				const nextState = yield* homeRepository.loadState;

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						ImportIdentityStringForbiddenSelfError,
					);
				}
				expect(nextState.knownIdentities).toEqual([]);
			}),
		);
	});
});
