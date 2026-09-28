// age-encryption boundary: key generation, passphrase-locked key files, and
// multi-recipient payload encryption. Everything is ASCII-armored.
import * as age from "age-encryption";
import { Context, Effect, Layer, Option } from "effect";
import {
	decodeKeyFile,
	encodeKeyFile,
	type LocalKey,
} from "../artifacts/KeyFile.js";
import { fingerprintOf } from "../domain/Identity.js";
import { PassphraseIncorrect, PrivateKeyInvalid } from "../Errors.js";

export class AgeCrypto extends Context.Service<
	AgeCrypto,
	{
		readonly generateKey: (input: {
			readonly ownerId: string;
			readonly createdAt: string;
		}) => Effect.Effect<LocalKey>;
		/** Encrypts the key file with a passphrase (scrypt). */
		readonly lockKey: (
			key: LocalKey,
			passphrase: string,
		) => Effect.Effect<string>;
		/** Decrypts and integrity-checks a locked key file. */
		readonly unlockKey: (
			lockedKey: string,
			passphrase: string,
		) => Effect.Effect<LocalKey, PassphraseIncorrect | PrivateKeyInvalid>;
		readonly encrypt: (
			plaintext: string,
			recipients: ReadonlyArray<string>,
		) => Effect.Effect<string>;
		/** None when none of `keys` is a recipient (or the armor is unreadable). */
		readonly decrypt: (
			armor: string,
			keys: ReadonlyArray<LocalKey>,
		) => Effect.Effect<Option.Option<string>>;
	}
>()("@better-age/core/AgeCrypto") {
	static readonly layer = Layer.succeed(AgeCrypto)({
		generateKey: ({ ownerId, createdAt }) =>
			Effect.promise(async () => {
				const privateKey = await age.generateHybridIdentity();
				const publicKey = await age.identityToRecipient(privateKey);

				return {
					ownerId,
					publicKey,
					privateKey,
					fingerprint: fingerprintOf(publicKey),
					createdAt,
				};
			}),
		lockKey: (key, passphrase) =>
			Effect.promise(async () => {
				const encrypter = new age.Encrypter();
				encrypter.setPassphrase(passphrase);

				return age.armor.encode(await encrypter.encrypt(encodeKeyFile(key)));
			}),
		unlockKey: Effect.fnUntraced(function* (lockedKey, passphrase) {
			const keyFile = yield* Effect.tryPromise({
				try: () => {
					const decrypter = new age.Decrypter();
					decrypter.addPassphrase(passphrase);
					return decrypter.decrypt(age.armor.decode(lockedKey), "text");
				},
				catch: () => new PassphraseIncorrect(),
			});
			const key = yield* Effect.fromResult(decodeKeyFile(keyFile));
			const publicKey = yield* Effect.tryPromise({
				try: () => age.identityToRecipient(key.privateKey),
				catch: () => new PrivateKeyInvalid(),
			});

			if (
				publicKey !== key.publicKey ||
				fingerprintOf(publicKey) !== key.fingerprint
			) {
				return yield* new PrivateKeyInvalid();
			}

			return key;
		}),
		encrypt: (plaintext, recipients) =>
			Effect.promise(async () => {
				const encrypter = new age.Encrypter();
				for (const recipient of recipients) {
					encrypter.addRecipient(recipient);
				}

				return age.armor.encode(await encrypter.encrypt(plaintext));
			}),
		decrypt: (armor, keys) =>
			Effect.tryPromise(() => {
				const decrypter = new age.Decrypter();
				for (const key of keys) {
					decrypter.addIdentity(key.privateKey);
				}

				return decrypter.decrypt(age.armor.decode(armor), "text");
			}).pipe(
				Effect.map(Option.some),
				Effect.orElseSucceed(() => Option.none()),
			),
	});
}
