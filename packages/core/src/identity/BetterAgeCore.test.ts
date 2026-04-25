import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
	encodePublicIdentityString,
	parsePublicIdentityString,
} from "../persistence/ArtifactDocument.js";
import {
	createBetterAgeCore,
	type HomeRepositoryPort,
	type IdentityCryptoPort,
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

const makeHarness = (
	options: {
		readonly generatedPrivateKeys?: ReadonlyArray<PrivateKeyPlaintext>;
		readonly nowValues?: ReadonlyArray<string>;
	} = {},
) => {
	let homeState: unknown | null = null;
	const encryptedKeys = new Map<string, string>();
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

			if (
				key === undefined ||
				!encryptedKey.startsWith(`protected:${passphrase}:`)
			) {
				throw new Error("PASSPHRASE_INCORRECT");
			}

			return key;
		},
	};

	const core = createBetterAgeCore({
		clock: {
			now: async () =>
				nowValues[Math.min(nowIndex++, nowValues.length - 1)] ??
				"2026-04-25T10:00:00.000Z",
		},
		homeRepository,
		identityCrypto,
		randomIds: { nextOwnerId: async () => "owner_123" },
	});

	return { core, encryptedKeys, getHomeState: () => homeState };
};

describe("BetterAgeCore identity lifecycle", () => {
	it("creates self identity and exports a public identity string only", async () => {
		const { core, encryptedKeys, getHomeState } = makeHarness();

		await expect(
			core.commands.createSelfIdentity({
				displayName: "Isaac",
				passphrase: "correct horse",
			}),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "SELF_IDENTITY_CREATED",
				value: {
					ownerId: "owner_123",
					handle: "Isaac#fp_self",
				},
			},
			notices: [],
		});

		expect(getHomeState()).toEqual({
			kind: "better-age/home-state",
			version: 1,
			ownerId: "owner_123",
			displayName: "Isaac",
			identityUpdatedAt: "2026-04-25T10:00:00.000Z",
			currentKey: {
				publicKey: "age1self",
				fingerprint: "fp_self",
				encryptedPrivateKeyRef: "keys/fp_self.age",
				createdAt: "2026-04-25T10:00:00.000Z",
			},
			retiredKeys: [],
			knownIdentities: [],
			preferences: { rotationTtl: "3m" },
		});
		expect(encryptedKeys.get("keys/fp_self.age")).toBe(
			"protected:correct horse:AGE-SECRET-KEY-SELF",
		);

		const exported = await core.queries.exportSelfIdentityString();

		expect(exported.result.kind).toBe("success");
		if (exported.result.kind !== "success") {
			throw new Error("Expected success");
		}

		expect(exported.result.value.publicIdentity).toEqual({
			ownerId: "owner_123",
			displayName: "Isaac",
			publicKey: "age1self",
			identityUpdatedAt: "2026-04-25T10:00:00.000Z",
		});
		expect(exported.result.value.identityString).not.toContain("privateKey");
		expect(exported.result.value.identityString).not.toContain(
			"AGE-SECRET-KEY-SELF",
		);

		const parsed = parsePublicIdentityString(
			exported.result.value.identityString,
		);

		expect(Either.getOrThrow(parsed)).toEqual({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_123",
			displayName: "Isaac",
			publicKey: "age1self",
			identityUpdatedAt: "2026-04-25T10:00:00.000Z",
		});
	});

	it("imports a known identity with alias and lists it without private material", async () => {
		const { core } = makeHarness();
		const teammateIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team",
			displayName: "Sarah",
			publicKey: "age1team",
			identityUpdatedAt: "2026-04-25T11:00:00.000Z",
		});

		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.importKnownIdentity({
				identityString: teammateIdentityString,
				localAlias: "ops",
			}),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "KNOWN_IDENTITY_IMPORTED",
				value: {
					ownerId: "owner_team",
					handle: "ops#age1team",
					outcome: "added",
				},
			},
			notices: [],
		});

		const listed = await core.queries.listKnownIdentities();

		expect(listed).toEqual({
			result: {
				kind: "success",
				code: "KNOWN_IDENTITIES_LISTED",
				value: [
					{
						ownerId: "owner_team",
						publicIdentity: {
							ownerId: "owner_team",
							displayName: "Sarah",
							publicKey: "age1team",
							identityUpdatedAt: "2026-04-25T11:00:00.000Z",
						},
						handle: "ops#age1team",
						fingerprint: "age1team",
						localAlias: "ops",
					},
				],
			},
			notices: [],
		});
		expect(JSON.stringify(listed)).not.toContain("privateKey");
		expect(JSON.stringify(listed)).not.toContain("AGE-SECRET");
	});

	it("rejects self import, invalid alias, and duplicate alias", async () => {
		const { core } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		const selfIdentity = await core.queries.exportSelfIdentityString();
		if (selfIdentity.result.kind !== "success") {
			throw new Error("Expected self export success");
		}
		const teammateIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team",
			displayName: "Sarah",
			publicKey: "age1team",
			identityUpdatedAt: "2026-04-25T11:00:00.000Z",
		});
		const secondTeammateIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team_2",
			displayName: "Nora",
			publicKey: "age1team2",
			identityUpdatedAt: "2026-04-25T12:00:00.000Z",
		});

		await expect(
			core.commands.importKnownIdentity({
				identityString: selfIdentity.result.value.identityString,
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "CANNOT_IMPORT_SELF_IDENTITY" },
		});
		await expect(
			core.commands.importKnownIdentity({
				identityString: teammateIdentityString,
				localAlias: "bad alias",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "LOCAL_ALIAS_INVALID" },
		});

		await core.commands.importKnownIdentity({
			identityString: teammateIdentityString,
			localAlias: "ops",
		});

		await expect(
			core.commands.importKnownIdentity({
				identityString: secondTeammateIdentityString,
				localAlias: "ops",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "LOCAL_ALIAS_DUPLICATE" },
		});
	});
	it("classifies known identity reimport as unchanged, alias-updated, or updated", async () => {
		const { core } = makeHarness();
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		const originalIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team",
			displayName: "Sarah",
			publicKey: "age1team",
			identityUpdatedAt: "2026-04-25T11:00:00.000Z",
		});
		const refreshedIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team",
			displayName: "Sarah",
			publicKey: "age1team-rotated",
			identityUpdatedAt: "2026-04-25T12:00:00.000Z",
		});

		await core.commands.importKnownIdentity({
			identityString: originalIdentityString,
			localAlias: "ops",
		});

		await expect(
			core.commands.importKnownIdentity({
				identityString: originalIdentityString,
				localAlias: "ops",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { outcome: "unchanged" } },
		});
		await expect(
			core.commands.importKnownIdentity({
				identityString: originalIdentityString,
				localAlias: "platform",
			}),
		).resolves.toMatchObject({
			result: { kind: "success", value: { outcome: "alias-updated" } },
		});
		await expect(
			core.commands.importKnownIdentity({
				identityString: originalIdentityString,
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					handle: "platform#age1team",
					outcome: "unchanged",
				},
			},
		});
		await expect(
			core.commands.importKnownIdentity({
				identityString: refreshedIdentityString,
				localAlias: "platform",
			}),
		).resolves.toMatchObject({
			result: {
				kind: "success",
				value: {
					handle: "platform#age1team-rotated",
					outcome: "updated",
				},
			},
		});
	});
	it("lists self and forgets known identity without affecting self", async () => {
		const { core } = makeHarness();
		const teammateIdentityString = encodePublicIdentityString({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_team",
			displayName: "Sarah",
			publicKey: "age1team",
			identityUpdatedAt: "2026-04-25T11:00:00.000Z",
		});
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});
		await core.commands.importKnownIdentity({
			identityString: teammateIdentityString,
			localAlias: "ops",
		});

		await expect(core.queries.getSelfIdentity()).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "SELF_IDENTITY_FOUND",
				value: {
					ownerId: "owner_123",
					publicIdentity: {
						ownerId: "owner_123",
						displayName: "Isaac",
						publicKey: "age1self",
					},
					handle: "Isaac#fp_self",
					fingerprint: "fp_self",
					keyMode: "pq-hybrid",
					rotationTtl: "3m",
				},
			},
		});
		await expect(core.queries.listRetiredKeys()).resolves.toMatchObject({
			result: {
				kind: "success",
				code: "RETIRED_KEYS_LISTED",
				value: [],
			},
		});
		await expect(
			core.commands.forgetKnownIdentity({ ownerId: "owner_team" }),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "KNOWN_IDENTITY_FORGOTTEN",
				value: { ownerId: "owner_team", outcome: "removed" },
			},
			notices: [],
		});
		await expect(
			core.commands.forgetKnownIdentity({ ownerId: "owner_123" }),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "CANNOT_FORGET_SELF_IDENTITY" },
		});
		await expect(core.queries.listKnownIdentities()).resolves.toMatchObject({
			result: { kind: "success", value: [] },
		});
	});

	it("rotates self identity under the same owner id and retires the previous key", async () => {
		const { core, encryptedKeys, getHomeState } = makeHarness({
			generatedPrivateKeys: [privateKey, rotatedPrivateKey],
			nowValues: ["2026-04-25T10:00:00.000Z", "2026-04-25T12:00:00.000Z"],
		});
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "correct horse",
		});

		await expect(
			core.commands.rotateSelfIdentity({ passphrase: "correct horse" }),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "SELF_IDENTITY_ROTATED",
				value: {
					ownerId: "owner_123",
					nextFingerprint: "fp_rotated",
				},
			},
			notices: [],
		});

		expect(getHomeState()).toMatchObject({
			ownerId: "owner_123",
			identityUpdatedAt: "2026-04-25T12:00:00.000Z",
			currentKey: {
				publicKey: "age1selfrotated",
				fingerprint: "fp_rotated",
				encryptedPrivateKeyRef: "keys/fp_rotated.age",
				createdAt: "2026-04-25T12:00:00.000Z",
			},
			retiredKeys: [
				{
					publicKey: "age1self",
					fingerprint: "fp_self",
					encryptedPrivateKeyRef: "keys/fp_self.age",
					retiredAt: "2026-04-25T12:00:00.000Z",
				},
			],
		});
		expect(encryptedKeys.get("keys/fp_rotated.age")).toBe(
			"protected:correct horse:AGE-SECRET-KEY-ROTATED",
		);
		await expect(core.queries.listRetiredKeys()).resolves.toMatchObject({
			result: {
				kind: "success",
				value: [
					{ fingerprint: "fp_self", retiredAt: "2026-04-25T12:00:00.000Z" },
				],
			},
		});
	});

	it("changes passphrase by reencrypting current and retired key blobs", async () => {
		const { core, encryptedKeys } = makeHarness({
			generatedPrivateKeys: [privateKey, rotatedPrivateKey],
			nowValues: ["2026-04-25T10:00:00.000Z", "2026-04-25T12:00:00.000Z"],
		});
		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "old passphrase",
		});
		await core.commands.rotateSelfIdentity({ passphrase: "old passphrase" });

		await expect(
			core.commands.changeIdentityPassphrase({
				currentPassphrase: "old passphrase",
				nextPassphrase: "new passphrase",
			}),
		).resolves.toEqual({
			result: {
				kind: "success",
				code: "PASSPHRASE_CHANGED",
				value: { ownerId: "owner_123" },
			},
			notices: [],
		});

		expect(encryptedKeys.get("keys/fp_self.age")).toBe(
			"protected:new passphrase:AGE-SECRET-KEY-SELF",
		);
		expect(encryptedKeys.get("keys/fp_rotated.age")).toBe(
			"protected:new passphrase:AGE-SECRET-KEY-ROTATED",
		);
	});

	it("returns semantic failures for invalid setup and wrong passphrase", async () => {
		const { core } = makeHarness({
			generatedPrivateKeys: [privateKey, rotatedPrivateKey],
		});

		await expect(
			core.commands.createSelfIdentity({
				displayName: "",
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "SETUP_NAME_INVALID" },
		});

		await core.commands.createSelfIdentity({
			displayName: "Isaac",
			passphrase: "old passphrase",
		});

		await expect(
			core.commands.createSelfIdentity({
				displayName: "Isaac",
				passphrase: "old passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "SETUP_ALREADY_CONFIGURED" },
		});
		await expect(
			core.commands.rotateSelfIdentity({ passphrase: "wrong" }),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PASSPHRASE_INCORRECT" },
		});
		await expect(
			core.commands.changeIdentityPassphrase({
				currentPassphrase: "wrong",
				nextPassphrase: "new passphrase",
			}),
		).resolves.toMatchObject({
			result: { kind: "failure", code: "PASSPHRASE_INCORRECT" },
		});
	});
});
