import { createHash } from "node:crypto";
import {
	chmod,
	mkdir,
	readFile,
	rename,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import * as age from "age-encryption";
import { Either, Schema } from "effect";
import type {
	CoreNotice,
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

const privateDirectoryMode = 0o700;
const privateFileMode = 0o600;

const throwPermissionRepairFailure = (cause: unknown): never => {
	throw new Error("LOCAL_PERMISSION_REPAIR_FAILED", { cause });
};

const modeBits = (mode: number) => mode & 0o777;

const isPrivateDirectoryMode = (mode: number) =>
	(modeBits(mode) & 0o077) === 0 && (modeBits(mode) & 0o700) === 0o700;

const isPrivateFileMode = (mode: number) =>
	(modeBits(mode) & 0o177) === 0 && (modeBits(mode) & 0o600) === 0o600;

const createLocalPermissionNotice = (
	paths: ReadonlyArray<string>,
): CoreNotice => ({
	level: "warning",
	code: "LOCAL_PERMISSIONS_REPAIRED",
	details: { paths },
});

const ensurePrivateDirectory = async (
	path: string,
	recordRepair: (path: string) => void,
) => {
	let existed = true;

	try {
		await stat(path);
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			existed = false;
		} else {
			throw error;
		}
	}

	await mkdir(path, { mode: privateDirectoryMode, recursive: true });

	const directoryStat = await stat(path);

	if (!isPrivateDirectoryMode(directoryStat.mode)) {
		try {
			await chmod(path, privateDirectoryMode);
		} catch (error) {
			throwPermissionRepairFailure(error);
		}

		if (existed) {
			recordRepair(path);
		}
	}
};

const repairExistingPrivateDirectory = async (
	path: string,
	recordRepair: (path: string) => void,
) => {
	let directoryMode: number;

	try {
		directoryMode = (await stat(path)).mode;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return;
		}

		throw error;
	}

	if (isPrivateDirectoryMode(directoryMode)) {
		return;
	}

	try {
		await chmod(path, privateDirectoryMode);
	} catch (error) {
		throwPermissionRepairFailure(error);
	}

	recordRepair(path);
};

const ensurePrivateFile = async (
	path: string,
	recordRepair: (path: string) => void,
) => {
	const fileStat = await stat(path);

	if (isPrivateFileMode(fileStat.mode)) {
		return;
	}

	try {
		await chmod(path, privateFileMode);
	} catch (error) {
		throwPermissionRepairFailure(error);
	}

	recordRepair(path);
};

const writeFileAtomically = async (
	targetPath: string,
	contents: string,
	options: {
		readonly directoryMode?: "private";
		readonly fileMode?: "private";
		readonly recordRepair?: (path: string) => void;
	} = {},
) => {
	const tempPath = `${targetPath}.tmp`;
	const recordRepair = options.recordRepair ?? (() => {});

	if (options.directoryMode === "private") {
		await ensurePrivateDirectory(dirname(targetPath), recordRepair);
	} else {
		await mkdir(dirname(targetPath), { recursive: true });
	}

	await writeFile(
		tempPath,
		contents,
		options.fileMode === "private"
			? { encoding: "utf8", mode: privateFileMode }
			: "utf8",
	);

	if (options.fileMode === "private") {
		await chmod(tempPath, privateFileMode);
	}

	await rename(tempPath, targetPath);

	if (options.fileMode === "private") {
		await chmod(targetPath, privateFileMode);
	}
};

const parseJson = (contents: string): unknown =>
	Schema.decodeUnknownSync(Schema.parseJson(Schema.Unknown))(contents);

const fingerprintFromPublicKey = (publicKey: string): string =>
	`fp_${createHash("sha256").update(publicKey).digest("hex").slice(0, 16)}`;

export const createNodeHomeRepository = (input: {
	readonly homeDir: string;
}): HomeRepositoryPort => {
	const stateFile = join(input.homeDir, "home-state.json");
	let permissionRepairPaths: ReadonlyArray<string> = [];
	const recordPermissionRepair = (path: string) => {
		permissionRepairPaths = [...permissionRepairPaths, path];
	};
	const consumeSecurityNotices = () => {
		const paths = [...new Set(permissionRepairPaths)];
		permissionRepairPaths = [];

		return paths.length === 0 ? [] : [createLocalPermissionNotice(paths)];
	};

	return {
		loadHomeStateDocument: async () => {
			await repairExistingPrivateDirectory(
				input.homeDir,
				recordPermissionRepair,
			);

			let contents: string;

			try {
				contents = await readFile(stateFile, "utf8");
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

			try {
				return parseJson(contents);
			} catch (error) {
				throw new Error("HOME_STATE_INVALID", { cause: error });
			}
		},
		saveCurrentHomeStateDocument: async (document) => {
			await writeFileAtomically(stateFile, encodeHomeStateDocument(document), {
				directoryMode: "private",
				fileMode: "private",
				recordRepair: recordPermissionRepair,
			});
		},
		readEncryptedPrivateKey: async (ref) => {
			await repairExistingPrivateDirectory(
				input.homeDir,
				recordPermissionRepair,
			);
			const keyPath = join(input.homeDir, ref);
			await ensurePrivateFile(keyPath, recordPermissionRepair);

			return await readFile(keyPath, "utf8");
		},
		writeEncryptedPrivateKey: async ({ ref, encryptedKey }) => {
			await writeFileAtomically(join(input.homeDir, ref), encryptedKey, {
				directoryMode: "private",
				fileMode: "private",
				recordRepair: recordPermissionRepair,
			});
		},
		consumeSecurityNotices,
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
