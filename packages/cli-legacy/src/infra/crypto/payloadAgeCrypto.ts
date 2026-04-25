import * as age from "age-encryption";
import { Effect, Layer, Schema } from "effect";
import { PayloadEnvelope } from "../../domain/payload/PayloadEnvelope.js";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import {
	PayloadDecryptError,
	PayloadEncryptError,
} from "../../port/PayloadCryptoError.js";

const textEncoder = new TextEncoder();
const PayloadEnvelopeJson = Schema.parseJson(PayloadEnvelope);

export const makePayloadAgeCrypto = () =>
	PayloadCrypto.make({
		decryptEnvelope: (input) =>
			Effect.tryPromise({
				catch: () =>
					new PayloadDecryptError({
						message: "Failed to decrypt payload envelope",
					}),
				try: async () => {
					const identityDecrypter = new age.Decrypter();
					identityDecrypter.addPassphrase(input.passphrase);

					for (const encryptedPrivateKey of input.encryptedPrivateKeys) {
						const identity = await identityDecrypter.decrypt(
							age.armor.decode(encryptedPrivateKey),
							"text",
						);

						identityDecrypter.addIdentity(identity);
					}

					return await identityDecrypter.decrypt(
						age.armor.decode(input.armoredPayload),
						"text",
					);
				},
			}).pipe(
				Effect.flatMap((json) =>
					Schema.decodeUnknown(PayloadEnvelopeJson)(json).pipe(
						Effect.mapError(
							() =>
								new PayloadDecryptError({
									message: "Decrypted payload envelope did not match schema",
								}),
						),
					),
				),
			),
		encryptEnvelope: (input) =>
			Schema.encode(PayloadEnvelopeJson)(input.envelope).pipe(
				Effect.mapError(
					() =>
						new PayloadEncryptError({
							message: "Payload envelope could not be encoded",
						}),
				),
				Effect.flatMap((json) =>
					Effect.tryPromise({
						catch: () =>
							new PayloadEncryptError({
								message: "Failed to encrypt payload envelope",
							}),
						try: async () => {
							const encrypter = new age.Encrypter();

							for (const recipient of input.recipients) {
								encrypter.addRecipient(recipient);
							}

							const ciphertext = await encrypter.encrypt(
								textEncoder.encode(json),
							);

							return age.armor.encode(ciphertext);
						},
					}),
				),
			),
	});

export const PayloadAgeCryptoLive = Layer.succeed(
	PayloadCrypto,
	makePayloadAgeCrypto(),
);
