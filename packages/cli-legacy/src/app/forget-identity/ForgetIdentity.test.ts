import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { derivePublicIdentityHandle } from "../../domain/identity/PublicIdentity.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import { ForgetIdentity } from "./ForgetIdentity.js";
import {
	ForgetIdentityForbiddenSelfError,
	ForgetIdentityRemovedSuccess,
	ForgetIdentityUnchangedSuccess,
} from "./ForgetIdentityError.js";

const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac");
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const selfPrivateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
	"keys/active.key.age",
);
const selfPublicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");
const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa");
const paulIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-04-14T10:00:00.000Z",
);
const paulPublicKey = Schema.decodeUnknownSync(PublicKey)("age1paul");

describe("ForgetIdentity", () => {
	const homeRepositoryLayer = Layer.effect(
		HomeRepository,
		Effect.sync(() => makeInMemoryHomeRepository()),
	);

	layer(
		Layer.mergeAll(
			homeRepositoryLayer,
			Layer.provide(ForgetIdentity.Default, homeRepositoryLayer),
		),
	)("success", (it) => {
		it.effect("removes a known identity by handle", () =>
			Effect.gen(function* () {
				const homeRepository = yield* HomeRepository;

				yield* homeRepository.saveState({
					...emptyHomeState(),
					knownIdentities: [
						{
							displayName: paulDisplayName,
							identityUpdatedAt: paulIdentityUpdatedAt,
							ownerId: paulOwnerId,
							publicKey: paulPublicKey,
						},
					],
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

				const result = yield* ForgetIdentity.execute({
					identityRef: "paul#aaaaaaaa",
				});
				const nextState = yield* homeRepository.loadState;

				expect(result).toEqual(
					new ForgetIdentityRemovedSuccess({
						handle: derivePublicIdentityHandle({
							displayName: paulDisplayName,
							identityUpdatedAt: paulIdentityUpdatedAt,
							ownerId: paulOwnerId,
							publicKey: paulPublicKey,
						}),
					}),
				);
				expect(nextState.knownIdentities).toEqual([]);
			}),
		);

		it.effect("returns unchanged when identity is not known locally", () =>
			Effect.gen(function* () {
				const result = yield* ForgetIdentity.execute({
					identityRef: "paul#aaaaaaaa",
				});

				expect(result).toEqual(
					new ForgetIdentityUnchangedSuccess({
						identityRef: "paul#aaaaaaaa",
						reason: "identity-not-known",
					}),
				);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			homeRepositoryLayer,
			Layer.provide(ForgetIdentity.Default, homeRepositoryLayer),
		),
	)("failure", (it) => {
		it.effect("fails when target resolves to current self identity", () =>
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

				const result = yield* ForgetIdentity.execute({
					identityRef: "isaac#069f7576",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ForgetIdentityForbiddenSelfError);
				}
			}),
		);
	});
});
