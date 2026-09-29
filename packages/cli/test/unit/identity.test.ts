import { describe, expect, it } from "vitest";
import {
	CTRL_C,
	makeTestCli,
	otherIdentityString,
	passphrase,
	setupHome,
} from "../support/TestCli.js";

const queue =
	<A>(...values: ReadonlyArray<A>) =>
	() => {
		const [next, ...rest] = values;
		values = rest;
		return next as A;
	};

describe("setup", () => {
	it("creates the identity with confirmation, reporting on stderr only", async () => {
		const cli = makeTestCli();
		const result = await cli.run(["setup", "--name", "Isaac"], {
			secret: () => passphrase,
		});

		expect(result).toMatchObject({ exitCode: 0, stdout: "" });
		expect(result.stderr).toMatch(
			/^\[OK\] Identity created: Isaac#fp_[0-9a-f]{16}\n$/,
		);
		expect(result.prompts).toEqual([
			{ kind: "secret", label: "Passphrase" },
			{ kind: "secret", label: "Confirm passphrase" },
		]);
		expect(
			(
				await cli.run(["setup", "--name", "Again"], {
					secret: () => passphrase,
				})
			).stderr,
		).toBe("[ERROR] SETUP_ALREADY_CONFIGURED: identity is already set up\n");
	});

	it("guides the name interactively and never prompts headless", async () => {
		const guided = await makeTestCli().run(["setup"], {
			text: () => "Isaac",
			secret: () => passphrase,
		});
		expect(guided.exitCode).toBe(0);
		expect(guided.prompts[0]).toEqual({ kind: "text", label: "Display name" });

		expect(await makeTestCli().run(["setup"], { interactive: false })).toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] SETUP_NAME_MISSING: pass --name or run setup interactively\n",
			prompts: [],
		});
		expect(
			await makeTestCli().run(["setup", "--name", "Isaac"], {
				interactive: false,
			}),
		).toMatchObject({
			exitCode: 1,
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
			prompts: [],
		});
	});

	it("rejects short passphrases and retries mismatched confirmations", async () => {
		const retried = await makeTestCli().run(["setup", "--name", "Isaac"], {
			secret: queue(
				"short",
				"correct horse",
				"different",
				passphrase,
				passphrase,
			),
		});
		expect(retried.exitCode).toBe(0);
		expect(retried.stderr).toMatch(
			/^\[ERROR\] PASSPHRASE_TOO_SHORT: passphrase must be at least 8 characters\n\[ERROR\] PASSPHRASE_CONFIRMATION_MISMATCH: passphrase confirmation did not match\n\[OK\] Identity created/,
		);

		const cli = makeTestCli();
		expect(
			await cli.run(["setup", "--name", "Isaac"], { secret: () => "short" }),
		).toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(
				/\[ERROR\] PASSPHRASE_TOO_SHORT: passphrase must be at least 8 characters\n$/,
			),
		});
		expect((await cli.run(["identity", "export"])).exitCode).toBe(1);
	});

	it("treats Ctrl-C in a prompt as cancellation with exit 130", async () => {
		expect(
			await makeTestCli().run(["setup", "--name", "Isaac"], {
				secret: () => CTRL_C,
			}),
		).toMatchObject({
			exitCode: 130,
			stdout: "",
			stderr: "[ERROR] CANCELLED: command cancelled\n",
		});
	});

	it("renders corrupt local state as a typed failure without a stack", async () => {
		const cli = makeTestCli({
			files: { "/home/user/.better-age/home-state.json": "{corrupt" },
		});

		expect(await cli.run(["identity", "export"])).toMatchObject({
			exitCode: 1,
			stdout: "",
			// The fixture home dir is 0755, so the repair notice is shown too.
			stderr:
				"[WARN] Local file permissions repaired\n[ERROR] HOME_STATE_INVALID: local home state is invalid\n",
		});
	});
});

describe("identity export / keys / list", () => {
	it("keeps identity export stdout pipe-safe", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		const result = await cli.run(["identity", "export"], {
			interactive: false,
		});

		expect(result.stderr).toBe("");
		expect(result.stdout).toMatch(/^better-age:\/\/identity\/v1\/[\w-]+\n$/);
	});

	it("lists key files for age interop", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "rotate"], { secret: () => passphrase });

		const paths = await cli.run(["identity", "keys", "--current", "--path"]);
		expect(paths.stderr).toBe("");
		expect(paths.stdout).toMatch(
			/^\/home\/user\/\.better-age\/keys\/fp_\w+\.age\n$/,
		);

		const listing = await cli.run(["identity", "keys"]);
		expect(listing.stdout).toMatch(
			/^Current key\n {2}fp_\w+ {2}\/home\/user\/\.better-age\/keys\/fp_\w+\.age\n\nRetired keys\n {2}fp_\w+ {2}\S+ {2}\/home\/user\/\.better-age\/keys\/fp_\w+\.age\n$/,
		);
		expect(
			(await cli.run(["identity", "keys", "--retired", "--path"])).stdout.split(
				"\n",
			),
		).toHaveLength(2);
		expect(
			await cli.run(["identity", "keys", "--current", "--retired"]),
		).toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] COMMAND_PARSE: choose --current or --retired, not both\n",
			prompts: [],
		});
	});

	it("rotates with passphrase retry and update remediation", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		const result = await cli.run(["identity", "rotate"], {
			secret: queue("wrong passphrase", passphrase),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toMatch(
			/^\[ERROR\] PASSPHRASE_INCORRECT: invalid passphrase, try again\n\[OK\] Identity rotated: fp_\w+\n\[WARN\] Existing payloads may need update: run bage update\n$/,
		);
		expect(
			await cli.run(["identity", "rotate"], {
				secret: () => "wrong passphrase",
			}),
		).toMatchObject({
			exitCode: 1,
			stderr: expect.stringMatching(
				/^(\[ERROR\] PASSPHRASE_INCORRECT: invalid passphrase, try again\n){2}\[ERROR\] PASSPHRASE_INCORRECT: invalid passphrase\n$/,
			),
		});
		expect(
			(await cli.run(["identity", "rotate"], { interactive: false })).stderr,
		).toBe("[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n");
	});

	it("changes the passphrase with current retry and confirmation", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		// `pw` and `pass` are aliases of `identity passphrase`.
		const changed = await cli.run(["identity", "pw"], {
			secret: queue(
				"wrong passphrase",
				passphrase,
				"new passphrase",
				"typo passphrase",
				"new passphrase",
				"new passphrase",
			),
		});

		expect(changed.exitCode).toBe(0);
		expect(changed.prompts.map((prompt) => prompt.label)).toEqual([
			"Current passphrase",
			"Current passphrase",
			"New passphrase",
			"Confirm passphrase",
			"New passphrase",
			"Confirm passphrase",
		]);
		expect(changed.stderr.endsWith("[OK] Passphrase changed\n")).toBe(true);
		expect(
			(
				await cli.run(["identity", "pass"], {
					secret: queue(
						"new passphrase",
						"third passphrase",
						"third passphrase",
					),
				})
			).stderr,
		).toBe("[OK] Passphrase changed\n");
		expect(
			(
				await cli.run(["identity", "rotate"], {
					secret: () => "third passphrase",
				})
			).exitCode,
		).toBe(0);
		expect(
			(
				await cli.run(["identity", "passphrase"], {
					secret: queue("third passphrase", "short", "short", "short"),
				})
			).stderr,
		).toMatch(
			/PASSPHRASE_TOO_SHORT: passphrase must be at least 8 characters\n$/,
		);
	});
});

describe("identity import / list / forget", () => {
	it("imports headless with --alias and lists without key material", async () => {
		const sarah = await otherIdentityString("Sarah");
		const cli = makeTestCli();
		await setupHome(cli);

		const imported = await cli.run(
			["identity", "import", sarah, "--alias", "ops"],
			{ interactive: false },
		);
		expect(imported.exitCode).toBe(0);
		expect(imported.stderr).toMatch(
			/^\[OK\] Identity imported: ops#fp_\w{16}\n$/,
		);

		const list = await cli.run(["identity", "list"]);
		expect(list.stdout).toMatch(
			/^Self\n {2}Isaac owner_\S+ \[you\]\n\nKnown identities\n {2}ops \(Sarah\) owner_\S+\n\nRetired keys\n {2}none\n$/,
		);
		expect(list.stdout).not.toContain("age1");

		expect(
			await cli.run(["identity", "import"], { interactive: false }),
		).toMatchObject({
			exitCode: 2,
			stderr:
				"[ERROR] IDENTITY_STRING_MISSING: pass an identity string or run interactively\n",
		});
	});

	it("re-prompts invalid guided strings and duplicate aliases", async () => {
		const sarah = await otherIdentityString("Sarah");
		const nora = await otherIdentityString("Nora");
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "import", sarah, "--alias", "ops"]);

		const result = await cli.run(["identity", "import"], {
			text: queue("not-an-identity", "", nora, "ops", nora, "nora"),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toMatch(
			/^\[ERROR\] IDENTITY_STRING_INVALID: identity string is invalid\n\[ERROR\] LOCAL_ALIAS_DUPLICATE: alias already exists\n\[OK\] Identity imported: nora#fp_\w+\n$/,
		);
	});

	it("requires explicit trust for a changed key of a known owner", async () => {
		const other = makeTestCli();
		await setupHome(other, "Sarah");
		const before = (await other.run(["identity", "export"])).stdout.trim();
		await other.run(["identity", "rotate"], { secret: () => passphrase });
		const after = (await other.run(["identity", "export"])).stdout.trim();
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "import", before, "--alias", "sarah"]);

		expect(
			await cli.run(["identity", "import", after], { interactive: false }),
		).toMatchObject({
			exitCode: 1,
			stderr:
				"[ERROR] IDENTITY_KEY_UPDATE_REQUIRES_TRUST: identity key update requires explicit trust\n",
		});

		const declined = await cli.run(
			["identity", "import", after, "--alias", "sarah"],
			{
				confirm: () => false,
			},
		);
		expect(declined).toMatchObject({
			exitCode: 1,
			stderr: "[ERROR] CANCELLED: command cancelled\n",
		});
		expect(declined.prompts).toEqual([
			{
				kind: "confirm",
				label: expect.stringMatching(
					/^Trust identity key update fp_\w+ -> fp_\w+\?$/,
				),
			},
		]);

		expect(
			(
				await cli.run(["identity", "import", after, "--alias", "sarah"], {
					confirm: () => true,
				})
			).stderr,
		).toMatch(/^\[OK\] Identity imported: sarah#fp_\w+\n$/);
		expect(
			(
				await cli.run(
					[
						"identity",
						"import",
						before,
						"--alias",
						"sarah",
						"--trust-key-update",
					],
					{ interactive: false },
				)
			).exitCode,
		).toBe(0);
	});

	it("re-prompts an invalid guided alias", async () => {
		const sarah = await otherIdentityString("Sarah");
		const cli = makeTestCli();
		await setupHome(cli);
		const aliases = ["1-bad", "ops"];

		const result = await cli.run(["identity", "import", sarah], {
			text: () => aliases.shift() ?? "",
		});
		expect(result.stderr).toMatch(
			/^\[ERROR\] LOCAL_ALIAS_INVALID: alias is invalid\n\[OK\] Identity imported: ops#fp_\w+\n$/,
		);
	});

	it("forgets by reference or through a picker of known identities only", async () => {
		const sarah = await otherIdentityString("Sarah");
		const nora = await otherIdentityString("Nora");
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["identity", "import", sarah, "--alias", "ops"]);
		await cli.run(["identity", "import", nora], { text: () => "" });

		const picked = await cli.run(["identity", "forget"], {
			select: (_label, choices) => choices[1]?.value ?? "",
		});
		expect(picked.exitCode).toBe(0);
		const picker = picked.prompts[0];
		expect(
			picker?.kind === "select" && picker.choices.map((c) => c.label),
		).toEqual([
			expect.stringMatching(/^ops \(Sarah\) owner_\S+$/),
			expect.stringMatching(/^Nora owner_\S+$/),
			"Cancel",
		]);

		expect(await cli.run(["identity", "forget", "ops"])).toMatchObject({
			exitCode: 0,
			stderr: expect.stringMatching(/^\[OK\] Identity forgotten: owner_\S+\n$/),
		});
		expect((await cli.run(["identity", "forget", "ops"])).stderr).toBe(
			"[ERROR] IDENTITY_REFERENCE_NOT_FOUND: identity reference not found\n",
		);
		expect(
			(await cli.run(["identity", "forget"], { select: () => "cancel" }))
				.exitCode,
		).toBe(130);
		expect(
			await cli.run(["identity", "forget"], { interactive: false }),
		).toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] IDENTITY_REFERENCE_MISSING: pass an identity reference or run interactively\n",
			prompts: [],
		});
	});
});
