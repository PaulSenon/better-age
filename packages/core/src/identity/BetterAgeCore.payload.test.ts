import { describe, expect, it } from "vitest";
import {
	createBetterAgeCore,
	type HomeRepositoryPort,
	type IdentityCryptoPort,
	type PayloadCryptoPort,
	type PayloadPlaintext,
	type PayloadRepositoryPort,
	type PrivateKeyPlaintext,
} from "./BetterAgeCore.js";

const privateKey = {
	kind: "better-age/private-key",
	version: 1,
	ownerId: "owner_123",
	publicKey: "age1self",
	privateKey: "AGE-SECRET-KEY-SELF",
	fingerprint: "fp_self",
	createdAt: "2026-04-25T10:00:00.000Z",
} satisfies PrivateKeyPlaintext;

const rotatedPrivateKey = {
	kind: "better-age/private-key",
	version: 1,
	ownerId: "owner_123",
	publicKey: "age1selfrotated",
	privateKey: "AGE-SECRET-KEY-ROTATED",
	fingerprint: "fp_rotated",
	createdAt: "2026-04-25T12:00:00.000Z",
} satisfies PrivateKeyPlaintext;

const teammate = {
	ownerId: "owner_team",
	displayName: "Sarah",
	publicKey: "age1team",
	identityUpdatedAt: "2026-04-25T11:00:00.000Z",
};

const makeHarness = (
	options: {
		readonly generatedPrivateKeys?: ReadonlyArray<PrivateKeyPlaintext>;
		readonly nowValues?: ReadonlyArray<string>;
	} = {},
) => {
	let homeState: unknown | null = null;
	const encryptedKeys = new Map<string, string>();
	const payloadFiles = new Map<string, string>();
	const generatedPrivateKeys = options.generatedPrivateKeys ?? [privateKey];
	let generatedPrivateKeyIndex = 0;
	const nowValues = options.nowValues ?? ["2026-04-25T10:00:00.000Z"];
	let nowIndex = 0;

	const homeRepository: HomeRepositoryPort = {
		loadHomeStateDocument: async () => homeState,
		saveCurrentHomeStateDocument: async (document) => {
			homeState = document;
		},
		readEncryptedPrivateKey: async (ref) => encryptedKeys.get(ref) ?? "",
		writeEncryptedPrivateKey: async ({ ref, encryptedKey }) => {
			encryptedKeys.set(ref, encryptedKey);
		},
	};
	const identityCrypto: IdentityCryptoPort = {
		generatePrivateKey: async () =>
			generatedPrivateKeys[
				Math.min(generatedPrivateKeyIndex++, generatedPrivateKeys.length - 1)
			] ?? privateKey,
		protectPrivateKey: async ({ privateKey: key, passphrase }) =>
			`protected:${passphrase}:${key.privateKey}`,
		decryptPrivateKey: async ({ encryptedKey, passphrase }) => {
			const key = [privateKey, rotatedPrivateKey, ...generatedPrivateKeys].find(
				(candidate) => encryptedKey.endsWith(candidate.privateKey),
			);

			if (!encryptedKey.startsWith(`protected:${passphrase}:`)) {
				throw new Error("PASSPHRASE_INCORRECT");
			}

			return key ?? privateKey;
		},
	};
	const payloadRepository: PayloadRepositoryPort = {
		payloadExists: async (path) => payloadFiles.has(path),
		readPayloadFile: async (path) => {
			const contents = payloadFiles.get(path);
			if (contents === undefined) {
				throw new Error("PAYLOAD_NOT_FOUND");
			}

			return contents;
		},
		writePayloadFile: async (path, contents) => {
			payloadFiles.set(path, contents);
		},
	};
	const payloadCrypto: PayloadCryptoPort = {
		encryptPayload: async ({ plaintext }) =>
			[
				"-----BEGIN AGE ENCRYPTED FILE-----",
				`encrypted:${JSON.stringify(plaintext)}`,
				"-----END AGE ENCRYPTED FILE-----",
			].join("\n"),
		decryptPayload: async ({ armoredPayload }) =>
			JSON.parse(
				armoredPayload
					.split("\n")
					.find((line) => line.startsWith("encrypted:"))
					?.slice("encrypted:".length) ?? "null",
			) as unknown,
	};
	const core = createBetterAgeCore({
		clock: {
			now: async () =>
				nowValues[Math.min(nowIndex++, nowValues.length - 1)] ??
				"2026-04-25T10:00:00.000Z",
		},
		homeRepository,
		identityCrypto,
		payloadCrypto,
		payloadRepository,
		randomIds: {
			nextOwnerId: async () => "owner_123",
			nextPayloadId: async () => "payload_123",
		},
	});

	return { core, payloadFiles };
};

describe("BetterAgeCore payload lifecycle", () => {
	it("creates an empty self-recipient payload and decrypts it", async () => {
		const { core, payloadFiles } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.createPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "PAYLOAD_CREATED",
				value: {
					path: ".env.enc",
					payloadId: "payload_123",
				},
			},
			notices: [],
		});
		const writtenPayloadFile = payloadFiles.get(".env.enc");
		expect(writtenPayloadFile).toContain("# better-age encrypted env payload");
		expect(writtenPayloadFile).toContain("-----BEGIN BETTER AGE PAYLOAD-----");
		expect(writtenPayloadFile).toContain("-----BEGIN AGE ENCRYPTED FILE-----");
		expect(writtenPayloadFile).toContain("-----END AGE ENCRYPTED FILE-----");
		expect(writtenPayloadFile).toContain("-----END BETTER AGE PAYLOAD-----");

		await expect(
			core.queries.decryptPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "PAYLOAD_DECRYPTED",
				value: {
					path: ".env.enc",
					payloadId: "payload_123",
					createdAt: "2026-04-25T10:00:00.000Z",
					lastRewrittenAt: "2026-04-25T10:00:00.000Z",
					schemaVersion: 1,
					compatibility: "up-to-date",
					envText: "",
					envKeys: [],
					recipients: [
						{
							ownerId: "owner_123",
							displayName: "Isaac",
							publicKey: "age1self",
							identityUpdatedAt: "2026-04-25T10:00:00.000Z",
							handle: "Isaac#age1self",
							fingerprint: "age1self",
							localAlias: null,
							isSelf: true,
							isStaleSelf: false,
						},
					],
				},
			},
			notices: [],
		});
	});

	it("edits payload env text with validation and unchanged detection", async () => {
		const { core } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		await core.commands.createPayload({
			path: ".env.enc",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.editPayload({
				path: ".env.enc",
				passphrase: "correct horse",
				editedEnvText: "not valid",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_ENV_INVALID" },
		});
		await expect(
			core.commands.editPayload({
				path: ".env.enc",
				passphrase: "correct horse",
				editedEnvText: "",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_EDITED",
				value: { outcome: "unchanged" },
			},
		});
		await expect(
			core.commands.editPayload({
				path: ".env.enc",
				passphrase: "correct horse",
				editedEnvText: "DATABASE_URL=postgres://localhost/app\n",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_EDITED",
				value: { outcome: "edited" },
			},
		});
		await expect(
			core.queries.decryptPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					envText: "DATABASE_URL=postgres://localhost/app\n",
					envKeys: ["DATABASE_URL"],
				},
			},
		});
	});

	it("grants and revokes recipients with self guards and idempotent outcomes", async () => {
		const { core } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		await core.commands.createPayload({
			path: ".env.enc",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.grantPayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipient: {
					ownerId: "owner_123",
					displayName: "Isaac",
					publicKey: "age1self",
					identityUpdatedAt: "2026-04-25T10:00:00.000Z",
				},
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "CANNOT_GRANT_SELF" },
		});
		await expect(
			core.commands.grantPayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipient: teammate,
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_RECIPIENT_GRANTED",
				value: { outcome: "added" },
			},
		});
		await expect(
			core.commands.grantPayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipient: teammate,
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_RECIPIENT_GRANTED",
				value: { outcome: "unchanged", unchangedReason: "already-granted" },
			},
		});

		await expect(
			core.commands.revokePayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipientOwnerId: "owner_123",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "CANNOT_REVOKE_SELF" },
		});
		await expect(
			core.commands.revokePayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipientOwnerId: "owner_team",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_RECIPIENT_REVOKED",
				value: { outcome: "removed" },
			},
		});
		await expect(
			core.commands.revokePayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipientOwnerId: "owner_team",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_RECIPIENT_REVOKED",
				value: {
					outcome: "unchanged",
					unchangedReason: "recipient-not-granted",
				},
			},
		});
	});

	it("warns on stale self recipient, blocks writes, and update refreshes self", async () => {
		const { core } = makeHarness({
			generatedPrivateKeys: [privateKey, rotatedPrivateKey],
			nowValues: [
				"2026-04-25T10:00:00.000Z",
				"2026-04-25T10:00:00.000Z",
				"2026-04-25T12:00:00.000Z",
				"2026-04-25T12:00:00.000Z",
			],
		});
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		await core.commands.createPayload({
			path: ".env.enc",
			passphrase: "correct horse",
		});
		await core.commands.rotateSelfIdentity({ passphrase: "correct horse" });

		await expect(
			core.queries.decryptPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					compatibility: "readable-but-outdated",
					recipients: [{ isSelf: true, isStaleSelf: true }],
				},
			},
			notices: [
				{
					level: "warning",
					code: "PAYLOAD_UPDATE_RECOMMENDED",
					details: {
						path: ".env.enc",
						reasons: ["self-recipient-refresh"],
					},
				},
			],
		});
		await expect(
			core.commands.grantPayloadRecipient({
				path: ".env.enc",
				passphrase: "correct horse",
				recipient: teammate,
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_UPDATE_REQUIRED" },
		});
		await expect(
			core.commands.updatePayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_UPDATED",
				value: {
					outcome: "updated",
					rewriteReasons: ["self-recipient-refresh"],
				},
			},
		});
		await expect(
			core.queries.decryptPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					compatibility: "up-to-date",
					recipients: [{ isSelf: true, isStaleSelf: false }],
				},
			},
			notices: [],
		});
		await expect(
			core.commands.updatePayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_UPDATED",
				value: { outcome: "unchanged", rewriteReasons: [] },
			},
		});
	});

	it("returns semantic payload failures for duplicate create, missing file, and wrong passphrase", async () => {
		const { core } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		await core.commands.createPayload({
			path: ".env.enc",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.createPayload({
				path: ".env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_ALREADY_EXISTS" },
		});
		await expect(
			core.commands.createPayload({
				path: ".env.enc",
				passphrase: "correct horse",
				overwrite: true,
			}),
		).resolves.toMatchObject({
			result: { kind: "success", code: "PAYLOAD_CREATED" },
		});
		await expect(
			core.queries.decryptPayload({
				path: "missing.env.enc",
				passphrase: "correct horse",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_NOT_FOUND" },
		});
		await expect(
			core.queries.decryptPayload({
				path: ".env.enc",
				passphrase: "wrong",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PASSPHRASE_INCORRECT" },
		});
	});

	it("rejects malformed payload file envelopes before decrypting", async () => {
		const { core, payloadFiles } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});

		for (const contents of [
			"not json and not an envelope",
			[
				"-----BEGIN BETTER AGE PAYLOAD-----",
				"not age armor",
				"-----END BETTER AGE PAYLOAD-----",
			].join("\n"),
			[
				"-----BEGIN BETTER AGE PAYLOAD-----",
				"-----BEGIN AGE ENCRYPTED FILE-----",
				"encrypted:{}",
				"-----END AGE ENCRYPTED FILE-----",
				"-----END BETTER AGE PAYLOAD-----",
				"-----BEGIN BETTER AGE PAYLOAD-----",
				"-----BEGIN AGE ENCRYPTED FILE-----",
				"encrypted:{}",
				"-----END AGE ENCRYPTED FILE-----",
				"-----END BETTER AGE PAYLOAD-----",
			].join("\n"),
		]) {
			payloadFiles.set(".env.enc", contents);
			await expect(
				core.queries.decryptPayload({
					path: ".env.enc",
					passphrase: "correct horse",
				}),
			).resolves.toMatchObject({
				result: { kind: "failure", code: "PAYLOAD_INVALID" },
			});
		}
	});
});
