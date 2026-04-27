import { createInterface } from "node:readline";
import { Effect, Layer } from "effect";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";

const readSecret = (message: string): Promise<string> =>
	new Promise((resolve, reject) => {
		const stdin = process.stdin;
		const stderr = process.stderr;

		if (!stdin.isTTY || !stderr.isTTY) {
			reject(
				new PromptUnavailableError({
					field: "passphrase",
					message: "Interactive secret input is unavailable",
				}),
			);
			return;
		}

		let result = "";

		stderr.write(message);
		stdin.setEncoding("utf8");
		stdin.resume();
		stdin.setRawMode(true);

		const cleanup = () => {
			stdin.setRawMode(false);
			stdin.pause();
			stdin.off("data", onData);
		};

		const onData = (chunk: string) => {
			for (const character of chunk) {
				if (character === "\u0003") {
					cleanup();
					stderr.write("\n");
					reject(
						new PromptReadAbortedError({
							message: "Prompt aborted by user",
							prompt: message,
						}),
					);
					return;
				}

				if (character === "\r" || character === "\n") {
					cleanup();
					stderr.write("\n");
					resolve(result);
					return;
				}

				if (character === "\u007f") {
					result = result.slice(0, -1);
					continue;
				}

				result += character;
			}
		};

		stdin.on("data", onData);
	});

export const makeNodePrompt = () =>
	Prompt.make({
		inputSecret: (input) =>
			Effect.tryPromise({
				catch: (cause) =>
					cause instanceof PromptReadAbortedError ||
					cause instanceof PromptUnavailableError
						? cause
						: new PromptReadAbortedError({
								message: "Failed to read secret input",
								prompt: input.message,
							}),
				try: () => readSecret(input.message),
			}),
		inputSecretPairFromStdin: Effect.tryPromise({
			catch: (cause) =>
				new PromptReadAbortedError({
					message: `Failed to read passphrase from stdin: ${String(cause)}`,
					prompt: "passphrase-stdin",
				}),
			try: async () => {
				const stdin = process.stdin;

				const chunks: string[] = [];

				for await (const chunk of stdin) {
					chunks.push(String(chunk));
				}

				const lines = chunks
					.join("")
					.replace(/\r\n/g, "\n")
					.split("\n")
					.filter((line) => line.length > 0);

				if (lines.length < 2) {
					throw new Error("Expected two non-empty lines on stdin");
				}

				const first = lines[0];
				const second = lines[1];

				if (!first || !second) {
					throw new Error("Expected two non-empty lines on stdin");
				}

				return [first, second] as const;
			},
		}),
		inputText: (input) =>
			Effect.tryPromise({
				catch: (cause) =>
					cause instanceof PromptUnavailableError
						? cause
						: new PromptReadAbortedError({
								message: `Failed to read input: ${String(cause)}`,
								prompt: input.message,
							}),
				try: async () => {
					const stdin = process.stdin;
					const stderr = process.stderr;

					if (!stdin.isTTY || !stderr.isTTY) {
						throw new PromptUnavailableError({
							field: input.message,
							message: "Interactive text input is unavailable",
						});
					}

					const readline = createInterface({
						input: stdin,
						output: stderr,
					});
					const suffix = input.defaultValue ? ` (${input.defaultValue})` : "";
					const answer = await new Promise<string>((resolve, reject) => {
						readline.question(`${input.message}${suffix}: `, (value) => {
							resolve(value);
						});
						readline.on("close", () => {
							reject(
								new PromptReadAbortedError({
									message: "Prompt aborted by user",
									prompt: input.message,
								}),
							);
						});
					}).finally(() => {
						readline.close();
					});

					return answer.trim() || input.defaultValue || "";
				},
			}),
		writeStderr: (text: string) =>
			Effect.sync(() => {
				process.stderr.write(text);
			}),
		writeStdout: (text: string) =>
			Effect.sync(() => {
				process.stdout.write(text);
			}),
	});

export const NodePromptLive = Layer.succeed(Prompt, makeNodePrompt());
