import { type SpawnOptions, spawn } from "node:child_process";

export const BETTER_AGE_PROTOCOL_VERSION = "1";
export const BETTER_AGE_DEFAULT_COMMAND = "bage";

export type BetterAgeInitConfig = {
	command?: string;
	path: string;
};

type SpawnedProcess = {
	stdout: {
		on: (
			event: "data",
			listener: (chunk: Buffer | Uint8Array | string) => void,
		) => void;
	} | null;
	on: (
		event: "close" | "error",
		listener: (value: number | null | Error) => void,
	) => void;
};

type SpawnProcess = (
	command: string,
	args: Array<string>,
	options: SpawnOptions,
) => SpawnedProcess;

type BetterAgeRuntime = {
	init: (config: BetterAgeInitConfig) => void;
	loadEnvText: () => Promise<string>;
};

const createCommandStartFailureMessage = (command: string, cause: Error) =>
	[
		"better-age CLI command failed to start",
		`Configured launcher: ${command}`,
		command === BETTER_AGE_DEFAULT_COMMAND
			? "Install @better-age/cli and ensure `bage` is runnable from this shell."
			: 'Verify @initBetterAge(command="...") is runnable from this shell.',
		`Cause: ${cause.message}`,
	].join("\n");

const createCommandExitFailureMessage = (exitCode: number | null) =>
	`bage load failed with exit code ${exitCode ?? "unknown"}`;

const shellQuoteArg = (value: string) =>
	`'${value.replaceAll("'", "'\"'\"'")}'`;

const shouldUseShellLauncher = (command: string) => /\s/.test(command);

export const createBetterAgeRuntime = (
	deps: { spawnProcess?: SpawnProcess } = {},
): BetterAgeRuntime => {
	const spawnProcess =
		deps.spawnProcess ??
		((command, args, options) => spawn(command, args, options));

	let initConfig: BetterAgeInitConfig | undefined;
	let loadPromise: Promise<string> | undefined;

	const invokeLoad = (config: BetterAgeInitConfig) =>
		new Promise<string>((resolve, reject) => {
			const commandPrefix = config.command ?? BETTER_AGE_DEFAULT_COMMAND;
			const fixedArgs = [
				"load",
				`--protocol-version=${BETTER_AGE_PROTOCOL_VERSION}`,
				config.path,
			];
			let child: SpawnedProcess;

			try {
				child = shouldUseShellLauncher(commandPrefix)
					? spawnProcess(
							`${commandPrefix} ${fixedArgs.map(shellQuoteArg).join(" ")}`,
							[],
							{
								shell: true,
								stdio: ["inherit", "pipe", "inherit"],
							},
						)
					: spawnProcess(commandPrefix, fixedArgs, {
							stdio: ["inherit", "pipe", "inherit"],
						});
			} catch (cause) {
				const error =
					cause instanceof Error ? cause : new Error("unknown process error");
				reject(
					new Error(createCommandStartFailureMessage(commandPrefix, error)),
				);
				return;
			}

			if (!child.stdout) {
				reject(new Error("bage load stdout pipe was not available"));
				return;
			}

			const stdoutChunks: Array<string> = [];

			child.stdout.on("data", (chunk: Buffer | Uint8Array | string) => {
				stdoutChunks.push(
					typeof chunk === "string"
						? chunk
						: Buffer.from(chunk).toString("utf8"),
				);
			});

			child.on("error", (value) => {
				const error =
					value instanceof Error ? value : new Error("unknown process error");
				reject(
					new Error(createCommandStartFailureMessage(commandPrefix, error)),
				);
			});

			child.on("close", (value) => {
				const exitCode = typeof value === "number" ? value : null;

				if (exitCode === 0) {
					resolve(stdoutChunks.join(""));
					return;
				}

				reject(new Error(createCommandExitFailureMessage(exitCode)));
			});
		});

	return {
		init: (config) => {
			if (!initConfig) {
				initConfig = config;
				return;
			}

			if (
				initConfig.path === config.path &&
				initConfig.command === config.command
			) {
				return;
			}

			throw new Error(
				"better-age varlock plugin only supports one initBetterAge(path=...) instance in v0",
			);
		},
		loadEnvText: () => {
			if (!initConfig) {
				return Promise.reject(
					new Error(
						"better-age plugin is not initialized. Add @initBetterAge(path=...) before using betterAgeLoad().",
					),
				);
			}

			loadPromise ??= invokeLoad(initConfig);
			return loadPromise;
		},
	};
};
