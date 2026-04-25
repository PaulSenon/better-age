import { Effect } from "effect";
import { PayloadCrypto } from "../../port/PayloadCrypto.js";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import { PayloadReadError } from "../../port/PayloadRepositoryError.js";

export const makeInMemoryPayloadRepository = () => {
	const files = new Map<string, string>();
	const writeCalls: Array<{
		readonly contents: string;
		readonly path: string;
	}> = [];

	return {
		service: PayloadRepository.make({
			readFile: (path) =>
				Effect.sync(() => {
					const file = files.get(path);

					if (file === undefined) {
						throw new PayloadReadError({
							message: "Failed to read payload file",
							path,
						});
					}

					return file;
				}),
			writeFile: (path, contents) =>
				Effect.sync(() => {
					writeCalls.push({ contents, path });
					files.set(path, contents);
				}),
		}),
		seedFile: (path: string, contents: string) => {
			files.set(path, contents);
		},
		snapshot: () => ({ files, writeCalls }),
		tag: PayloadRepository,
	};
};

export const makeInMemoryPayloadCrypto = () => {
	const decryptCalls: Array<{
		readonly armoredPayload: string;
		readonly encryptedPrivateKeys: ReadonlyArray<string>;
		readonly passphrase: string;
	}> = [];
	const encryptCalls: Array<{
		readonly envelope: unknown;
		readonly recipients: ReadonlyArray<string>;
	}> = [];
	let decryptedEnvelope: unknown = null;

	return {
		service: PayloadCrypto.make({
			decryptEnvelope: (input) =>
				Effect.sync(() => {
					decryptCalls.push(input);
					if (decryptedEnvelope === null) {
						throw new Error("No decrypted payload envelope was seeded");
					}

					return decryptedEnvelope;
				}),
			encryptEnvelope: ({ envelope, recipients }) =>
				Effect.sync(() => {
					encryptCalls.push({ envelope, recipients });
					return "FAKE-ARMORED-PAYLOAD";
				}),
		}),
		seedDecryptedEnvelope: (envelope: unknown) => {
			decryptedEnvelope = envelope;
		},
		snapshot: () => ({ decryptCalls, encryptCalls }),
		tag: PayloadCrypto,
	};
};
