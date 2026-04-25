import { createHash } from "node:crypto";
import * as age from "age-encryption";
import { Effect, Layer, Schema } from "effect";
import {
	Crypto,
	GeneratedIdentity,
	PlaintextPrivateKey,
} from "../../port/Crypto.js";
import {
	IdentityGenerationError,
	PrivateKeyDecryptionError,
	PrivateKeyEncryptionError,
} from "../../port/CryptoError.js";

const fingerprintFromRecipient = (recipient: string): string =>
	`bs1_${createHash("sha256").update(recipient).digest("hex").slice(0, 16)}`;

const ownerIdFromRecipient = (recipient: string): string =>
	`bsid1_${createHash("sha256").update(`owner:${recipient}`).digest("hex").slice(0, 16)}`;

export const makeTypageCrypto = () =>
	Crypto.make({
		generateUserIdentity: (input) =>
			Effect.tryPromise({
				catch: () =>
					new IdentityGenerationError({
						message: "Failed to generate a passphrase-protected identity",
					}),
				try: async () => {
					const identity = await age.generateHybridIdentity();
					const recipient = await age.identityToRecipient(identity);
					const encrypter = new age.Encrypter();
					encrypter.setPassphrase(input.passphrase);
					const encryptedIdentity = await encrypter.encrypt(identity);

					return {
						encryptedSecretKey: age.armor.encode(encryptedIdentity),
						fingerprint: fingerprintFromRecipient(recipient),
						identityUpdatedAt: new Date().toISOString(),
						keyMode: input.keyMode,
						ownerId: input.ownerId ?? ownerIdFromRecipient(recipient),
						publicKey: recipient,
					};
				},
			}).pipe(
				Effect.flatMap((generatedIdentity) =>
					Schema.decodeUnknown(GeneratedIdentity)(generatedIdentity).pipe(
						Effect.mapError(
							() =>
								new IdentityGenerationError({
									message: "Generated identity did not match schema",
								}),
						),
					),
				),
			),
		decryptPrivateKey: (input) =>
			Effect.tryPromise({
				catch: () =>
					new PrivateKeyDecryptionError({
						message: "Failed to decrypt private key with provided passphrase",
					}),
				try: async () => {
					const encrypted = age.armor.decode(input.encryptedPrivateKey);
					const decrypter = new age.Decrypter();
					decrypter.addPassphrase(input.passphrase);
					const decrypted = await decrypter.decrypt(encrypted);
					return new TextDecoder().decode(decrypted);
				},
			}).pipe(
				Effect.flatMap((privateKey) =>
					Schema.decodeUnknown(PlaintextPrivateKey)(privateKey).pipe(
						Effect.mapError(
							() =>
								new PrivateKeyDecryptionError({
									message: "Decrypted private key did not match schema",
								}),
						),
					),
				),
			),
		encryptPrivateKey: (input) =>
			Effect.tryPromise({
				catch: () =>
					new PrivateKeyEncryptionError({
						message: "Failed to encrypt private key with new passphrase",
					}),
				try: async () => {
					const encrypter = new age.Encrypter();
					encrypter.setPassphrase(input.passphrase);
					const encrypted = await encrypter.encrypt(input.privateKey);
					return age.armor.encode(encrypted);
				},
			}).pipe(
				Effect.flatMap((encryptedPrivateKey) =>
					Schema.decodeUnknown(GeneratedIdentity.fields.encryptedSecretKey)(
						encryptedPrivateKey,
					).pipe(
						Effect.mapError(
							() =>
								new PrivateKeyEncryptionError({
									message: "Encrypted private key did not match schema",
								}),
						),
					),
				),
			),
	});

export const TypageCryptoLive = Layer.succeed(Crypto, makeTypageCrypto());
