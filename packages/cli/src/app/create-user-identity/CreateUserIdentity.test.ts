import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { ActiveKeyAlreadyExistsError } from "../../domain/error/IdentityDomainError.js";
import { IdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { Recipient } from "../../domain/identity/Recipient.js";
import {
	Crypto,
	GeneratedIdentity,
	PlaintextPrivateKey,
} from "../../port/Crypto.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { CreateUserIdentity } from "./CreateUserIdentity.js";
import { makeInMemoryHomeRepository } from "./CreateUserIdentity.test-support.js";
import { CreateUserIdentityPersistenceError } from "./CreateUserIdentityError.js";

const makeCrypto = () =>
	Crypto.make({
		generateUserIdentity: () =>
			Effect.succeed(
				Schema.decodeUnknownSync(GeneratedIdentity)({
					encryptedSecretKey: "encrypted",
					fingerprint: "bs1_0123456789abcdef",
					identityUpdatedAt: "2026-04-14T10:00:00.000Z",
					keyMode: "pq-hybrid",
					ownerId: "bsid1_069f7576d2ab43ef",
					publicKey: "age1testrecipient",
				}),
			),
		decryptPrivateKey: () =>
			Effect.succeed(
				Schema.decodeUnknownSync(PlaintextPrivateKey)(
					"AGE-SECRET-KEY-PLAINTEXT",
				),
			),
		encryptPrivateKey: () => Effect.succeed("encrypted" as never),
	});

const existingActiveKey = {
	alias: Schema.decodeUnknownSync(IdentityAlias)("existing"),
	createdAt: "2026-04-09T12:00:00.000Z",
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_aaaaaaaaaaaaaaaa"),
	kind: "user" as const,
	keyMode: "pq-hybrid" as const,
	privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
		"keys/active.key.age",
	),
	recipient: Schema.decodeUnknownSync(Recipient)("age1existing"),
	status: "active" as const,
};

describe("CreateUserIdentity", () => {
	const homeRepository = makeInMemoryHomeRepository();

	layer(
		Layer.provide(CreateUserIdentity.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("success", (it) => {
		it.effect("persists a generated user identity", () =>
			Effect.gen(function* () {
				const result = yield* CreateUserIdentity.execute({
					displayName: "isaac-mbp",
					passphrase: "passphrase",
				});
				const snapshot = homeRepository.snapshot();

				expect(result.fingerprint).toBe("bs1_0123456789abcdef");
				expect(result.displayName).toBe("isaac-mbp");
				expect(result.privateKeyPath).toBe("keys/active.key.age");
				expect(snapshot.state.self._tag).toBe("Some");
				if (snapshot.state.self._tag === "Some") {
					expect(snapshot.state.self.value.publicIdentity.ownerId).toBe(
						"bsid1_069f7576d2ab43ef",
					);
					expect(snapshot.state.self.value.publicIdentity.displayName).toBe(
						"isaac-mbp",
					);
					expect(snapshot.state.self.value.publicIdentity.publicKey).toBe(
						"age1testrecipient",
					);
				}
			}),
		);
	});

	layer(
		Layer.provide(CreateUserIdentity.Default, [
			Layer.succeed(
				HomeRepository,
				HomeRepository.make({
					deletePrivateKey: (_privateKeyPath) => Effect.void,
					getActiveKey: Effect.succeed(Option.some(existingActiveKey)),
					getLocation: Effect.succeed({
						keysDirectory: "/tmp/home/keys",
						rootDirectory: "/tmp/home",
						stateFile: "/tmp/home/state.json",
					}),
					loadState: Effect.die("should not load state"),
					readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
					saveState: () => Effect.void,
					writePrivateKey: (_fingerprint, _contents) =>
						Effect.die("should not write key"),
					writePrivateKeyAtPath: (_input) => Effect.die("unused"),
				}),
			),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("failure", (it) => {
		it.effect("fails when an active key already exists", () =>
			Effect.gen(function* () {
				const result = yield* CreateUserIdentity.execute({
					displayName: "isaac-mbp",
					passphrase: "passphrase",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ActiveKeyAlreadyExistsError);
				}
			}),
		);
	});

	layer(
		Layer.provide(CreateUserIdentity.Default, [
			Layer.succeed(
				HomeRepository,
				makeInMemoryHomeRepository({
					failOnSave: true,
				}),
			),
			Layer.succeed(Crypto, makeCrypto()),
		]),
	)("rollback", (it) => {
		it.effect("remaps save failure as persistence error", () =>
			Effect.gen(function* () {
				const result = yield* CreateUserIdentity.execute({
					displayName: "rollback-host",
					passphrase: "passphrase",
				}).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						CreateUserIdentityPersistenceError,
					);
				}
			}),
		);
	});
});
