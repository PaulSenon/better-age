import { execFile } from "node:child_process";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliRoot = process.cwd();
const bundlePath = join(cliRoot, "dist/bage");

type ProcessResult = {
	readonly exitCode: number;
	readonly stderr: string;
	readonly stdout: string;
};

const runProcess = async (
	command: string,
	args: ReadonlyArray<string>,
): Promise<ProcessResult> => {
	try {
		const result = await execFileAsync(command, [...args], {
			cwd: cliRoot,
			env: { ...process.env, NO_COLOR: "1" },
		});

		return {
			exitCode: 0,
			stderr: result.stderr,
			stdout: result.stdout,
		};
	} catch (cause) {
		const error = cause as {
			readonly code?: number;
			readonly stderr?: string;
			readonly stdout?: string;
		};

		return {
			exitCode: error.code ?? 1,
			stderr: error.stderr ?? "",
			stdout: error.stdout ?? "",
		};
	}
};

const buildBundle = async () => {
	await rm(join(cliRoot, "dist"), { force: true, recursive: true });
	await runProcess(process.execPath, ["esbuild.config.mjs"]);
};

describe("standalone cli bundle", () => {
	it("builds one executable bage file with shebang", async () => {
		await buildBundle();

		const files = await readdir(join(cliRoot, "dist"));
		const bundle = await stat(bundlePath);
		const source = await readFile(bundlePath, "utf8");

		expect(files).toEqual(["bage"]);
		expect(bundle.isFile()).toBe(true);
		expect((bundle.mode & 0o111) > 0).toBe(true);
		expect(source.startsWith("#!/usr/bin/env node\n")).toBe(true);
		expect(source).not.toContain('from "@better-age/core"');
	});

	it("starts the built bage bin and preserves stderr/stdout policy", async () => {
		await buildBundle();

		await expect(
			runProcess(process.execPath, [bundlePath, "--help"]),
		).resolves.toMatchObject({
			exitCode: 0,
			stderr: "",
		});

		const failure = await runProcess(process.execPath, [bundlePath, "wat"]);

		expect(failure).toEqual({
			exitCode: 2,
			stdout: "",
			stderr: '[ERROR] COMMAND_UNKNOWN: unknown command "wat"\n',
		});
	});
});
