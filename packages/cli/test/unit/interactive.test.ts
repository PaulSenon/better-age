import { describe, expect, it } from "vitest";
import {
	CTRL_C,
	makeTestCli,
	type PromptEvent,
	passphrase,
	setupHome,
} from "../support/TestCli.js";

const menusOf = (prompts: ReadonlyArray<PromptEvent>) =>
	prompts
		.filter((prompt) => prompt.kind === "select" && prompt.label === "Command")
		.map((prompt) =>
			prompt.kind === "select"
				? prompt.choices.map((choice) => choice.value)
				: [],
		);

const script = (...values: ReadonlyArray<string | typeof CTRL_C>) => {
	const queue = [...values];
	return () => queue.shift() ?? "quit";
};

const filesMenu = [
	"create",
	"edit",
	"grant",
	"inspect",
	"revoke",
	"update",
	"view",
	"back",
	"quit",
];
const identitiesMenu = [
	"identity export",
	"identity import",
	"identity list",
	"identity keys",
	"identity forget",
	"identity passphrase",
	"identity rotate",
	"back",
	"quit",
];

describe("interactive session", () => {
	it("offers only setup before setup, then the normal menus", async () => {
		const cli = makeTestCli();
		const result = await cli.run(["i"], {
			select: script("setup", "quit"),
			text: () => "Isaac",
			secret: () => passphrase,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toMatch(/^\[OK\] Identity created: Isaac#fp_\w+\n$/);
		expect(menusOf(result.prompts)).toEqual([
			["setup", "quit"],
			["files", "identities", "quit"],
		]);
	});

	it("routes submenus with back navigation and never offers load", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["create", ".env.enc"], { secret: () => passphrase });
		let viewed = false;

		const result = await cli.run(["interactive"], {
			select: script(
				"identities",
				"identity list",
				"back",
				"files",
				"view",
				".env.enc",
			),
			secret: () => passphrase,
			view: () => {
				viewed = true;
			},
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toMatch(/^Self\n {2}Isaac owner_\S+ \[you\]\n/);
		expect(result.stderr).toBe("[OK] Viewer closed\n");
		expect(viewed).toBe(true);
		expect(menusOf(result.prompts)).toEqual([
			["files", "identities", "quit"],
			identitiesMenu,
			identitiesMenu,
			["files", "identities", "quit"],
			filesMenu,
			filesMenu,
		]);
		expect(menusOf(result.prompts).flat()).not.toContain("load");
		expect(menusOf(result.prompts).flat()).not.toContain("interactive");
	});

	it("pauses after primary stdout screens only", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		const result = await cli.run(["i"], {
			select: script("identities", "identity export", "identity rotate"),
			secret: () => passphrase,
		});

		expect(result.stdout).toMatch(/^better-age:\/\/identity\/v1\/\S+\n$/);
		expect(
			result.prompts.filter((prompt) => prompt.kind === "pause").length,
		).toBe(1);
	});

	it("shows a failing command's error and returns to the menu", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["create", ".env.enc"], { secret: () => passphrase });
		const result = await cli.run(["i"], {
			select: script("files", "inspect", "cancel", "inspect", "enter-path"),
			text: () => "missing.enc",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe(
			"[ERROR] CANCELLED: command cancelled\n[ERROR] PAYLOAD_NOT_FOUND: payload not found\n",
		);
		expect(menusOf(result.prompts)).toHaveLength(4);
	});

	it("treats Ctrl-C as abort (exit 130), never as back", async () => {
		const cli = makeTestCli();
		await setupHome(cli);
		await cli.run(["create", ".env.enc"], { secret: () => passphrase });

		const cases: ReadonlyArray<ReadonlyArray<string | typeof CTRL_C>> = [
			[CTRL_C],
			["files", CTRL_C],
			["files", "inspect", CTRL_C],
		];
		for (const selections of cases) {
			expect(
				await cli.run(["i"], { select: script(...selections) }),
			).toMatchObject({
				exitCode: 130,
				stdout: "",
				stderr: "[ERROR] CANCELLED: command cancelled\n",
			});
		}
	});

	it("is unavailable without an interactive terminal", async () => {
		expect(
			await makeTestCli().run(["interactive"], { interactive: false }),
		).toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] INTERACTIVE_UNAVAILABLE: interactive terminal is unavailable\n",
			prompts: [],
		});
	});
});

describe("command grammar", () => {
	it("prints the version and help on stdout", async () => {
		const cli = makeTestCli();

		expect(await cli.run(["--version"])).toMatchObject({
			exitCode: 0,
			stdout: "1.2.3\n",
			stderr: "",
		});

		const help = await cli.run(["--help"]);
		expect(help).toMatchObject({ exitCode: 0, stderr: "" });
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
			"interactive, i",
		]) {
			expect(help.stdout).toContain(command);
		}

		const loadHelp = await cli.run(["load", "--help"]);
		expect(loadHelp.stdout).toContain("--protocol-version");
		expect(loadHelp.stdout).toContain("Decrypt payload for varlock");
		expect((await cli.run(["identity", "pass", "--help"])).stdout).toContain(
			"Alias for identity passphrase",
		);
	});

	it("maps parse errors to one stderr line and exit 2", async () => {
		const cli = makeTestCli();

		for (const argv of [["wat"], ["identity", "nope"], ["load", "--bogus"]]) {
			const result = await cli.run(argv);
			expect(result.exitCode).toBe(2);
			expect(result.stdout).toBe("");
			expect(result.stderr).toMatch(/^\[ERROR\] COMMAND_PARSE: .+\n$/);
		}
		expect((await cli.run(["wat"])).stderr).toContain(
			'Unknown subcommand "wat"',
		);
	});

	it("keeps guided operands optional and headless failures explicit", async () => {
		expect(await makeTestCli().run(["grant"], { interactive: false })).toEqual({
			exitCode: 2,
			stdout: "",
			stderr:
				"[ERROR] PAYLOAD_PATH_MISSING: pass a payload path or run interactively\n",
			prompts: [],
		});
	});
});
