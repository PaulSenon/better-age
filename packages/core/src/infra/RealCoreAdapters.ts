import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as age from "age-encryption";
import { Either, Schema } from "effect";
import type {
	HomeRepositoryPort,
	IdentityCryptoPort,
	PayloadCryptoPort,
	PayloadRepositoryPort,
	PrivateKeyPlaintext,
} from "../identity/BetterAgeCore.js";
import {
	encodeHomeStateDocument,
	encodePayloadPlaintext,
	encodePrivateKeyPlaintext,
	parsePrivateKeyPlaintext,
} from "../persistence/ArtifactDocument.js";

const writeFileAtomically = async (targetPath: string, contents: string) => {
	const tempPath = `${targetPath}.tmp`;
	await mkdir(dirname(targetPath), { recursive: true });
	await writeFile(tempPath, contents, "utf8");
	await rename(tempPath, targetPath);
};

const parseJson = (contents: string): unknown =>
	Schema.decodeUnknownSync(Schema.parseJson(Schema.Unknown))(contents);

const fingerprintFromPublicKey = (publicKey: string): string =>
	`fp_${createHash("sha256").update(publicKey).digest("hex").slice(0, 16)}`;

export const createNodeHomeRepository = (input: {
	readonly homeDir: string;
}): HomeRepositoryPort => {
	const stateFile = join(input.homeDir, "home-state.json");

	return {
		loadHomeStateDocument: async () => {
			try {
				return parseJson(await readFile(stateFile, "utf8"));
			} catch (error) {
				if (
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					error.code === "ENOENT"
				) {
					return null;
				}

				throw error;
			}
		},
		saveCurrentHomeStateDocument: async (document) => {
			await writeFileAtomically(stateFile, encodeHomeStateDocument(document));
		},
		readEncryptedPrivateKey: async (ref) =>
			await readFile(join(input.homeDir, ref), "utf8"),
		writeEncryptedPrivateKey: async ({ ref, encryptedKey }) => {
			await writeFileAtomically(join(input.homeDir, ref), encryptedKey);
		},
	};
};

export const createNodePayloadRepository = (): PayloadRepositoryPort => ({
	payloadExists: async (path) => {
		try {
			await readFile(path, "utf8");
			return true;
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				return false;
			}

			throw error;
		}
	},
	readPayloadFile: async (path) => await readFile(path, "utf8"),
	writePayloadFile: async (path, contents) => {
		await writeFileAtomically(path, contents);
	},
});

export const createAgeIdentityCrypto = (): IdentityCryptoPort => ({
	generatePrivateKey: async ({ ownerId, createdAt }) => {
		const privateKey = await age.generateHybridIdentity();
		const publicKey = await age.identityToRecipient(privateKey);

		return {
			kind: "better-age/private-key",
			version: 1,
			ownerId,
			publicKey,
			privateKey,
			fingerprint: fingerprintFromPublicKey(publicKey),
			createdAt,
		};
	},
	protectPrivateKey: async ({ privateKey, passphrase }) => {
		const encrypter = new age.Encrypter();
		encrypter.setPassphrase(passphrase);
		const encrypted = await encrypter.encrypt(
			encodePrivateKeyPlaintext(privateKey),
		);

		return age.armor.encode(encrypted);
	},
	decryptPrivateKey: async ({ encryptedKey, passphrase }) => {
		const decrypter = new age.Decrypter();
		decrypter.addPassphrase(passphrase);
		const decrypted = await decrypter.decrypt(
			age.armor.decode(encryptedKey),
			"text",
		);
		const parsed = parsePrivateKeyPlaintext(parseJson(decrypted));

		if (Either.isLeft(parsed)) {
			throw new Error("PRIVATE_KEY_INVALID");
		}

		return parsed.right;
	},
});

export const createAgePayloadCrypto = (): PayloadCryptoPort => ({
	encryptPayload: async ({ plaintext, recipients }) => {
		const encrypter = new age.Encrypter();

		for (const recipient of recipients) {
			encrypter.addRecipient(recipient);
		}

		const encrypted = await encrypter.encrypt(
			encodePayloadPlaintext(plaintext),
		);

		return age.armor.encode(encrypted);
	},
	decryptPayload: async ({ armoredPayload, privateKeys }) => {
		const decrypter = new age.Decrypter();

		for (const privateKey of privateKeys) {
			decrypter.addIdentity(privateKey.privateKey);
		}

		const decrypted = await decrypter.decrypt(
			age.armor.decode(armoredPayload),
			"text",
		);

		return parseJson(decrypted);
	},
});
