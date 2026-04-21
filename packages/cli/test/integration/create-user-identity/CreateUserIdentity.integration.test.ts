import { describe, expect, layer } from "@effect/vitest";
import * as age from "age-encryption";
import { Effect, Layer, Option } from "effect";
import { CreateUserIdentity } from "../../../src/app/create-user-identity/CreateUserIdentity.js";
import { makeTypageCrypto } from "../../../src/infra/crypto/typageCrypto.js";
import { Crypto } from "../../../src/port/Crypto.js";
import { HomeRepository } from "../../../src/port/HomeRepository.js";
import { makeInMemoryHomeRepository } from "./fixtures/inMemoryHomeRepository.js";

const textDecoder = new TextDecoder();

type DecryptIdentityError = {
	readonly _tag: "DecryptIdentityError";
	readonly message: string;
};

type IdentityToRecipientError = {
	readonly _tag: "IdentityToRecipientError";
	readonly message: string;
};

describe("CreateUserIdentity integration", () => {
	const homeRepository = makeInMemoryHomeRepository();

	layer(
		Layer.provide(CreateUserIdentity.Default, [
			Layer.succeed(HomeRepository, homeRepository),
			Layer.succeed(Crypto, makeTypageCrypto()),
		]),
	)("real crypto", (it) => {
		it.effect("creates a real protected identity without host fs", () =>
			Effect.gen(function* () {
				const passphrase = "integration-passphrase";
				const result = yield* CreateUserIdentity.execute({
					displayName: "integration-host",
					passphrase,
				});
				const snapshot = homeRepository.snapshot();
				const encryptedSecretKey = snapshot.files.get(result.privateKeyPath);

				expect(encryptedSecretKey).toBeTruthy();
				expect(Option.getOrNull(snapshot.state.activeKeyFingerprint)).toBe(
					result.fingerprint,
				);
				expect(result.privateKeyPath).toBe("keys/active.key.age");
				expect(snapshot.state.self._tag).toBe("Some");
				if (snapshot.state.self._tag === "Some") {
					expect(snapshot.state.self.value.displayName).toBe(
						"integration-host",
					);
					expect(snapshot.state.self.value.ownerId).toMatch(
						/^bsid1_[a-f0-9]{16}$/,
					);
					expect(snapshot.state.self.value.fingerprint).toBe(
						result.fingerprint,
					);
					expect(snapshot.state.self.value.handle).toBe(
						`integration-host#${snapshot.state.self.value.ownerId.slice("bsid1_".length, "bsid1_".length + 8)}`,
					);
					expect(snapshot.state.self.value.keyMode).toBe("pq-hybrid");
					expect(snapshot.state.self.value.publicKey).toBe(result.publicKey);
				}
				expect(result.publicKey.startsWith("age1")).toBe(true);

				const decrypter = new age.Decrypter();
				decrypter.addPassphrase(passphrase);
				const decodedKey = age.armor.decode(encryptedSecretKey ?? "");
				const identity = textDecoder.decode(
					yield* Effect.tryPromise({
						catch: (cause): DecryptIdentityError => ({
							_tag: "DecryptIdentityError",
							message: String(cause),
						}),
						try: () => decrypter.decrypt(decodedKey),
					}),
				);
				const recipient = yield* Effect.tryPromise({
					catch: (cause): IdentityToRecipientError => ({
						_tag: "IdentityToRecipientError",
						message: String(cause),
					}),
					try: () => age.identityToRecipient(identity),
				});

				expect(recipient).toBe(result.publicKey);
			}),
		);
	});
});
