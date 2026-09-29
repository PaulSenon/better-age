import { describe, expect, it } from "vitest";
import {
	CTRL_C,
	makeTestCli,
	passphrase,
	type ScriptedTerminal,
	setupHome,
} from "../support/TestCli.js";

const secret = { secret: () => passphrase } satisfies ScriptedTerminal;

const readyCli = async (text?: string) => {
	const cli = makeTestCli();
	await setupHome(cli);
	await cli.run(["create", ".env.enc"], secret);
	if (text !== undefined) {
		await cli.run(["edit", ".env.enc"], { ...secret, editor: () => text });
	}
	return cli;
};

describe("create", () => {
	it("checks the target before prompting and creates exact paths", async () => {
		const cli = makeTestCli({ files: { "/project/taken.enc": "x" } });
		await setupHome(cli);

		expect(
			await cli.run(["create", "taken.enc"], { interactive: false }),
		).toEqual(
			expect.objectContaining({
				exitCode: 1,
				stderr: "[ERROR] PAYLOAD_ALREADY_EXISTS: payload already exists\n",
				prompts: [],
			}),
		);
		expect(
			await cli.run(["create", "new.enc"], { interactive: false }),
		).toMatchObject({
			exitCode: 1,
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(await cli.run(["create", "new.enc"], secret)).toMatchObject({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Payload created: new.enc\n",
		});
		expect(cli.core.fs.file("/project/new.enc")).toContain(
			"-----BEGIN BETTER AGE PAYLOAD-----",
		);
		expect(cli.core.fs.file("/project/new.enc.tmp")).toBeUndefined();
	});

	it("guides the default path and collision recovery", async () => {
		const cli = makeTestCli();
		await setupHome(cli);

		expect(
			(await cli.run(["create"], { ...secret, text: () => "" })).stderr,
		).toBe("[OK] Payload created: .env.enc\n");

		const renamed = await cli.run(["create"], {
			...secret,
			text: (() => {
				const paths = ["", ".env.prod.enc"];
				return () => paths.shift() ?? "";
			})(),
			select: () => "change-name",
		});
		expect(renamed.stderr).toBe("[OK] Payload created: .env.prod.enc\n");
		expect(renamed.prompts.find((p) => p.kind === "select")).toMatchObject({
			label: "Payload already exists",
			choices: [
				{ value: "override", label: "Override" },
				{ value: "change-name", label: "Change Name" },
				{ value: "cancel", label: "Cancel" },
			],
		});

		expect(
			(
				await cli.run(["create", ".env.enc"], {
					...secret,
					select: () => "override",
				})
			).exitCode,
		).toBe(0);
		expect(
			(await cli.run(["create", ".env.enc"], { select: () => "cancel" }))
				.exitCode,
		).toBe(130);
	});
});

describe("read commands", () => {
	it("loads raw text to stdout only after protocol validation", async () => {
		const cli = await readyCli("API_KEY=secret\n");

		for (const [argv, stderr] of [
			[
				["load", ".env.enc"],
				"[ERROR] LOAD_PROTOCOL_REQUIRED: pass --protocol-version=1\n",
			],
			[
				["load", ".env.enc", "--protocol-version=2"],
				"[ERROR] LOAD_PROTOCOL_UNSUPPORTED: supported protocol version is 1\n",
			],
		] as const) {
			expect(await cli.run(argv, secret)).toEqual({
				exitCode: 2,
				stdout: "",
				stderr,
				prompts: [],
			});
		}

		expect(
			await cli.run(["load", "--protocol-version=1", ".env.enc"], secret),
		).toMatchObject({ exitCode: 0, stdout: "API_KEY=secret\n", stderr: "" });
		expect(
			await cli.run(["load", ".env.enc", "--protocol-version", "1"], {
				interactive: false,
			}),
		).toMatchObject({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(
			await cli.run(["load", "missing.enc", "--protocol-version=1"], secret),
		).toMatchObject({
			exitCode: 1,
			stdout: "",
			stderr: "[ERROR] PAYLOAD_NOT_FOUND: payload not found\n",
			prompts: [],
		});
	});

	it("inspects metadata without printing values", async () => {
		const cli = await readyCli("API_KEY=secret\n# note\nfree text\n");
		const result = await cli.run(["inspect", ".env.enc"], secret);

		expect(result.stdout).toMatch(
			/^Payload\n {2}path: \.env\.enc\n {2}payload id: payload_\S+\n {2}schema version: 1\n {2}compatibility: up-to-date\n\nEnv keys\n {2}API_KEY\n {2}free text\n\nRecipients\n {2}Isaac owner_\S+ \[you\]\n$/,
		);
		expect(result.stdout).not.toContain("secret");
	});

	it("shows plaintext only in the secure viewer", async () => {
		const cli = await readyCli("API_KEY=secret\n");
		let viewed = "";
		const result = await cli.run(["view", ".env.enc"], {
			...secret,
			view: (text) => {
				viewed = text;
			},
		});

		expect(result).toMatchObject({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Viewer closed\n",
		});
		expect(viewed).toBe("API_KEY=secret\n");
	});

	it("retries a wrong passphrase with immediate feedback", async () => {
		const cli = await readyCli("A=1\n");
		const answers = ["wrong one", passphrase];
		const result = await cli.run(["load", ".env.enc", "--protocol-version=1"], {
			secret: () => answers.shift() ?? "",
		});

		expect(result).toMatchObject({
			exitCode: 0,
			stdout: "A=1\n",
			stderr: "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n",
		});
	});

	it("guides missing paths from discovered payloads or free text", async () => {
		const cli = await readyCli("A=1\n");
		await cli.run(["create", ".env.production.enc"], secret);
		cli.core.fs.entries.set("/project/.env.dir.enc", {
			type: "Directory",
			mode: 0o755,
		});

		const picked = await cli.run(["inspect"], {
			...secret,
			select: () => ".env.production.enc",
		});
		expect(picked.exitCode).toBe(0);
		expect(picked.prompts[0]).toEqual({
			kind: "select",
			label: "Payload",
			choices: [
				{ value: ".env.enc", label: ".env.enc" },
				{ value: ".env.production.enc", label: ".env.production.enc" },
				{ value: "enter-path", label: "Enter Path" },
				{ value: "cancel", label: "Cancel" },
			],
		});
		expect(picked.stdout).toContain("path: .env.production.enc");

		const typed = await cli.run(["inspect"], {
			...secret,
			select: () => "enter-path",
			text: () => ".env.enc",
		});
		expect(typed.stdout).toContain("path: .env.enc");
		expect(
			(await cli.run(["inspect"], { select: () => "cancel" })).exitCode,
		).toBe(130);
		expect((await cli.run(["inspect"], { interactive: false })).stderr).toBe(
			"[ERROR] PAYLOAD_PATH_MISSING: pass a payload path or run interactively\n",
		);

		const empty = makeTestCli();
		await setupHome(empty);
		expect(
			(await empty.run(["inspect"], { text: () => "nothing.enc" })).prompts[0],
		).toEqual({ kind: "text", label: "Payload path" });
	});
});

describe("edit", () => {
	// Regression: edited text is saved as-is; there is no .env format gate.
	it("saves arbitrary text on the first editor pass", async () => {
		const cli = await readyCli();
		const text = 'not valid env\n  free = form\n{"json": true}';
		const result = await cli.run(["edit", ".env.enc"], {
			...secret,
			editor: () => text,
		});

		expect(result).toMatchObject({
			exitCode: 0,
			stdout: "",
			stderr: "[OK] Payload edited: .env.enc\n",
		});
		expect(result.prompts.filter((p) => p.kind === "select")).toEqual([]);
		expect(
			(await cli.run(["load", ".env.enc", "--protocol-version=1"], secret))
				.stdout,
		).toBe(text);
	});

	it("reports unchanged edits and editor failures without writing", async () => {
		const cli = await readyCli("A=1\n");
		const before = cli.core.fs.file("/project/.env.enc");

		expect(
			(await cli.run(["edit", ".env.enc"], { ...secret, editor: (t) => t }))
				.stderr,
		).toBe("[OK] Payload unchanged: .env.enc\n");
		expect(
			await cli.run(["edit", ".env.enc"], {
				...secret,
				editor: () => ({ exitCode: 1 }),
			}),
		).toMatchObject({
			exitCode: 1,
			stderr:
				"[ERROR] EDITOR_EXIT_NON_ZERO: editor exited with a non-zero status\n",
		});
		expect(cli.core.fs.file("/project/.env.enc")).toBe(before);
		expect(
			[...cli.core.fs.entries.keys()].filter((path) =>
				path.startsWith("/tmp/"),
			),
		).toEqual([]);
	});

	it("resolves the editor from env, then preference, then a remembered pick", async () => {
		const cli = await readyCli("A=1\n");
		const edit = (terminal: ScriptedTerminal) =>
			cli.run(["edit", ".env.enc"], {
				...secret,
				editor: () => "B=2\n",
				...terminal,
			});

		const fromEnv = await edit({ env: { EDITOR: "vim --clean" } });
		expect(fromEnv.prompts.find((p) => p.kind === "editor")?.label).toMatch(
			/^vim --clean \/tmp\/better-age-edit-\d+\/payload-[\w-]+\.env$/,
		);
		expect((await edit({ env: { VISUAL: "missing-editor" } })).stderr).toBe(
			"[ERROR] EDITOR_UNAVAILABLE: editor is unavailable\n",
		);

		const picked = await edit({
			env: {},
			select: () => "nano",
			confirm: () => true,
		});
		expect(picked.exitCode).toBe(0);
		expect(picked.prompts.find((p) => p.kind === "select")).toMatchObject({
			label: "Editor",
			choices: [
				{ value: "nano", disabled: false },
				{ value: "vi", disabled: true },
				{ value: "vim", disabled: false },
				{ value: "nvim", disabled: true },
			],
		});

		const remembered = await edit({ env: {} });
		expect(remembered.prompts.some((p) => p.kind === "select")).toBe(false);
		expect(remembered.prompts.find((p) => p.kind === "editor")?.label).toMatch(
			/^nano /,
		);
	});

	it("launches the editor attached, with args, on a private temp file", async () => {
		const cli = await readyCli("A=1\n");
		const result = await cli.run(["edit", ".env.enc"], {
			...secret,
			env: { VISUAL: "vim --clean -n", EDITOR: "nano" },
			editor: () => "B=2\n",
		});
		const launched = result.prompts.find((p) => p.kind === "editor");

		expect(launched).toMatchObject({
			label: expect.stringMatching(
				/^vim --clean -n \/tmp\/better-age-edit-\d+\/payload-[\w-]+\.env$/,
			),
			fileMode: 0o600,
			dirMode: 0o700,
			detached: false,
		});
	});

	it("does not remember a declined pick and re-picks when the saved editor is gone", async () => {
		const cli = await readyCli("A=1\n");
		const edit = (terminal: ScriptedTerminal) =>
			cli.run(["edit", ".env.enc"], {
				...secret,
				env: {},
				editor: (t) => t,
				...terminal,
			});

		const declined = await edit({ select: () => "vim", confirm: () => false });
		expect(declined.exitCode).toBe(0);
		expect(
			(await edit({ select: () => "nano", confirm: () => true })).prompts.some(
				(p) => p.kind === "select",
			),
		).toBe(true);

		const savedMissing = await edit({
			installed: ["vim"],
			select: () => "vim",
			confirm: () => false,
		});
		expect(savedMissing.prompts.find((p) => p.kind === "select")).toMatchObject(
			{
				label: "Editor",
			},
		);
		expect(
			savedMissing.prompts.find((p) => p.kind === "editor")?.label,
		).toMatch(/^vim /);
	});

	it("reports editor failure when the editor cannot run", async () => {
		const cli = await readyCli("A=1\n");

		expect(
			(
				await cli.run(["edit", ".env.enc"], {
					...secret,
					editor: () => ({ exitCode: 137 }),
				})
			).stderr,
		).toBe(
			"[ERROR] EDITOR_EXIT_NON_ZERO: editor exited with a non-zero status\n",
		);
	});

	it("aborts on Ctrl-C and still removes the plaintext temp file", async () => {
		const cli = await readyCli("A=1\n");
		const result = await cli.run(["edit", ".env.enc"], {
			secret: () => passphrase,
			env: {},
			select: () => CTRL_C,
		});

		expect(result.exitCode).toBe(130);
		expect(
			[...cli.core.fs.entries.keys()].filter((path) =>
				path.startsWith("/tmp/"),
			),
		).toEqual([]);
	});
});

describe("outdated payloads", () => {
	it("warns on read, gates exact writes, and offers update in guided edit", async () => {
		const cli = await readyCli("A=1\n");
		await cli.run(["identity", "rotate"], secret);

		const read = await cli.run(
			["load", ".env.enc", "--protocol-version=1"],
			secret,
		);
		expect(read).toMatchObject({
			stdout: "A=1\n",
			stderr: "[WARN] Payload update recommended: run bage update\n",
		});
		expect(
			(
				await cli.run(["edit", ".env.enc"], {
					...secret,
					editor: () => "B=2\n",
				})
			).stderr,
		).toBe(
			"[WARN] Payload update recommended: run bage update\n[ERROR] PAYLOAD_UPDATE_REQUIRED: run bage update before mutating payload\n",
		);

		const cancelled = await cli.run(["edit"], {
			...secret,
			select: (label) => (label === "Payload" ? ".env.enc" : "cancel"),
		});
		expect(cancelled.exitCode).toBe(130);
		expect(
			cancelled.prompts.find((p) => p.label === "Payload update required"),
		).toMatchObject({
			choices: [
				{ value: "update-now", label: "Update now" },
				{ value: "back", label: "Back" },
				{ value: "cancel", label: "Cancel" },
			],
		});

		const guided = await cli.run(["edit"], {
			...secret,
			select: (label) => (label === "Payload" ? ".env.enc" : "update-now"),
			editor: () => "B=2\n",
		});
		expect(guided.stderr).toBe(
			"[WARN] Payload update recommended: run bage update\n[OK] Payload updated: .env.enc\n[OK] Payload edited: .env.enc\n",
		);
		expect((await cli.run(["update", ".env.enc"], secret)).stderr).toBe(
			"[OK] Payload unchanged: .env.enc\n",
		);
	});
});
