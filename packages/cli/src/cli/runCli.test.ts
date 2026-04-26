import { describe, expect, it } from "vitest";
import { type CliCore, runCli } from "./runCli.js";
import { CliPromptCancelledError } from "./secretPrompt.js";

const success = <TValue>(code: string, value: TValue) => ({
	result: { kind: "success" as const, code, value },
	notices: [],
});

const failure = (code: string) => ({
	result: { kind: "failure" as const, code, details: undefined },
	notices: [],
});

const knownSarah = {
	ownerId: "owner_sarah",
	publicIdentity: {
		ownerId: "owner_sarah",
		displayName: "Sarah",
		publicKey: "age1sarah",
		identityUpdatedAt: "2026-04-25T11:00:00.000Z",
	},
	handle: "ops#age1sarah",
	fingerprint: "age1sarah",
	localAlias: "ops",
};

const knownNora = {
	ownerId: "owner_nora",
	publicIdentity: {
		ownerId: "owner_nora",
		displayName: "Nora",
		publicKey: "age1nora",
		identityUpdatedAt: "2026-04-25T12:00:00.000Z",
	},
	handle: "Nora#age1nora",
	fingerprint: "age1nora",
	localAlias: null,
};

const decryptedPayload = {
	path: "secrets.env.enc",
	payloadId: "payload_123",
	createdAt: "2026-04-25T10:00:00.000Z",
	lastRewrittenAt: "2026-04-25T11:00:00.000Z",
	schemaVersion: 1,
	compatibility: "up-to-date" as const,
	envText: "API_KEY=secret-value\nDATABASE_URL=postgres://secret\n",
	envKeys: ["API_KEY", "DATABASE_URL"],
	recipients: [
		{
			ownerId: "owner_self",
			displayName: "Isaac",
			publicKey: "age1self",
			identityUpdatedAt: "2026-04-25T10:00:00.000Z",
			handle: "Isaac#fp_self",
			fingerprint: "fp_self",
			localAlias: null,
			isSelf: true,
			isStaleSelf: false,
		},
		{
			ownerId: "owner_sarah",
			displayName: "Sarah",
			publicKey: "age1sarah",
			identityUpdatedAt: "2026-04-25T11:00:00.000Z",
			handle: "ops#age1sarah",
			fingerprint: "age1sarah",
			localAlias: "ops",
			isSelf: false,
			isStaleSelf: false,
		},
	],
};

type CoreOverrides = {
	readonly commands?: Partial<CliCore["commands"]>;
	readonly queries?: Partial<CliCore["queries"]>;
};

const makeCore = (overrides: CoreOverrides = {}) => {
	const calls: Array<{ readonly name: string; readonly input: unknown }> = [];
	const core: CliCore = {
		commands: {
			createSelfIdentity: async (input) => {
				calls.push({ name: "createSelfIdentity", input });
				return success("SELF_IDENTITY_CREATED", {
					ownerId: "owner_self",
					handle: "Isaac#fp_self",
				});
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
					rewriteReasons: ["self-recipient-refresh"],
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
				return success("PASSPHRASE_CHANGED", {
					ownerId: "owner_self",
				});
			},
			setEditorPreference: async (input) => {
				calls.push({ name: "setEditorPreference", input });
				return success("EDITOR_PREFERENCE_SAVED", {
					editorCommand: input.editorCommand,
				});
			},
			forgetKnownIdentity: async (input) => {
				calls.push({ name: "forgetKnownIdentity", input });
				return success("KNOWN_IDENTITY_FORGOTTEN", {
					ownerId: input.ownerId,
					outcome: "removed",
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
			...overrides.commands,
		},
		queries: {
			getEditorPreference: async () =>
				success("EDITOR_PREFERENCE_READ", { editorCommand: null }),
			exportSelfIdentityString: async () =>
				success("SELF_IDENTITY_STRING_EXPORTED", {
					identityString: "bage-id-v1:abc123",
				}),
			getSelfIdentity: async () =>
				success("SELF_IDENTITY_FOUND", {
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
				}),
			listKnownIdentities: async () =>
				success("KNOWN_IDENTITIES_LISTED", [knownSarah, knownNora]),
			listRetiredKeys: async () => success("RETIRED_KEYS_LISTED", []),
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
			decryptPayload: async (input) => {
				calls.push({ name: "decryptPayload", input });
				return success("PAYLOAD_DECRYPTED", decryptedPayload);
			},
			...overrides.queries,
		},
	};

	return { calls, core };
};

describe("runCli command contracts", () => {
	it("runs exact interactive setup with passphrase confirmation on stderr only", async () => {
		const { calls, core } = makeCore();

		const result = await runCli({
			argv: ["setup", "--name", "Isaac"],
			core,
			terminal: {
				mode: "interactive",
				promptSecret: async (label) =>
					label === "Confirm passphrase" ? "correct horse" : "correct horse",
			},
		});

		expect(result).toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Identity created: Isaac#fp_self\n",
		});
		expect(calls).toEqual([
			{
				name: "createSelfIdentity",
				input: { displayName: "Isaac", passphrase: "correct horse" },
			},
		]);
	});

	it("runs guided setup interactively and fails setup headless without prompting", async () => {
		const guided = makeCore();

		await expect(
			runCli({
				argv: ["setup"],
				core: guided.core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					promptText: async () => "Isaac",
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(guided.calls).toEqual([
			{
				name: "createSelfIdentity",
				input: { displayName: "Isaac", passphrase: "correct horse" },
			},
		]);

		const headless = makeCore();
		await expect(
			runCli({
				argv: ["setup", "--name", "Isaac"],
				core: headless.core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(headless.calls).toEqual([]);

		await expect(
			runCli({
				argv: ["setup"],
				core: makeCore().core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] SETUP_NAME_MISSING: pass --name or run setup interactively\n",
		});
	});

	it("retries setup passphrase confirmation before creating identity", async () => {
		const { calls, core } = makeCore();
		const secrets = ["first", "mismatch", "correct horse", "correct horse"];

		await expect(
			runCli({
				argv: ["setup", "--name", "Isaac"],
				core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => secrets.shift() ?? "",
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(calls).toEqual([
			{
				name: "createSelfIdentity",
				input: { displayName: "Isaac", passphrase: "correct horse" },
			},
		]);
	});

	it("maps secret prompt cancellation to command cancellation", async () => {
		const { calls, core } = makeCore();

		await expect(
			runCli({
				argv: ["create", "secrets.env.enc"],
				core,
				payloadPathExists: async () => false,
				terminal: {
					mode: "interactive",
					promptSecret: async () => {
						throw new CliPromptCancelledError();
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 130,
			stdout: "",
			stderr: "[ERROR] CANCELLED: command cancelled\n",
		});
		expect(calls).toEqual([]);
	});

	it("keeps identity export stdout pipe-safe", async () => {
		const { core } = makeCore();

		await expect(
			runCli({
				argv: ["identity", "export"],
				core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "bage-id-v1:abc123\n",
			stderr: "",
		});
	});

	it("imports identity with --alias headless and optional alias retry interactive", async () => {
		const headless = makeCore();

		await expect(
			runCli({
				argv: ["identity", "import", "bage-id-v1:sarah", "--alias", "ops"],
				core: headless.core,
				terminal: { mode: "headless" },
			}),
		).resolves.toMatchObject({ exitCode: 0, stdout: "" });
		expect(headless.calls).toEqual([
			{
				name: "importKnownIdentity",
				input: { identityString: "bage-id-v1:sarah", localAlias: "ops" },
			},
		]);

		let promptCount = 0;
		const interactive = makeCore({
			commands: {
				importKnownIdentity: async (input) => {
					interactive.calls.push({ name: "importKnownIdentity", input });
					return input.localAlias === "ops"
						? failure("LOCAL_ALIAS_DUPLICATE")
						: success("KNOWN_IDENTITY_IMPORTED", {
								ownerId: "owner_sarah",
								handle: "platform#age1sarah",
								outcome: "added",
							});
				},
			},
		});

		await expect(
			runCli({
				argv: ["identity", "import", "bage-id-v1:sarah"],
				core: interactive.core,
				terminal: {
					mode: "interactive",
					promptText: async () => (promptCount++ === 0 ? "ops" : "platform"),
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr:
				"[ERROR] LOCAL_ALIAS_DUPLICATE: alias already exists\n[OK] Identity imported: platform#age1sarah\n",
		});
	});

	it("lists identities for humans and resolves forget refs among known identities", async () => {
		const { calls, core } = makeCore();

		await expect(
			runCli({
				argv: ["identity", "list"],
				core,
				terminal: { mode: "headless" },
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stdout:
				"Self\n  Isaac owner_self fp_self\n\nKnown identities\n  ops owner_sarah age1sarah\n  Nora owner_nora age1nora\n\nRetired keys\n  none\n",
			stderr: "",
		});

		await expect(
			runCli({
				argv: ["identity", "forget", "ops"],
				core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Identity forgotten: owner_sarah\n",
		});
		expect(calls).toEqual([
			{ name: "forgetKnownIdentity", input: { ownerId: "owner_sarah" } },
		]);
	});

	it("inspects payload metadata without rendering plaintext values", async () => {
		const { calls, core } = makeCore();

		const result = await runCli({
			argv: ["inspect", "secrets.env.enc"],
			core,
			payloadPathExists: async () => true,
			terminal: {
				mode: "interactive",
				promptSecret: async () => "correct horse",
			},
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("Payload\n");
		expect(result.stdout).toContain("path: secrets.env.enc");
		expect(result.stdout).toContain("payload id: payload_123");
		expect(result.stdout).toContain("Env keys\n  API_KEY\n  DATABASE_URL\n");
		expect(result.stdout).toContain(
			"Recipients\n  Isaac owner_self fp_self [you]",
		);
		expect(result.stdout).toContain("  ops owner_sarah age1sarah");
		expect(result.stdout).not.toContain("secret-value");
		expect(result.stdout).not.toContain("postgres://secret");
		expect(calls).toEqual([
			{
				name: "decryptPayload",
				input: { path: "secrets.env.enc", passphrase: "correct horse" },
			},
		]);
	});

	it("loads raw env text only after protocol validation", async () => {
		let prompted = false;

		await expect(
			runCli({
				argv: ["load", "secrets.env.enc"],
				core: makeCore().core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => {
						prompted = true;
						return "correct horse";
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 2,
			stdout: "",
			stderr: "[ERROR] LOAD_PROTOCOL_REQUIRED: pass --protocol-version=1\n",
		});
		expect(prompted).toBe(false);

		await expect(
			runCli({
				argv: ["load", "secrets.env.enc", "--protocol-version", "2"],
				core: makeCore().core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => {
						prompted = true;
						return "correct horse";
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] LOAD_PROTOCOL_UNSUPPORTED: supported protocol version is 1\n",
		});

		const core = makeCore({
			queries: {
				decryptPayload: async () => ({
					result: {
						kind: "success",
						code: "PAYLOAD_DECRYPTED",
						value: {
							...decryptedPayload,
							compatibility: "readable-but-outdated",
						},
					},
					notices: [
						{
							level: "warning",
							code: "PAYLOAD_UPDATE_RECOMMENDED",
						},
					],
				}),
			},
		});

		await expect(
			runCli({
				argv: ["load", "secrets.env.enc", "--protocol-version=1"],
				core: core.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: decryptedPayload.envText,
			stderr: "[WARN] Payload update recommended: run bage update\n",
		});
	});

	it("views payload plaintext through secure viewer without stdout", async () => {
		let viewedText = "";

		await expect(
			runCli({
				argv: ["view", "secrets.env.enc"],
				core: makeCore().core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					openViewer: async (envText) => {
						viewedText = envText;
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Viewer closed\n",
		});
		expect(viewedText).toBe(decryptedPayload.envText);
	});

	it("edits payload with cancel, unchanged, invalid retry, and changed save", async () => {
		await expect(
			runCli({
				argv: ["edit", "secrets.env.enc"],
				core: makeCore().core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					openEditor: async () => ({
						kind: "failure",
						code: "EDITOR_EXIT_NON_ZERO",
					}),
				},
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] EDITOR_EXIT_NON_ZERO: editor exited with a non-zero status\n",
		});

		await expect(
			runCli({
				argv: ["edit", "secrets.env.enc"],
				core: makeCore().core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					openEditor: async () => ({ kind: "cancel" }),
				},
			}),
		).resolves.toEqual({
			exitCode: 130,
			stdout: "",
			stderr: "[ERROR] CANCELLED: command cancelled\n",
		});

		const unchanged = makeCore();
		await expect(
			runCli({
				argv: ["edit", "secrets.env.enc"],
				core: unchanged.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					openEditor: async () => ({
						kind: "saved",
						text: decryptedPayload.envText,
					}),
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Payload unchanged: secrets.env.enc\n",
		});
		expect(unchanged.calls).toEqual([
			{
				name: "decryptPayload",
				input: { path: "secrets.env.enc", passphrase: "correct horse" },
			},
		]);

		const changed = makeCore();
		let editorInput = "";
		let editCount = 0;
		await expect(
			runCli({
				argv: ["edit", "secrets.env.enc"],
				core: changed.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					openEditor: async (initialText) => {
						editorInput = initialText;
						editCount++;
						return editCount === 1
							? { kind: "saved", text: "not valid env" }
							: { kind: "saved", text: "API_KEY=new-value\n" };
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr:
				"[ERROR] PAYLOAD_ENV_INVALID: invalid .env content\n[OK] Payload edited: secrets.env.enc\n",
		});
		expect(editorInput).toBe("not valid env");
		expect(changed.calls).toEqual([
			{
				name: "decryptPayload",
				input: { path: "secrets.env.enc", passphrase: "correct horse" },
			},
			{
				name: "editPayload",
				input: {
					path: "secrets.env.enc",
					passphrase: "correct horse",
					editedEnvText: "API_KEY=new-value\n",
				},
			},
		]);
	});

	it("applies payload command mode rules and passphrase retry", async () => {
		const headless = makeCore();
		await expect(
			runCli({
				argv: ["inspect", "secrets.env.enc"],
				core: headless.core,
				payloadPathExists: async () => true,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(headless.calls).toEqual([]);

		let pathPromptCount = 0;
		const guided = makeCore({
			queries: {
				decryptPayload: async (input) => {
					guided.calls.push({ name: "decryptPayload", input });
					return input.passphrase === "correct horse"
						? success("PAYLOAD_DECRYPTED", decryptedPayload)
						: failure("PASSPHRASE_INCORRECT");
				},
			},
		});
		const passphrases = ["wrong", "correct horse"];

		await expect(
			runCli({
				argv: ["inspect"],
				core: guided.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptText: async () => {
						pathPromptCount++;
						return "secrets.env.enc";
					},
					promptSecret: async () => passphrases.shift() ?? "",
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n",
		});
		expect(pathPromptCount).toBe(1);
		expect(guided.calls).toEqual([
			{
				name: "decryptPayload",
				input: { path: "secrets.env.enc", passphrase: "wrong" },
			},
			{
				name: "decryptPayload",
				input: { path: "secrets.env.enc", passphrase: "correct horse" },
			},
		]);
	});

	it("grants exact recipients from known refs, payload refs, and identity strings", async () => {
		const known = makeCore();
		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc", "Nora"],
				core: known.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Recipient granted: Nora#age1nora\n",
		});
		expect(known.calls).toContainEqual({
			name: "grantPayloadRecipient",
			input: {
				path: "secrets.env.enc",
				passphrase: "correct horse",
				recipient: knownNora.publicIdentity,
			},
		});

		const payloadRecipient = makeCore();
		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc", "ops"],
				core: payloadRecipient.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(payloadRecipient.calls).toContainEqual({
			name: "grantPayloadRecipient",
			input: {
				path: "secrets.env.enc",
				passphrase: "correct horse",
				recipient: {
					ownerId: "owner_sarah",
					displayName: "Sarah",
					publicKey: "age1sarah",
					identityUpdatedAt: "2026-04-25T11:00:00.000Z",
				},
			},
		});

		const parsed = makeCore();
		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc", "identity-string-nora"],
				core: parsed.core,
				parseIdentityString: async () => knownNora.publicIdentity,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(parsed.calls).toContainEqual({
			name: "grantPayloadRecipient",
			input: {
				path: "secrets.env.enc",
				passphrase: "correct horse",
				recipient: knownNora.publicIdentity,
			},
		});
	});

	it("renders guided grant picker with disabled self and already granted recipients", async () => {
		const guided = makeCore();
		let options: ReadonlyArray<{
			readonly label: string;
			readonly disabled: boolean;
		}> = [];

		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc"],
				core: guided.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					selectOne: async (_label, choices) => {
						options = choices;
						return "owner_nora";
					},
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(options).toEqual([
			{
				value: "owner_self",
				label: "Isaac owner_self [you]",
				disabled: true,
			},
			{
				value: "owner_sarah",
				label: "ops owner_sarah [granted]",
				disabled: true,
			},
			{
				value: "owner_nora",
				label: "Nora owner_nora",
				disabled: false,
			},
			{
				value: "__custom_identity_string__",
				label: "Enter identity string",
				disabled: false,
			},
		]);
	});

	it("revokes exact and guided recipients while disabling self", async () => {
		const exact = makeCore();
		await expect(
			runCli({
				argv: ["revoke", "secrets.env.enc", "ops"],
				core: exact.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Recipient revoked: owner_sarah\n",
		});
		expect(exact.calls).toContainEqual({
			name: "revokePayloadRecipient",
			input: {
				path: "secrets.env.enc",
				passphrase: "correct horse",
				recipientOwnerId: "owner_sarah",
			},
		});

		const guided = makeCore();
		let options: ReadonlyArray<{
			readonly label: string;
			readonly disabled: boolean;
		}> = [];
		await expect(
			runCli({
				argv: ["revoke", "secrets.env.enc"],
				core: guided.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					selectOne: async (_label, choices) => {
						options = choices;
						return "owner_sarah";
					},
				},
			}),
		).resolves.toMatchObject({ exitCode: 0 });
		expect(options).toEqual([
			{
				value: "owner_self",
				label: "Isaac owner_self [you]",
				disabled: true,
			},
			{
				value: "owner_sarah",
				label: "ops owner_sarah",
				disabled: false,
			},
		]);
	});

	it("updates payload and gates outdated exact and guided write commands", async () => {
		const update = makeCore();
		await expect(
			runCli({
				argv: ["update", "secrets.env.enc"],
				core: update.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Payload updated: secrets.env.enc\n",
		});

		const outdatedPayload = {
			...decryptedPayload,
			compatibility: "readable-but-outdated" as const,
		};
		const exact = makeCore({
			queries: {
				decryptPayload: async (input) => {
					exact.calls.push({ name: "decryptPayload", input });
					return success("PAYLOAD_DECRYPTED", outdatedPayload);
				},
			},
		});
		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc", "Nora"],
				core: exact.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PAYLOAD_UPDATE_REQUIRED: run bage update before mutating payload\n",
		});

		const guided = makeCore({
			queries: {
				decryptPayload: async (input) => {
					guided.calls.push({ name: "decryptPayload", input });
					return success("PAYLOAD_DECRYPTED", outdatedPayload);
				},
			},
		});
		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc"],
				core: guided.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
					selectOne: async (label, choices) => {
						const nora = choices.find(
							(choice) => choice.value === "owner_nora",
						);

						return label === "Payload update required"
							? "update-now"
							: (nora?.value ?? "");
					},
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr:
				"[OK] Payload updated: secrets.env.enc\n[OK] Recipient granted: Nora#age1nora\n",
		});
		expect(guided.calls).toContainEqual({
			name: "updatePayload",
			input: { path: "secrets.env.enc", passphrase: "correct horse" },
		});
		expect(guided.calls).toContainEqual({
			name: "grantPayloadRecipient",
			input: {
				path: "secrets.env.enc",
				passphrase: "correct horse",
				recipient: knownNora.publicIdentity,
			},
		});
	});

	it("applies guided update gate to edit and renders idempotent outcomes as success", async () => {
		const outdatedPayload = {
			...decryptedPayload,
			compatibility: "readable-but-outdated" as const,
		};
		const edit = makeCore({
			queries: {
				decryptPayload: async (input) => {
					edit.calls.push({ name: "decryptPayload", input });
					return success("PAYLOAD_DECRYPTED", outdatedPayload);
				},
			},
		});

		await expect(
			runCli({
				argv: ["edit"],
				core: edit.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptText: async () => "secrets.env.enc",
					promptSecret: async () => "correct horse",
					selectOne: async () => "update-now",
					openEditor: async () => ({
						kind: "saved",
						text: decryptedPayload.envText,
					}),
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr:
				"[OK] Payload updated: secrets.env.enc\n[OK] Payload unchanged: secrets.env.enc\n",
		});

		const idempotent = makeCore({
			commands: {
				grantPayloadRecipient: async (input) => {
					idempotent.calls.push({ name: "grantPayloadRecipient", input });
					return success("PAYLOAD_RECIPIENT_GRANTED", {
						path: input.path,
						payloadId: "payload_123",
						recipient: input.recipient,
						outcome: "unchanged",
					});
				},
				revokePayloadRecipient: async (input) => {
					idempotent.calls.push({ name: "revokePayloadRecipient", input });
					return success("PAYLOAD_RECIPIENT_REVOKED", {
						path: input.path,
						payloadId: "payload_123",
						recipientOwnerId: input.recipientOwnerId,
						outcome: "unchanged",
					});
				},
				updatePayload: async (input) => {
					idempotent.calls.push({ name: "updatePayload", input });
					return success("PAYLOAD_UPDATED", {
						path: input.path,
						payloadId: "payload_123",
						outcome: "unchanged",
						rewriteReasons: [],
					});
				},
			},
		});

		await expect(
			runCli({
				argv: ["grant", "secrets.env.enc", "ops"],
				core: idempotent.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "[OK] Recipient unchanged: Sarah#age1sarah\n",
		});
		await expect(
			runCli({
				argv: ["revoke", "secrets.env.enc", "ops"],
				core: idempotent.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "[OK] Recipient unchanged: owner_sarah\n",
		});
		await expect(
			runCli({
				argv: ["update", "secrets.env.enc"],
				core: idempotent.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "[OK] Payload unchanged: secrets.env.enc\n",
		});
	});

	it("rotates self identity with passphrase retry and update remediation", async () => {
		const rotated = makeCore({
			commands: {
				rotateSelfIdentity: async (input) => {
					rotated.calls.push({ name: "rotateSelfIdentity", input });
					return input.passphrase === "correct horse"
						? success("SELF_IDENTITY_ROTATED", {
								ownerId: "owner_self",
								nextFingerprint: "fp_rotated",
							})
						: failure("PASSPHRASE_INCORRECT");
				},
			},
		});
		const passphrases = ["wrong", "correct horse"];

		await expect(
			runCli({
				argv: ["identity", "rotate"],
				core: rotated.core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => passphrases.shift() ?? "",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n[OK] Identity rotated: fp_rotated\n[WARN] Existing payloads may need update: run bage update\n",
		});
		expect(rotated.calls).toEqual([
			{ name: "rotateSelfIdentity", input: { passphrase: "wrong" } },
			{
				name: "rotateSelfIdentity",
				input: { passphrase: "correct horse" },
			},
		]);

		const headless = makeCore();
		await expect(
			runCli({
				argv: ["identity", "rotate"],
				core: headless.core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(headless.calls).toEqual([]);
	});

	it("changes identity passphrase with current retry and next confirmation retry", async () => {
		const changed = makeCore({
			queries: {
				verifySelfIdentityPassphrase: async (input) => {
					changed.calls.push({
						name: "verifySelfIdentityPassphrase",
						input,
					});
					return input.passphrase === "old passphrase"
						? success("PASSPHRASE_VERIFIED", { ownerId: "owner_self" })
						: failure("PASSPHRASE_INCORRECT");
				},
			},
		});
		const secrets = [
			"wrong",
			"old passphrase",
			"new passphrase",
			"mismatch",
			"new passphrase",
			"new passphrase",
		];

		await expect(
			runCli({
				argv: ["identity", "passphrase"],
				core: changed.core,
				terminal: {
					mode: "interactive",
					promptSecret: async () => secrets.shift() ?? "",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n[ERROR] PASSPHRASE_CONFIRMATION_MISMATCH: passphrase confirmation did not match\n[OK] Passphrase changed\n",
		});
		expect(changed.calls).toEqual([
			{
				name: "verifySelfIdentityPassphrase",
				input: { passphrase: "wrong" },
			},
			{
				name: "verifySelfIdentityPassphrase",
				input: { passphrase: "old passphrase" },
			},
			{
				name: "changeIdentityPassphrase",
				input: {
					currentPassphrase: "old passphrase",
					nextPassphrase: "new passphrase",
				},
			},
		]);

		const headless = makeCore();
		await expect(
			runCli({
				argv: ["identity", "passphrase"],
				core: headless.core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(headless.calls).toEqual([]);
	});

	it("routes the interactive session and i alias through direct command flows", async () => {
		const routed = makeCore();

		await expect(
			runCli({
				argv: ["i"],
				core: routed.core,
				terminal: {
					mode: "interactive",
					selectOne: async () => "identity list",
				},
			}),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "",
			stdout:
				"Self\n  Isaac owner_self fp_self\n\nKnown identities\n  ops owner_sarah age1sarah\n  Nora owner_nora age1nora\n\nRetired keys\n  none\n",
		});

		await expect(
			runCli({
				argv: ["interactive"],
				core: makeCore().core,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] INTERACTIVE_UNAVAILABLE: interactive terminal is unavailable\n",
		});
	});
});

describe("runCli payload read/edit commands", () => {
	it("creates a payload after checking target existence before passphrase prompt", async () => {
		let prompted = false;
		const exists = makeCore();

		await expect(
			runCli({
				argv: ["create", "secrets.env.enc"],
				core: exists.core,
				payloadPathExists: async () => true,
				terminal: {
					mode: "interactive",
					promptSecret: async () => {
						prompted = true;
						return "correct horse";
					},
				},
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr: "[ERROR] PAYLOAD_ALREADY_EXISTS: payload already exists\n",
		});
		expect(prompted).toBe(false);
		expect(exists.calls).toEqual([]);

		const headless = makeCore();
		await expect(
			runCli({
				argv: ["create", "secrets.env.enc"],
				core: headless.core,
				payloadPathExists: async () => false,
				terminal: { mode: "headless" },
			}),
		).resolves.toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(headless.calls).toEqual([]);

		const created = makeCore();
		await expect(
			runCli({
				argv: ["create", "secrets.env.enc"],
				core: created.core,
				payloadPathExists: async () => false,
				terminal: {
					mode: "interactive",
					promptSecret: async () => "correct horse",
				},
			}),
		).resolves.toEqual({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Payload created: secrets.env.enc\n",
		});
		expect(created.calls).toEqual([
			{
				name: "createPayload",
				input: { path: "secrets.env.enc", passphrase: "correct horse" },
			},
		]);
	});
});
