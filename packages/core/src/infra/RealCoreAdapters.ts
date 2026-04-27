import { createHash } from "node:crypto";
import {
	chmod,
	mkdir,
	readFile,
	rename,
	rm,
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
const keyTransactionMarkerRef = "keys/.passphrase-change.json";
const privateKeyRefPattern = /^keys\/[A-Za-z0-9._-]+\.age$/;

const throwPermissionRepairFailure = (cause: unknown): never => {
	throw new Error("LOCAL_PERMISSION_REPAIR_FAILED", { cause });
};

const throwKeyTransactionIncomplete = (cause: unknown): never => {
	throw new Error("KEY_TRANSACTION_INCOMPLETE", { cause });
};

const isNotFoundError = (error: unknown) =>
	typeof error === "object" &&
	error !== null &&
	"code" in error &&
	error.code === "ENOENT";

const validatePrivateKeyRef = (ref: string) => {
	if (!privateKeyRefPattern.test(ref)) {
		throw new Error("PRIVATE_KEY_REF_INVALID");
	}
};

const throwLocalKeyMissing = (cause: unknown): never => {
	throw new Error("LOCAL_KEY_MISSING", { cause });
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
		if (isNotFoundError(error)) {
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
		if (isNotFoundError(error)) {
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
	let fileStat: Awaited<ReturnType<typeof stat>>;

	try {
		fileStat = await stat(path);
	} catch (error) {
		if (isNotFoundError(error)) {
			throwLocalKeyMissing(error);
		}

		throw error;
	}

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

type KeyTransactionMarker = {
	readonly kind: "better-age/key-transaction";
	readonly version: 1;
	readonly entries: ReadonlyArray<{ readonly ref: string }>;
};

const parseKeyTransactionMarker = (contents: string): KeyTransactionMarker => {
	const parsed = parseJson(contents);

	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("kind" in parsed) ||
		parsed.kind !== "better-age/key-transaction" ||
		!("version" in parsed) ||
		parsed.version !== 1 ||
		!("entries" in parsed) ||
		!Array.isArray(parsed.entries) ||
		!parsed.entries.every(
			(entry) =>
				typeof entry === "object" &&
				entry !== null &&
				"ref" in entry &&
				typeof entry.ref === "string",
		)
	) {
		throw new Error("Invalid key transaction marker");
	}

	return parsed as KeyTransactionMarker;
};

const transactionPaths = (homeDir: string, ref: string) => {
	const stablePath = join(homeDir, ref);

	return {
		backupPath: `${stablePath}.bak`,
		newPath: `${stablePath}.new`,
		stablePath,
	};
};

const recoverKeyTransaction = async (input: {
	readonly homeDir: string;
	readonly recordRepair: (path: string) => void;
}) => {
	const markerPath = join(input.homeDir, keyTransactionMarkerRef);
	let markerContents: string;

	try {
		markerContents = await readFile(markerPath, "utf8");
	} catch (error) {
		if (isNotFoundError(error)) {
			return;
		}

		throw error;
	}

	try {
		const marker = parseKeyTransactionMarker(markerContents);

		for (const entry of marker.entries) {
			validatePrivateKeyRef(entry.ref);
			const { backupPath, newPath, stablePath } = transactionPaths(
				input.homeDir,
				entry.ref,
			);

			try {
				await rename(backupPath, stablePath);
				await chmod(stablePath, privateFileMode);
			} catch (error) {
				if (!isNotFoundError(error)) {
					throw error;
				}
			}

			await rm(newPath, { force: true });
		}

		await rm(markerPath, { force: true });
	} catch (error) {
		throwKeyTransactionIncomplete(error);
	}

	await repairExistingPrivateDirectory(input.homeDir, input.recordRepair);
};

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
			await recoverKeyTransaction({
				homeDir: input.homeDir,
				recordRepair: recordPermissionRepair,
			});
			await repairExistingPrivateDirectory(
				input.homeDir,
				recordPermissionRepair,
			);

			let contents: string;

			try {
				contents = await readFile(stateFile, "utf8");
			} catch (error) {
				if (isNotFoundError(error)) {
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
			validatePrivateKeyRef(ref);
			await recoverKeyTransaction({
				homeDir: input.homeDir,
				recordRepair: recordPermissionRepair,
			});
			await repairExistingPrivateDirectory(
				input.homeDir,
				recordPermissionRepair,
			);
			const keyPath = join(input.homeDir, ref);
			await ensurePrivateFile(keyPath, recordPermissionRepair);

			try {
				return await readFile(keyPath, "utf8");
			} catch (error) {
				if (isNotFoundError(error)) {
					throwLocalKeyMissing(error);
				}

				throw error;
			}
		},
		writeEncryptedPrivateKey: async ({ ref, encryptedKey }) => {
			validatePrivateKeyRef(ref);
			await writeFileAtomically(join(input.homeDir, ref), encryptedKey, {
				directoryMode: "private",
				fileMode: "private",
				recordRepair: recordPermissionRepair,
			});
		},
		replaceEncryptedPrivateKeys: async ({ keys }) => {
			for (const key of keys) {
				validatePrivateKeyRef(key.ref);
			}

			await recoverKeyTransaction({
				homeDir: input.homeDir,
				recordRepair: recordPermissionRepair,
			});
			const markerPath = join(input.homeDir, keyTransactionMarkerRef);

			try {
				await ensurePrivateDirectory(
					dirname(markerPath),
					recordPermissionRepair,
				);

				for (const key of keys) {
					const { newPath } = transactionPaths(input.homeDir, key.ref);
					await writeFileAtomically(newPath, key.encryptedKey, {
						directoryMode: "private",
						fileMode: "private",
						recordRepair: recordPermissionRepair,
					});
				}

				await writeFile(
					markerPath,
					JSON.stringify({
						entries: keys.map((key) => ({ ref: key.ref })),
						kind: "better-age/key-transaction",
						version: 1,
					}),
					{ encoding: "utf8", mode: privateFileMode },
				);
				await chmod(markerPath, privateFileMode);

				for (const key of keys) {
					const { backupPath, newPath, stablePath } = transactionPaths(
						input.homeDir,
						key.ref,
					);

					await rename(stablePath, backupPath);
					await rename(newPath, stablePath);
					await chmod(stablePath, privateFileMode);
				}

				await rm(markerPath, { force: true });

				await Promise.all(
					keys.map(async (key) => {
						const { backupPath } = transactionPaths(input.homeDir, key.ref);
						await rm(backupPath, { force: true }).catch(() => undefined);
					}),
				);
			} catch (error) {
				try {
					await recoverKeyTransaction({
						homeDir: input.homeDir,
						recordRepair: recordPermissionRepair,
					});
					await Promise.all(
						keys.map(async (key) => {
							const { newPath } = transactionPaths(input.homeDir, key.ref);
							await rm(newPath, { force: true });
						}),
					);
				} catch (recoveryError) {
					throwKeyTransactionIncomplete(recoveryError);
				}

				throw error;
			}
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
		const tempPath = `${path}.tmp`;

		await mkdir(dirname(path), { recursive: true });

		try {
			await writeFile(tempPath, contents, "utf8");
			await rename(tempPath, path);
		} catch (error) {
			await rm(tempPath, { force: true }).catch(() => undefined);
			throw error;
		}
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
		const parsed = parsePrivateKeyPlaintext(decrypted);

		if (Either.isLeft(parsed)) {
			throw new Error("PRIVATE_KEY_INVALID");
		}

		let publicKey: string;

		try {
			publicKey = await age.identityToRecipient(parsed.right.privateKey);
		} catch (cause) {
			throw new Error("PRIVATE_KEY_INVALID", { cause });
		}

		if (
			publicKey !== parsed.right.publicKey ||
			fingerprintFromPublicKey(publicKey) !== parsed.right.fingerprint
		) {
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
