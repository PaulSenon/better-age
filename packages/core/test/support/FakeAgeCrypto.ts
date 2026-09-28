// Deterministic, instant stand-in for `AgeCrypto` (real age uses scrypt and
// PQ keygen, ~0.3s per operation). Keeps the same contracts: passphrase
// mismatch fails, only listed recipients can decrypt.
import { Effect, Encoding, Layer, Option, Result, Schema } from "effect";
import { decodeKeyFile, encodeKeyFile } from "../../src/artifacts/KeyFile.js";
import { fingerprintOf } from "../../src/domain/Identity.js";
import { PassphraseIncorrect } from "../../src/Errors.js";
import { AgeCrypto } from "../../src/services/AgeCrypto.js";

const armor = (body: unknown) =>
	[
		"-----BEGIN AGE ENCRYPTED FILE-----",
		Encoding.encodeBase64(JSON.stringify(body)),
		"-----END AGE ENCRYPTED FILE-----",
		"",
	].join("\n");

const Armored = Schema.fromJsonString(Schema.Unknown);

const unarmor = (text: string): unknown =>
	Result.getOrUndefined(
		Encoding.decodeBase64String(
			text
				.replace("-----BEGIN AGE ENCRYPTED FILE-----", "")
				.replace("-----END AGE ENCRYPTED FILE-----", "")
				.trim(),
		).pipe(Result.flatMap(Schema.decodeUnknownResult(Armored))),
	);

export const makeFakeAgeCrypto = (
	options: {
		/** Corrupts ciphertext so write verification fails. */
		readonly corruptEncrypt?: () => boolean;
	} = {},
) => {
	let counter = 0;

	return Layer.succeed(AgeCrypto)({
		generateKey: ({ ownerId, createdAt }) =>
			Effect.sync(() => {
				counter += 1;
				const publicKey = `age1fake${ownerId}${counter}`;

				return {
					ownerId,
					publicKey,
					privateKey: `AGE-SECRET-KEY-FAKE-${publicKey}`,
					fingerprint: fingerprintOf(publicKey),
					createdAt,
				};
			}),
		lockKey: (key, passphrase) =>
			Effect.succeed(armor({ passphrase, keyFile: encodeKeyFile(key) })),
		unlockKey: (lockedKey, passphrase) =>
			Effect.gen(function* () {
				const locked = unarmor(lockedKey) as
					| { readonly passphrase: string; readonly keyFile: string }
					| undefined;

				if (locked?.passphrase !== passphrase) {
					return yield* new PassphraseIncorrect();
				}

				return yield* Effect.fromResult(decodeKeyFile(locked.keyFile));
			}),
		encrypt: (plaintext, recipients) =>
			Effect.sync(() =>
				options.corruptEncrypt?.() === true
					? armor({ recipients: [], plaintext: "" })
					: armor({ recipients, plaintext }),
			),
		decrypt: (text, keys) =>
			Effect.sync(() => {
				const box = unarmor(text) as
					| {
							readonly recipients: ReadonlyArray<string>;
							readonly plaintext: string;
					  }
					| undefined;

				return box !== undefined &&
					keys.some((key) => box.recipients.includes(key.publicKey))
					? Option.some(box.plaintext)
					: Option.none();
			}),
	});
};
