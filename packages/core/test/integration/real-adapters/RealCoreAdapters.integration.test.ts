import {
	chmod,
	mkdtemp,
	readFile,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as age from "age-encryption";
import { afterEach, describe, expect, it } from "vitest";
import { createBetterAgeCore } from "../../../src/identity/BetterAgeCore.js";
import {
	createAgeIdentityCrypto,
	createAgePayloadCrypto,
	createNodeHomeRepository,
	createNodePayloadRepository,
} from "../../../src/infra/RealCoreAdapters.js";

const tempDirs: Array<string> = [];

const makeTempDir = async () => {
	const directory = await mkdtemp(join(tmpdir(), "better-age-core-"));
	tempDirs.push(directory);
	return directory;
};

const permissionBits = async (path: string) => (await stat(path)).mode & 0o777;

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((directory) => rm(directory, { recursive: true })),
	);
});

describe("real core adapters", () => {
	it("stores current home/key/payload files and round-trips through real age crypto", async () => {
		const homeDir = await makeTempDir();
		const payloadPath = join(homeDir, "payload.env.age");
		const core = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			payloadCrypto: createAgePayloadCrypto(),
			payloadRepository: createNodePayloadRepository(),
			randomIds: {
				nextOwnerId: async () => "owner_real",
				nextPayloadId: async () => "payload_real",
			},
		});

		await expect(
			core.commands.createSelfIdentity({
				displayName: "Isaac",
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", code: "SELF_IDENTITY_CREATED" },
		});

		await expect(
			core.commands.createPayload({
				path: payloadPath,
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PAYLOAD_CREATED",
				value: { payloadId: "payload_real" },
			},
		});

		const homeStateJson = await readFile(
			join(homeDir, "home-state.json"),
			"utf8",
		);
		const homeState = JSON.parse(homeStateJson) as {
			readonly currentKey: { readonly encryptedPrivateKeyRef: string };
		};
		const keyBlob = await readFile(
			join(homeDir, homeState.currentKey.encryptedPrivateKeyRef),
			"utf8",
		);
		const keyDecrypter = new age.Decrypter();
		keyDecrypter.addPassphrase("old passphrase");
		const keyPlaintext = await keyDecrypter.decrypt(
			age.armor.decode(keyBlob),
			"text",
		);
		const payloadFile = await readFile(payloadPath, "utf8");

		expect(await permissionBits(homeDir)).toBe(0o700);
		expect(
			await permissionBits(
				join(homeDir, homeState.currentKey.encryptedPrivateKeyRef),
			),
		).toBe(0o600);
		expect(homeStateJson).toContain('"kind":"better-age/home-state"');
		expect(homeState.currentKey.encryptedPrivateKeyRef).toMatch(
			/^keys\/.+\.age$/,
		);
		expect(keyBlob).toContain("BEGIN AGE ENCRYPTED FILE");
		expect(keyPlaintext).toContain("# better-age-key-metadata/v1 ");
		expect(keyPlaintext).toContain("AGE-SECRET-KEY-PQ-1");
		expect(keyPlaintext).not.toContain('"kind":"better-age/private-key"');
		expect(payloadFile).toContain("# better-age encrypted env payload");
		expect(payloadFile).toContain("BEGIN BETTER AGE PAYLOAD");
		expect(payloadFile).toContain("BEGIN AGE ENCRYPTED FILE");
		expect(payloadFile).toContain("END AGE ENCRYPTED FILE");
		expect(payloadFile).toContain("END BETTER AGE PAYLOAD");

		await expect(
			core.commands.editPayload({
				path: payloadPath,
				passphrase: "old passphrase",
				editedEnvText: "API_TOKEN=secret\n",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { outcome: "edited" } },
		});
		await expect(
			core.queries.decryptPayload({
				path: payloadPath,
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: { envText: "API_TOKEN=secret\n", envKeys: ["API_TOKEN"] },
			},
		});
	});

	it("repairs loose home and key permissions before reading local keys", async () => {
		const homeDir = await makeTempDir();
		const core = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			randomIds: {
				nextOwnerId: async () => "owner_real",
				nextPayloadId: async () => "payload_real",
			},
		});

		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "old passphrase",
		});
		const homeState = JSON.parse(
			await readFile(join(homeDir, "home-state.json"), "utf8"),
		) as {
			readonly currentKey: { readonly encryptedPrivateKeyRef: string };
		};
		const keyPath = join(homeDir, homeState.currentKey.encryptedPrivateKeyRef);

		await chmod(homeDir, 0o755);
		await chmod(keyPath, 0o644);

		await expect(
			core.queries.verifySelfIdentityPassphrase({
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			notices: [{ code: "LOCAL_PERMISSIONS_REPAIRED" }],
			result: { kind: "success", code: "PASSPHRASE_VERIFIED" },
		});
		await expect(permissionBits(homeDir)).resolves.toBe(0o700);
		await expect(permissionBits(keyPath)).resolves.toBe(0o600);
	});

	it("recovers an unfinished key transaction before reading local keys", async () => {
		const homeDir = await makeTempDir();
		const core = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			randomIds: {
				nextOwnerId: async () => "owner_real",
				nextPayloadId: async () => "payload_real",
			},
		});

		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "old passphrase",
		});
		const homeState = JSON.parse(
			await readFile(join(homeDir, "home-state.json"), "utf8"),
		) as {
			readonly currentKey: { readonly encryptedPrivateKeyRef: string };
		};
		const keyPath = join(homeDir, homeState.currentKey.encryptedPrivateKeyRef);
		const backupPath = `${keyPath}.bak`;
		const newPath = `${keyPath}.new`;
		const markerPath = join(homeDir, "keys", ".passphrase-change.json");
		const originalKey = await readFile(keyPath, "utf8");

		await writeFile(backupPath, originalKey, { encoding: "utf8", mode: 0o600 });
		await writeFile(keyPath, "broken migrated key", {
			encoding: "utf8",
			mode: 0o600,
		});
		await writeFile(newPath, "leftover new key", {
			encoding: "utf8",
			mode: 0o600,
		});
		await writeFile(
			markerPath,
			JSON.stringify({
				kind: "better-age/key-transaction",
				version: 1,
				entries: [{ ref: homeState.currentKey.encryptedPrivateKeyRef }],
			}),
			{ encoding: "utf8", mode: 0o600 },
		);

		await expect(
			core.queries.verifySelfIdentityPassphrase({
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", code: "PASSPHRASE_VERIFIED" },
		});
		await expect(readFile(keyPath, "utf8")).resolves.toBe(originalKey);
		await expect(stat(markerPath)).rejects.toMatchObject({ code: "ENOENT" });
		await expect(stat(backupPath)).rejects.toMatchObject({ code: "ENOENT" });
		await expect(stat(newPath)).rejects.toMatchObject({ code: "ENOENT" });
	});

	it("proves passphrase change and rotation with real encrypted key blobs", async () => {
		const homeDir = await makeTempDir();
		const payloadPath = join(homeDir, "payload.env.age");
		const core = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			payloadCrypto: createAgePayloadCrypto(),
			payloadRepository: createNodePayloadRepository(),
			randomIds: {
				nextOwnerId: async () => "owner_real",
				nextPayloadId: async () => "payload_real",
			},
		});

		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "old passphrase",
		});
		await core.commands.createPayload({
			path: payloadPath,
			passphrase: "old passphrase",
		});
		await core.commands.editPayload({
			path: payloadPath,
			passphrase: "old passphrase",
			editedEnvText: "API_TOKEN=secret\n",
		});
		await expect(
			core.commands.rotateSelfIdentity({ passphrase: "old passphrase" }),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "SELF_IDENTITY_ROTATED",
				value: { ownerId: "owner_real" },
			},
		});
		await expect(
			core.commands.changeIdentityPassphrase({
				currentPassphrase: "old passphrase",
				nextPassphrase: "new passphrase",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "PASSPHRASE_CHANGED",
				value: { ownerId: "owner_real" },
			},
		});

		await expect(
			core.queries.decryptPayload({
				path: payloadPath,
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PASSPHRASE_INCORRECT" },
		});
		await expect(
			core.queries.decryptPayload({
				path: payloadPath,
				passphrase: "new passphrase",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					envText: "API_TOKEN=secret\n",
					recipients: [{ isSelf: true, isStaleSelf: true }],
				},
			},
		});
		await expect(core.queries.listRetiredKeys()).resolves.toMatchObject({
			result: {
				kind: "success",
				value: [{ fingerprint: expect.any(String) }],
			},
		});
		const homeState = JSON.parse(
			await readFile(join(homeDir, "home-state.json"), "utf8"),
		) as {
			readonly currentKey: { readonly encryptedPrivateKeyRef: string };
			readonly retiredKeys: ReadonlyArray<{
				readonly encryptedPrivateKeyRef: string;
			}>;
		};
		const keyRefs = [
			homeState.currentKey.encryptedPrivateKeyRef,
			...homeState.retiredKeys.map((key) => key.encryptedPrivateKeyRef),
		];

		await expect(
			stat(join(homeDir, "keys", ".passphrase-change.json")),
		).rejects.toMatchObject({ code: "ENOENT" });
		for (const ref of keyRefs) {
			await expect(stat(join(homeDir, `${ref}.bak`))).rejects.toMatchObject({
				code: "ENOENT",
			});
			await expect(stat(join(homeDir, `${ref}.new`))).rejects.toMatchObject({
				code: "ENOENT",
			});
		}
	});

	it("proves grant and revoke with real age recipients", async () => {
		const aliceHomeDir = await makeTempDir();
		const bobHomeDir = await makeTempDir();
		const payloadPath = join(aliceHomeDir, "payload.env.age");
		const alice = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir: aliceHomeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			payloadCrypto: createAgePayloadCrypto(),
			payloadRepository: createNodePayloadRepository(),
			randomIds: {
				nextOwnerId: async () => "owner_alice",
				nextPayloadId: async () => "payload_shared",
			},
		});
		const bob = createBetterAgeCore({
			clock: { now: async () => "2026-04-25T10:00:00.000Z" },
			homeRepository: createNodeHomeRepository({ homeDir: bobHomeDir }),
			identityCrypto: createAgeIdentityCrypto(),
			payloadCrypto: createAgePayloadCrypto(),
			payloadRepository: createNodePayloadRepository(),
			randomIds: {
				nextOwnerId: async () => "owner_bob",
				nextPayloadId: async () => "payload_unused",
			},
		});

		await alice.commands.createSelfIdentity({
			displayName: "Alice",
			passphrase: "alice passphrase",
		});
		await bob.commands.createSelfIdentity({
			displayName: "Bob",
			passphrase: "bob passphrase",
		});
		const bobIdentity = await bob.queries.exportSelfIdentityString();
		if (bobIdentity.result.kind !== "success") {
			throw new Error("Expected Bob identity export to succeed");
		}

		await alice.commands.createPayload({
			path: payloadPath,
			passphrase: "alice passphrase",
		});
		await alice.commands.editPayload({
			path: payloadPath,
			passphrase: "alice passphrase",
			editedEnvText: "TOKEN=shared\n",
		});
		await expect(
			bob.queries.decryptPayload({
				path: payloadPath,
				passphrase: "bob passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_ACCESS_DENIED" },
		});

		await expect(
			alice.commands.grantPayloadRecipient({
				path: payloadPath,
				passphrase: "alice passphrase",
				recipient: bobIdentity.result.value.publicIdentity,
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { outcome: "added" } },
		});
		await expect(
			bob.queries.decryptPayload({
				path: payloadPath,
				passphrase: "bob passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { envText: "TOKEN=shared\n" } },
		});

		await expect(
			alice.commands.revokePayloadRecipient({
				path: payloadPath,
				passphrase: "alice passphrase",
				recipientOwnerId: "owner_bob",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { outcome: "removed" } },
		});
		await expect(
			bob.queries.decryptPayload({
				path: payloadPath,
				passphrase: "bob passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PAYLOAD_ACCESS_DENIED" },
		});
	});
});
