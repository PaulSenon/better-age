import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
	BETTER_AGE_PROTOCOL_VERSION,
	createBetterAgeRuntime,
} from "./createBetterAgeRuntime.js";

class SpawnedProcessStub extends EventEmitter {
	readonly stdout = new EventEmitter();

	pushStdout(text: string) {
		this.stdout.emit("data", Buffer.from(text));
	}

	close(exitCode: number | null) {
		this.emit("close", exitCode);
	}

	fail(error: Error) {
		this.emit("error", error);
	}
}

class SpawnedProcessWithoutStdoutStub extends EventEmitter {
	readonly stdout = null;
}

describe("createBetterAgeRuntime", () => {
	it("spawns bage load and returns raw env text", async () => {
		const spawnCalls: Array<{
			args: Array<string>;
			command: string;
			options: unknown;
		}> = [];

		const runtime = createBetterAgeRuntime({
			spawnProcess: (command, args, options) => {
				spawnCalls.push({ args, command, options });

				const child = new SpawnedProcessStub();
				queueMicrotask(() => {
					child.pushStdout("API_TOKEN=secret\nDEBUG=true\n");
					child.close(0);
				});
				return child;
			},
		});

		runtime.init({ path: "./.env.enc" });

		await expect(runtime.loadEnvText()).resolves.toBe(
			"API_TOKEN=secret\nDEBUG=true\n",
		);
		expect(spawnCalls).toEqual([
			{
				args: [
					"load",
					`--protocol-version=${BETTER_AGE_PROTOCOL_VERSION}`,
					"./.env.enc",
				],
				command: "bage",
				options: {
					stdio: ["inherit", "pipe", "inherit"],
				},
			},
		]);
	});

	it("uses the custom launcher prefix through the shell when command is provided", async () => {
		const spawnCalls: Array<{
			args: Array<string>;
			command: string;
			options: unknown;
		}> = [];

		const runtime = createBetterAgeRuntime({
			spawnProcess: (command, args, options) => {
				spawnCalls.push({ args, command, options });

				const child = new SpawnedProcessStub();
				queueMicrotask(() => {
					child.pushStdout("API_TOKEN=secret\n");
					child.close(0);
				});
				return child;
			},
		});

		runtime.init({
			command: "node /tmp/better-age-cli.cjs",
			path: "./.env.enc",
		});

		await expect(runtime.loadEnvText()).resolves.toBe("API_TOKEN=secret\n");
		expect(spawnCalls).toEqual([
			{
				args: [],
				command:
					"node /tmp/better-age-cli.cjs 'load' '--protocol-version=1' './.env.enc'",
				options: {
					shell: true,
					stdio: ["inherit", "pipe", "inherit"],
				},
			},
		]);
	});

	it("reuses the first in-flight load for the current process", async () => {
		let spawnCount = 0;
		const child = new SpawnedProcessStub();
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				spawnCount += 1;
				return child;
			},
		});

		runtime.init({ path: "./.env.enc" });

		const firstLoad = runtime.loadEnvText();
		const secondLoad = runtime.loadEnvText();

		expect(spawnCount).toBe(1);
		expect(firstLoad).toBe(secondLoad);

		child.pushStdout("A=1\n");
		child.close(0);

		await expect(firstLoad).resolves.toBe("A=1\n");
		await expect(secondLoad).resolves.toBe("A=1\n");
	});

	it("does not memoize a failed load forever", async () => {
		let spawnCount = 0;
		const children: Array<SpawnedProcessStub> = [];
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				spawnCount += 1;
				const child = new SpawnedProcessStub();
				children.push(child);
				return child;
			},
		});

		runtime.init({ path: "./.env.enc" });

		const firstLoad = runtime.loadEnvText();
		children[0]?.close(2);
		await expect(firstLoad).rejects.toThrow(
			"bage load failed with exit code 2",
		);

		const secondLoad = runtime.loadEnvText();
		children[1]?.pushStdout("A=1\n");
		children[1]?.close(0);

		await expect(secondLoad).resolves.toBe("A=1\n");
		expect(spawnCount).toBe(2);
	});

	it("fails when betterAgeLoad() is used before initBetterAge(...)", async () => {
		const runtime = createBetterAgeRuntime();

		await expect(runtime.loadEnvText()).rejects.toThrow(
			"better-age plugin is not initialized. Add @initBetterAge(path=...) before using betterAgeLoad().",
		);
	});

	it("fails with install remediation when the CLI cannot start", async () => {
		const child = new SpawnedProcessStub();
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				queueMicrotask(() => {
					child.fail(new Error("spawn bage ENOENT"));
				});
				return child;
			},
		});

		runtime.init({ path: "./.env.enc" });

		await expect(runtime.loadEnvText()).rejects.toThrow(
			[
				"better-age CLI command failed to start",
				"Configured launcher: bage",
				"Install @better-age/cli and ensure `bage` is runnable from this shell.",
				"Cause: spawn bage ENOENT",
			].join("\n"),
		);
	});

	it("maps synchronous launcher setup failures to adapter failures", async () => {
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				throw new Error("stdio setup failed");
			},
		});

		runtime.init({ path: "./.env.enc" });

		await expect(runtime.loadEnvText()).rejects.toThrow(
			[
				"better-age CLI command failed to start",
				"Configured launcher: bage",
				"Install @better-age/cli and ensure `bage` is runnable from this shell.",
				"Cause: stdio setup failed",
			].join("\n"),
		);
	});

	it("maps non-zero load exits to adapter failures", async () => {
		const child = new SpawnedProcessStub();
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				queueMicrotask(() => {
					child.close(2);
				});
				return child;
			},
		});

		runtime.init({ path: "./.env.enc" });

		await expect(runtime.loadEnvText()).rejects.toThrow(
			"bage load failed with exit code 2",
		);
	});

	it("maps missing stdout pipe to adapter failure", async () => {
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => new SpawnedProcessWithoutStdoutStub(),
		});

		runtime.init({ path: "./.env.enc" });

		await expect(runtime.loadEnvText()).rejects.toThrow(
			"bage load stdout pipe was not available",
		);
	});

	it("surfaces the configured custom launcher when command start fails", async () => {
		const child = new SpawnedProcessStub();
		const runtime = createBetterAgeRuntime({
			spawnProcess: () => {
				queueMicrotask(() => {
					child.fail(new Error("spawn /bin/sh ENOENT"));
				});
				return child;
			},
		});

		runtime.init({
			command: "pnpm exec bage",
			path: "./.env.enc",
		});

		await expect(runtime.loadEnvText()).rejects.toThrow(
			[
				"better-age CLI command failed to start",
				"Configured launcher: pnpm exec bage",
				'Verify @initBetterAge(command="...") is runnable from this shell.',
				"Cause: spawn /bin/sh ENOENT",
			].join("\n"),
		);
	});
});
