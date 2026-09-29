// Builds the standalone `bage` bundle and runs it as a real process in a
// throwaway HOME (headless: no TTY, so nothing prompts).
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliRoot = process.cwd();
const bundlePath = join(cliRoot, "dist/bage");
let home = "";

const bage = async (args: ReadonlyArray<string>) => {
	try {
		const { stdout, stderr } = await execFileAsync(
			process.execPath,
			[bundlePath, ...args],
			{ cwd: home, env: { PATH: process.env.PATH, HOME: home, NO_COLOR: "1" } },
		);
		return { exitCode: 0, stdout, stderr };
	} catch (cause) {
		const error = cause as { code?: number; stdout?: string; stderr?: string };
		return {
			exitCode: error.code ?? 1,
			stdout: error.stdout ?? "",
			stderr: error.stderr ?? "",
		};
	}
};

beforeAll(async () => {
	home = await mkdtemp(join(tmpdir(), "bage-bundle-"));
	await rm(join(cliRoot, "dist"), { force: true, recursive: true });
	await execFileAsync(process.execPath, ["esbuild.config.mjs"], {
		cwd: cliRoot,
	});
}, 60_000);

afterAll(async () => {
	await rm(home, { force: true, recursive: true });
});

describe("standalone cli bundle", () => {
	it("is one executable file with a node shebang and no workspace imports", async () => {
		const source = await readFile(bundlePath, "utf8");

		expect(await readdir(join(cliRoot, "dist"))).toEqual(["bage"]);
		expect(((await stat(bundlePath)).mode & 0o111) > 0).toBe(true);
		expect(source.startsWith("#!/usr/bin/env node\n")).toBe(true);
		expect(source).not.toContain('from "@better-age/core');
	});

	it("keeps the stdout/stderr/exit-code contract as a real process", async () => {
		const { version } = JSON.parse(
			await readFile(join(cliRoot, "package.json"), "utf8"),
		) as { readonly version: string };

		expect(await bage(["--version"])).toEqual({
			exitCode: 0,
			stdout: `${version}\n`,
			stderr: "",
		});
		expect(await bage(["--help"])).toMatchObject({ exitCode: 0, stderr: "" });
		expect(await bage(["wat"])).toEqual({
			exitCode: 2,
			stdout: "",
			stderr: '[ERROR] COMMAND_PARSE: Unknown subcommand "wat" for "bage"\n',
		});
		expect(await bage(["load", ".env.enc"])).toMatchObject({
			exitCode: 2,
			stdout: "",
		});
		expect(await bage(["setup", "--name", "CI"])).toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] PASSPHRASE_UNAVAILABLE: cannot prompt in headless mode\n",
		});
		expect(await bage(["identity", "export"])).toEqual({
			exitCode: 1,
			stdout: "",
			stderr: "[ERROR] HOME_STATE_NOT_FOUND: run bage setup first\n",
		});
	});
});
