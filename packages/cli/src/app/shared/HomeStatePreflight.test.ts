import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { makeInMemoryHomeRepository } from "../create-user-identity/CreateUserIdentity.test-support.js";
import {
	HomeStatePreflight,
	withHomeStatePreflight,
} from "./HomeStatePreflight.js";
import { HomeStatePreflightUnsupportedVersionError } from "./HomeStatePreflightError.js";

const makeHomeStatePreflightLayer = (repository: HomeRepository) =>
	Layer.mergeAll(
		Layer.succeed(HomeRepository, repository),
		Layer.provide(
			HomeStatePreflight.Default,
			Layer.succeed(HomeRepository, repository),
		),
	);

const legacySelfIdentityV1 = {
	createdAt: "2025-01-01T00:00:00.000Z",
	displayName: "Isaac",
	identityUpdatedAt: "2025-01-02T00:00:00.000Z",
	keyMode: "pq-hybrid" as const,
	ownerId: "owner_isaac",
	privateKeyPath: "keys/active.key.age",
	publicKey: "age1isaacpublickey",
};

const legacyKnownIdentityV1 = {
	displayName: "Ops",
	identityUpdatedAt: "2025-01-03T00:00:00.000Z",
	localAlias: "TeamOps",
	ownerId: "owner_ops",
	publicKey: "age1opspublickey",
};

describe("HomeStatePreflight", () => {
	it.effect(
		"returns current home state unchanged without persistence rewrite",
		() =>
			Effect.gen(function* () {
				const repository = makeInMemoryHomeRepository();

				const result = yield* HomeStatePreflight.execute.pipe(
					Effect.provide(makeHomeStatePreflightLayer(repository)),
				);

				expect(result).toEqual(emptyHomeState());
				expect(repository.getSaveCount()).toBe(0);
			}),
	);

	it.effect(
		"migrates one-version-behind home state and persists current shape",
		() =>
			Effect.gen(function* () {
				const repository = makeInMemoryHomeRepository();
				repository.seedStateDocument({
					activeKeyFingerprint: null,
					defaultEditorCommand: null,
					homeSchemaVersion: 1,
					knownIdentities: [legacyKnownIdentityV1],
					retiredKeys: [],
					rotationTtl: "3m",
					self: legacySelfIdentityV1,
				});

				const result = yield* HomeStatePreflight.execute.pipe(
					Effect.provide(makeHomeStatePreflightLayer(repository)),
				);

				expect(result.homeSchemaVersion).toBe(2);
				expect(result.knownIdentities).toEqual([
					{
						displayName: "Ops",
						identityUpdatedAt: "2025-01-03T00:00:00.000Z",
						ownerId: "owner_ops",
						publicKey: "age1opspublickey",
					},
				]);
				expect(result.localAliases).toEqual({
					owner_ops: "TeamOps",
				});
				expect(Option.isSome(result.self)).toBe(true);
				if (Option.isSome(result.self)) {
					expect(result.self.value.publicIdentity).toEqual({
						displayName: "Isaac",
						identityUpdatedAt: "2025-01-02T00:00:00.000Z",
						ownerId: "owner_isaac",
						publicKey: "age1isaacpublickey",
					});
				}
				expect(repository.getSaveCount()).toBe(1);
				const firstKnownIdentity = result.knownIdentities.at(0);

				expect(firstKnownIdentity).toBeDefined();
				expect(
					firstKnownIdentity !== undefined &&
						"localAlias" in firstKnownIdentity,
				).toBe(false);
			}),
	);

	it.effect("migrates multi-hop legacy home state through adjacent steps", () =>
		Effect.gen(function* () {
			const repository = makeInMemoryHomeRepository();
			repository.seedStateDocument({
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 0,
				knownIdentities: [legacyKnownIdentityV1],
				retiredKeys: [],
				self: legacySelfIdentityV1,
			});

			const result = yield* HomeStatePreflight.execute.pipe(
				Effect.provide(makeHomeStatePreflightLayer(repository)),
			);

			expect(result.homeSchemaVersion).toBe(2);
			expect(result.rotationTtl).toBe("3m");
			expect(result.localAliases).toEqual({
				owner_ops: "TeamOps",
			});
			expect(repository.getSaveCount()).toBe(1);
		}),
	);

	it.effect("fails fast when managed home state is newer than runtime", () =>
		Effect.gen(function* () {
			const repository = makeInMemoryHomeRepository();
			let downstreamRan = false;
			repository.seedStateDocument({
				...emptyHomeState(),
				homeSchemaVersion: 3,
			});

			const result = yield* withHomeStatePreflight(
				Effect.sync(() => {
					downstreamRan = true;
					return "ok";
				}),
			).pipe(
				Effect.flip,
				Effect.provide(makeHomeStatePreflightLayer(repository)),
			);

			expect(result).toBeInstanceOf(HomeStatePreflightUnsupportedVersionError);
			expect(downstreamRan).toBe(false);
			expect(repository.getSaveCount()).toBe(0);
		}),
	);

	it.effect(
		"runs before downstream command logic and passes normalized home state through",
		() =>
			Effect.gen(function* () {
				const repository = makeInMemoryHomeRepository();
				repository.seedStateDocument({
					activeKeyFingerprint: null,
					defaultEditorCommand: null,
					homeSchemaVersion: 1,
					knownIdentities: [],
					retiredKeys: [],
					rotationTtl: "3m",
					self: null,
				});
				let downstreamHomeVersion: number | null = null;

				yield* withHomeStatePreflight(
					Effect.gen(function* () {
						const homeRepository = yield* HomeRepository;
						const state = yield* homeRepository.loadState;
						downstreamHomeVersion = state.homeSchemaVersion;
					}),
				).pipe(Effect.provide(makeHomeStatePreflightLayer(repository)));

				expect(downstreamHomeVersion).toBe(2);
				expect(repository.getSaveCount()).toBe(1);
			}),
	);

	it.effect(
		"still auto-migrates managed home state before read-only downstream flows",
		() =>
			Effect.gen(function* () {
				const repository = makeInMemoryHomeRepository();
				repository.seedStateDocument({
					activeKeyFingerprint: null,
					defaultEditorCommand: null,
					homeSchemaVersion: 1,
					knownIdentities: [],
					retiredKeys: [],
					rotationTtl: "3m",
					self: null,
				});

				const result = yield* withHomeStatePreflight(
					Effect.succeed("read-output"),
				).pipe(Effect.provide(makeHomeStatePreflightLayer(repository)));

				expect(result).toBe("read-output");
				expect(repository.getSaveCount()).toBe(1);
			}),
	);
});
