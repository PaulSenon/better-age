import { describe, expect, it } from "vitest";
import { runCliWithGrammar } from "./commandGrammar.js";
import type { CliCore } from "./runCli.js";

const success = <TValue>(code: string, value: TValue) => ({
	result: { kind: "success" as const, code, value },
	notices: [],
});

const makeCore = () => {
	const calls: Array<{ readonly name: string; readonly input: unknown }> = [];
	const core: CliCore = {
		commands: {
			createSelfIdentity: async (input) => {
				calls.push({ name: "createSelfIdentity", input });
				return success("SELF_IDENTITY_CREATED", { handle: "Isaac#fp_self" });
			},
			createPayload: async (input) => {
				calls.push({ name: "createPayload", input });
				return success("PAYLOAD_CREATED", {
					path: input.path,
					payloadId: "payload_123",
				});
			},
			editPayload: async (input) => {
				calls.push({ name: "editPayload", input });
				return success("PAYLOAD_EDITED", {
					path: input.path,
					payloadId: "payload_123",
					outcome: "edited",
				});
			},
			grantPayloadRecipient: async (input) => {
				calls.push({ name: "grantPayloadRecipient", input });
				return success("PAYLOAD_RECIPIENT_GRANTED", {
					path: input.path,
					payloadId: "payload_123",
					recipient: input.recipient,
					outcome: "added",
				});
			},
			importKnownIdentity: async (input) => {
				calls.push({ name: "importKnownIdentity", input });
				return success("KNOWN_IDENTITY_IMPORTED", {
					ownerId: "owner_sarah",
					handle: `${input.localAlias ?? "Sarah"}#age1sarah`,
					outcome: "added",
				});
			},
			forgetKnownIdentity: async (input) => {
				calls.push({ name: "forgetKnownIdentity", input });
				return success("KNOWN_IDENTITY_FORGOTTEN", { ownerId: input.ownerId });
			},
			revokePayloadRecipient: async (input) => {
				calls.push({ name: "revokePayloadRecipient", input });
				return success("PAYLOAD_RECIPIENT_REVOKED", {
					path: input.path,
					payloadId: "payload_123",
					recipientOwnerId: input.recipientOwnerId,
					outcome: "removed",
				});
			},
			updatePayload: async (input) => {
				calls.push({ name: "updatePayload", input });
				return success("PAYLOAD_UPDATED", {
					path: input.path,
					payloadId: "payload_123",
					outcome: "updated",
					rewriteReasons: [],
				});
			},
			rotateSelfIdentity: async (input) => {
				calls.push({ name: "rotateSelfIdentity", input });
				return success("SELF_IDENTITY_ROTATED", {
					ownerId: "owner_self",
					nextFingerprint: "fp_rotated",
				});
			},
			changeIdentityPassphrase: async (input) => {
				calls.push({ name: "changeIdentityPassphrase", input });
				return success("PASSPHRASE_CHANGED", { ownerId: "owner_self" });
			},
			setEditorPreference: async (input) => {
				calls.push({ name: "setEditorPreference", input });
				return success("EDITOR_PREFERENCE_SAVED", {
					editorCommand: input.editorCommand,
				});
			},
		},
		queries: {
			getEditorPreference: async () =>
				success("EDITOR_PREFERENCE_READ", { editorCommand: null }),
			exportSelfIdentityString: async () =>
				success("SELF_IDENTITY_STRING_EXPORTED", {
					identityString: "bage-id-v1:abc123",
				}),
			decryptPayload: async (input) => {
				calls.push({ name: "decryptPayload", input });
				return success("PAYLOAD_DECRYPTED", {
					path: input.path,
					payloadId: "payload_123",
					createdAt: "2026-04-25T10:00:00.000Z",
					lastRewrittenAt: "2026-04-25T11:00:00.000Z",
					schemaVersion: 1,
					compatibility: "up-to-date" as const,
					envText: "API_KEY=secret\n",
					envKeys: ["API_KEY"],
					recipients: [],
				});
			},
			verifySelfIdentityPassphrase: async (input) => {
				calls.push({ name: "verifySelfIdentityPassphrase", input });
				return success("PASSPHRASE_VERIFIED", { ownerId: "owner_self" });
			},
			getHomeStatus: async () =>
				success("HOME_STATUS_QUERIED", {
					status: "setup" as const,
					self: {
						ownerId: "owner_self",
						publicIdentity: {
							ownerId: "owner_self",
							displayName: "Isaac",
							publicKey: "age1self",
							identityUpdatedAt: "2026-04-25T10:00:00.000Z",
						},
						handle: "Isaac#fp_self",
						fingerprint: "fp_self",
						keyMode: "pq-hybrid",
						createdAt: "2026-04-25T10:00:00.000Z",
						rotationTtl: "3m",
					},
				}),
			getSelfIdentity: async () =>
				success("SELF_IDENTITY_FOUND", {
					ownerId: "owner_self",
					publicIdentity: { displayName: "Isaac" },
					handle: "Isaac#fp_self",
					fingerprint: "fp_self",
					keyMode: "pq-hybrid",
					rotationTtl: "3m",
				}),
			listKnownIdentities: async () => success("KNOWN_IDENTITIES_LISTED", []),
			listRetiredKeys: async () => success("RETIRED_KEYS_LISTED", []),
		},
	};

	return { calls, core };
};

describe("release command grammar", () => {
	it("renders root help with the full release command surface", async () => {
		const { core } = makeCore();

		const result = await runCliWithGrammar({
			argv: ["--help"],
			core,
			terminal: { mode: "headless" },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("USAGE");
		expect(result.stdout).toContain("$ bage");
		for (const command of [
			"create",
			"edit",
			"grant",
			"inspect",
			"load",
			"revoke",
			"update",
			"view",
			"identity",
			"setup",
			"interactive",
			"i",
		]) {
			expect(result.stdout).toContain(command);
		}
	});

	it("renders command help with operands, flags, purpose, and aliases", async () => {
		const { core } = makeCore();

		const loadHelp = await runCliWithGrammar({
			argv: ["load", "--help"],
			core,
			terminal: { mode: "headless" },
		});
		expect(loadHelp).toMatchObject({ exitCode: 0, stderr: "" });
		expect(loadHelp.stdout).toContain("USAGE");
		expect(loadHelp.stdout).toContain("load");
		expect(loadHelp.stdout).toContain("--protocol-version");
		expect(loadHelp.stdout).toContain("Decrypt payload for varlock");

		const passphraseHelp = await runCliWithGrammar({
			argv: ["identity", "passphrase", "--help"],
			core,
			terminal: { mode: "headless" },
		});
		expect(passphraseHelp).toMatchObject({ exitCode: 0, stderr: "" });
		expect(passphraseHelp.stdout).toContain("USAGE");
		expect(passphraseHelp.stdout).toContain("passphrase");
		expect(passphraseHelp.stdout).toContain(
			"Change the identity key passphrase",
		);
	});

	it("maps parse errors to stderr only and exit 2", async () => {
		const { core } = makeCore();

		const result = await runCliWithGrammar({
			argv: ["wat"],
			core,
			terminal: { mode: "headless" },
		});

		expect(result.exitCode).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("COMMAND_PARSE");
		expect(result.stderr).toContain("Invalid subcommand");

		const styled = await runCliWithGrammar({
			argv: ["wat"],
			core,
			terminal: { mode: "interactive", presentation: { color: true } },
		});

		expect(styled.stdout).toBe("");
		expect(styled.stderr).toContain("COMMAND_PARSE");
		expect(styled.stderr).toContain("Invalid subcommand");
	});

	it("delegates grammar-accepted commands to existing flows", async () => {
		const { calls, core } = makeCore();

		const result = await runCliWithGrammar({
			argv: ["identity", "export"],
			core,
			terminal: { mode: "headless" },
		});

		expect(result).toEqual({
			exitCode: 0,
			stdout: "bage-id-v1:abc123\n",
			stderr: "",
		});

		await expect(
			runCliWithGrammar({
				argv: ["identity", "import", "bage-id-v1:sarah", "--trust-key-update"],
				core,
				terminal: { mode: "headless" },
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(calls).toEqual([
			{
				name: "importKnownIdentity",
				input: { identityString: "bage-id-v1:sarah", trustKeyUpdate: true },
			},
		]);
	});

	it("keeps promptable operands optional but protocol operands strict", async () => {
		const { calls, core } = makeCore();

		const guidedGrant = await runCliWithGrammar({
			argv: ["grant"],
			core,
			terminal: { mode: "headless" },
		});
		expect(guidedGrant).toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] PAYLOAD_PATH_MISSING: pass a payload path or run interactively\n",
		});
		expect(calls).toEqual([]);

		const loadWithoutProtocol = await runCliWithGrammar({
			argv: ["load", "secrets.env.enc"],
			core,
			terminal: { mode: "interactive", promptSecret: async () => "secret" },
		});
		expect(loadWithoutProtocol.exitCode).toBe(2);
		expect(loadWithoutProtocol.stdout).toBe("");
		expect(loadWithoutProtocol.stderr).toContain("protocol-version");
		expect(calls).toEqual([]);
	});
});
