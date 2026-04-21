import { Effect, Schema } from "effect";
import { EncryptedPrivateKey } from "../domain/identity/EncryptedPrivateKey.js";
import {
	type KeyMode,
	KeyMode as KeyModeSchema,
} from "../domain/identity/Identity.js";
import { IdentityUpdatedAt } from "../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../domain/identity/OwnerId.js";
import { PublicKey } from "../domain/identity/PublicKey.js";
import type {
	IdentityGenerationError,
	PrivateKeyDecryptionError,
	PrivateKeyEncryptionError,
} from "./CryptoError.js";

export const PlaintextPrivateKey = Schema.String.pipe(
	Schema.minLength(1),
	Schema.brand("@better-age/PlaintextPrivateKey"),
);

export type PlaintextPrivateKey = Schema.Schema.Type<
	typeof PlaintextPrivateKey
>;

export const GeneratedIdentity = Schema.Struct({
	encryptedSecretKey: EncryptedPrivateKey,
	fingerprint: KeyFingerprint,
	identityUpdatedAt: IdentityUpdatedAt,
	keyMode: KeyModeSchema,
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type GeneratedIdentity = Schema.Schema.Type<typeof GeneratedIdentity>;

type CryptoShape = {
	readonly generateUserIdentity: (input: {
		readonly keyMode: KeyMode;
		readonly ownerId?: OwnerId;
		readonly passphrase: string;
	}) => Effect.Effect<GeneratedIdentity, IdentityGenerationError>;
	readonly decryptPrivateKey: (input: {
		readonly encryptedPrivateKey: EncryptedPrivateKey;
		readonly passphrase: string;
	}) => Effect.Effect<PlaintextPrivateKey, PrivateKeyDecryptionError>;
	readonly encryptPrivateKey: (input: {
		readonly passphrase: string;
		readonly privateKey: PlaintextPrivateKey;
	}) => Effect.Effect<EncryptedPrivateKey, PrivateKeyEncryptionError>;
};

const missingCrypto = {
	generateUserIdentity: (_input: {
		readonly keyMode: KeyMode;
		readonly ownerId?: OwnerId;
		readonly passphrase: string;
	}) =>
		Effect.dieMessage("Crypto implementation not provided") as Effect.Effect<
			GeneratedIdentity,
			IdentityGenerationError
		>,
	decryptPrivateKey: (_input: {
		readonly encryptedPrivateKey: EncryptedPrivateKey;
		readonly passphrase: string;
	}) =>
		Effect.dieMessage("Crypto implementation not provided") as Effect.Effect<
			PlaintextPrivateKey,
			PrivateKeyDecryptionError
		>,
	encryptPrivateKey: (_input: {
		readonly passphrase: string;
		readonly privateKey: PlaintextPrivateKey;
	}) =>
		Effect.dieMessage("Crypto implementation not provided") as Effect.Effect<
			EncryptedPrivateKey,
			PrivateKeyEncryptionError
		>,
} satisfies CryptoShape;

export class Crypto extends Effect.Service<Crypto>()("Crypto", {
	accessors: true,
	succeed: missingCrypto,
}) {}
