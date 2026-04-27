import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { ReadPayload } from "../../app/read-payload/ReadPayload.js";
import {
	ReadPayloadCryptoError,
	ReadPayloadFileFormatError,
	ReadPayloadSuccess,
} from "../../app/read-payload/ReadPayloadError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import * as loadPayloadCommandModule from "./loadPayloadCommand.js";

const makePrompt = (passphrase = "test-passphrase") => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					return passphrase;
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: () => Effect.die("unused"),
			writeStderr: (text) =>
				Effect.sync(() => {
					stderr.push(text);
				}),
			writeStdout: (text) =>
				Effect.sync(() => {
					stdout.push(text);
				}),
		}),
		{
			inputSecretCalls,
			stderr,
			stdout,
		},
	);
};

describe("loadPayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ReadPayload,
				ReadPayload.make({
					execute: ({ path, passphrase }) =>
						Effect.succeed(
							new ReadPayloadSuccess({
								envText: "API_TOKEN=secret\nDEBUG=true\n",
								needsUpdate: {
									isRequired: false,
									reason: Option.none(),
								},
								path,
							}),
						).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(passphrase).toBe("test-passphrase");
								}),
							),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("success", (it) => {
		it.effect(
			"prints raw env only to stdout when protocol version matches",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([
								loadPayloadCommandModule.loadPayloadCommand,
							]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli([
						"node",
						"bage",
						"load",
						"--protocol-version=1",
						"./.env.enc",
					]);

					expect(
						(
							prompt as typeof prompt & {
								inputSecretCalls: Array<{ message: string }>;
							}
						).inputSecretCalls,
					).toEqual([{ message: "Passphrase: " }]);
					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual(["API_TOKEN=secret\nDEBUG=true\n"]);
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([]);
				}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ReadPayload,
				ReadPayload.make({
					execute: ({ path }) =>
						Effect.succeed(
							new ReadPayloadSuccess({
								envText: "API_TOKEN=secret\n",
								needsUpdate: {
									isRequired: true,
									reason: Option.some("self key is stale"),
								},
								path,
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("preflight failure", (it) => {
		it.effect("warns on update-needed and still prints plaintext", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([
							loadPayloadCommandModule.loadPayloadCommand,
						]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"load",
					"--protocol-version=1",
					"./.env.enc",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Right");
				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["API_TOKEN=secret\n"]);
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					[
						"Warning: payload should be updated",
						"Run: bage update ./.env.enc",
						"",
					].join("\n"),
				]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ReadPayload,
				ReadPayload.make({
					execute: () =>
						Effect.fail(
							new ReadPayloadCryptoError({
								message: "Failed to decrypt payload envelope",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("failure", (it) => {
		it.effect("prints normalized decrypt failure wording", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([
							loadPayloadCommandModule.loadPayloadCommand,
						]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"load",
					"--protocol-version=1",
					"./.env.enc",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Failed to decrypt payload with provided passphrase\n"]);
			}),
		);

		it.effect("prints normalized invalid-format wording", () =>
			Effect.gen(function* () {
				const prompt = Prompt.make({
					inputSecret: () => Effect.succeed("test-passphrase"),
					inputSecretPairFromStdin: Effect.die("unused"),
					inputText: () => Effect.die("unused"),
					writeStderr: (_text) => Effect.void,
					writeStdout: (_text) => Effect.void,
				});
				const stderr: Array<string> = [];
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([
							loadPayloadCommandModule.loadPayloadCommand,
						]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"load",
					"--protocol-version=1",
					"./.env.enc",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								ReadPayload,
								ReadPayload.make({
									execute: () =>
										Effect.fail(
											new ReadPayloadFileFormatError({
												message: "outer marker missing",
											}),
										),
								}),
							),
							Layer.succeed(
								Prompt,
								Object.assign(prompt, {
									writeStderr: (text: string) =>
										Effect.sync(() => {
											stderr.push(text);
										}),
								}),
							),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(stderr).toEqual(["Invalid payload format: ./.env.enc\n"]);
			}),
		);

		it.effect(
			"fails before calling ReadPayload when protocol version is missing",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					(
						prompt as typeof prompt & {
							inputSecretCalls: Array<{ message: string }>;
						}
					).inputSecretCalls.length = 0;
					(prompt as typeof prompt & { stderr: Array<string> }).stderr.length =
						0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([
								loadPayloadCommandModule.loadPayloadCommand,
							]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"load",
						"./.env.enc",
					]).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					expect(
						(
							prompt as typeof prompt & {
								inputSecretCalls: Array<{ message: string }>;
							}
						).inputSecretCalls,
					).toEqual([]);
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([
						[
							"Missing required protocol version",
							"Run with: --protocol-version=1",
							"",
						].join("\n"),
					]);
				}),
		);

		it.effect(
			"fails before calling ReadPayload when protocol version is unsupported",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					(
						prompt as typeof prompt & {
							inputSecretCalls: Array<{ message: string }>;
						}
					).inputSecretCalls.length = 0;
					(prompt as typeof prompt & { stderr: Array<string> }).stderr.length =
						0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([
								loadPayloadCommandModule.loadPayloadCommand,
							]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"load",
						"--protocol-version=2",
						"./.env.enc",
					]).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					expect(
						(
							prompt as typeof prompt & {
								inputSecretCalls: Array<{ message: string }>;
							}
						).inputSecretCalls,
					).toEqual([]);
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([
						[
							"Unsupported protocol version: 2",
							"This better-age CLI supports protocol version 1.",
							"Update the caller/plugin to a compatible version.",
							"",
						].join("\n"),
					]);
				}),
		);

		it.effect(
			"prints normalized stderr and fails when passphrase prompt is unavailable",
			() =>
				Effect.gen(function* () {
					const prompt = Prompt.make({
						inputSecret: () =>
							Effect.fail(
								new PromptUnavailableError({
									field: "passphrase",
									message: "Missing required input for passphrase",
								}),
							),
						inputSecretPairFromStdin: Effect.die("unused"),
						inputText: () => Effect.die("unused"),
						writeStderr: (_text) => Effect.void,
						writeStdout: (_text) => Effect.void,
					});
					const stderr: Array<string> = [];
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([
								loadPayloadCommandModule.loadPayloadCommand,
							]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"load",
						"--protocol-version=1",
						"./.env.enc",
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									ReadPayload,
									ReadPayload.make({
										execute: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									Prompt,
									Object.assign(prompt, {
										writeStderr: (text: string) =>
											Effect.sync(() => {
												stderr.push(text);
											}),
									}),
								),
							),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(stderr).toEqual([
						[
							"Secure passphrase input is unavailable in this environment",
							"Use an interactive terminal",
							"",
						].join("\n"),
					]);
				}),
		);

		it.effect("treats passphrase prompt abort as quiet cancel", () =>
			Effect.gen(function* () {
				const stderr: Array<string> = [];
				const stdout: Array<string> = [];
				const prompt = Prompt.make({
					inputSecret: () =>
						Effect.fail(
							new PromptReadAbortedError({
								message: "Prompt aborted by user",
								prompt: "Passphrase: ",
							}),
						),
					inputSecretPairFromStdin: Effect.die("unused"),
					inputText: () => Effect.die("unused"),
					writeStderr: (text) =>
						Effect.sync(() => {
							stderr.push(text);
						}),
					writeStdout: (text) =>
						Effect.sync(() => {
							stdout.push(text);
						}),
				});
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([
							loadPayloadCommandModule.loadPayloadCommand,
						]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"load",
					"--protocol-version=1",
					"./.env.enc",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								ReadPayload,
								ReadPayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Right");
				expect(stderr).toEqual([]);
				expect(stdout).toEqual([]);
			}),
		);
	});
});
