import { describe, expect, it } from "vitest";
import { type CliCore, runCli } from "./runCli.js";

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
				success("KNOWN_IDENTITIES_LISTED", [knownSarah]),
			listRetiredKeys: async () => success("RETIRED_KEYS_LISTED", []),
			...overrides.queries,
		},
	};

	return { calls, core };
};

describe("runCli identity commands", () => {
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
				"Self\n  Isaac owner_self fp_self\n\nKnown identities\n  ops owner_sarah age1sarah\n\nRetired keys\n  none\n",
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
});
