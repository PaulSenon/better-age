import { Effect } from "effect";
import type { PublicKey } from "../domain/identity/PublicKey.js";
import type { PayloadEnvelope } from "../domain/payload/PayloadEnvelope.js";
import type {
	PayloadDecryptError,
	PayloadEncryptError,
} from "./PayloadCryptoError.js";

type PayloadCryptoShape = {
	readonly decryptEnvelope: (input: {
		readonly armoredPayload: string;
		readonly encryptedPrivateKeys: ReadonlyArray<string>;
		readonly passphrase: string;
	}) => Effect.Effect<unknown, PayloadDecryptError>;
	readonly encryptEnvelope: (input: {
		readonly envelope: PayloadEnvelope;
		readonly recipients: ReadonlyArray<PublicKey>;
	}) => Effect.Effect<string, PayloadEncryptError>;
};

const missingPayloadCrypto = {
	decryptEnvelope: (_input: {
		readonly armoredPayload: string;
		readonly encryptedPrivateKeys: ReadonlyArray<string>;
		readonly passphrase: string;
	}) =>
		Effect.dieMessage(
			"PayloadCrypto implementation not provided",
		) as Effect.Effect<unknown, PayloadDecryptError>,
	encryptEnvelope: (_input: {
		readonly envelope: PayloadEnvelope;
		readonly recipients: ReadonlyArray<PublicKey>;
	}) =>
		Effect.dieMessage(
			"PayloadCrypto implementation not provided",
		) as Effect.Effect<string, PayloadEncryptError>,
} satisfies PayloadCryptoShape;

export class PayloadCrypto extends Effect.Service<PayloadCrypto>()(
	"PayloadCrypto",
	{
		accessors: true,
		succeed: missingPayloadCrypto,
	},
) {}
