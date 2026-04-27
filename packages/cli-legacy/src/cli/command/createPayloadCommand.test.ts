import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { CreatePayload } from "../../app/create-payload/CreatePayload.js";
import {
	CreatePayloadNotSetUpError,
	CreatePayloadPersistenceError,
	CreatePayloadSuccess,
} from "../../app/create-payload/CreatePayloadError.js";
import { ResolveNewPayloadTarget } from "../../app/shared/ResolveNewPayloadTarget.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PathAccess } from "../../port/PathAccess.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import {
	CreatePayloadCommandFailedError,
	createPayloadCommand,
} from "./createPayloadCommand.js";

const makePrompt = (inputTextValue = ".env.enc") => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: () => Effect.die("unused"),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (input) =>
				Effect.sync(() => {
					inputTextCalls.push(input);
					return inputTextValue;
				}),
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
			inputTextCalls,
			stderr,
			stdout,
		},
	);
};

const makeInteractivePrompt = (answer = "Overwrite") => {
	const calls: Array<{
		choices: ReadonlyArray<{ title: string }>;
		message: string;
	}> = [];

	return Object.assign(
		InteractivePrompt.make({
			select: <A>(input: {
				readonly choices: ReadonlyArray<{ title: string; value: A }>;
				readonly maxPerPage?: number;
				readonly message: string;
			}) =>
				Effect.sync(() => {
					calls.push({
						choices: input.choices.map((choice) => ({ title: choice.title })),
						message: input.message,
					});

					const selected = input.choices.find(
						(choice) => choice.title === answer,
					);

					if (selected === undefined) {
						throw new Error(`Missing choice ${answer}`);
					}

					return selected.value;
				}),
		}),
		{ calls },
	);
};

const makeUnusedInteractivePrompt = () =>
	Object.assign(
		InteractivePrompt.make({
			select: () => Effect.die("unused"),
		}),
		{
			calls: [] as Array<{
				choices: ReadonlyArray<{ title: string }>;
				message: string;
			}>,
		},
	);

type TestPrompt = Prompt & {
	readonly inputTextCalls?: Array<{ defaultValue?: string; message: string }>;
	readonly stderr: Array<string>;
	readonly stdout: Array<string>;
};

type TestInteractivePrompt = InteractivePrompt & {
	readonly calls: Array<{
		readonly choices: ReadonlyArray<{ title: string }>;
		readonly message: string;
	}>;
};

const makeCreateCommandDependencies = (input?: {
	readonly createPayload?: ReturnType<typeof CreatePayload.make>;
	readonly interactivePrompt?: TestInteractivePrompt;
	readonly pathAccess?: ReturnType<typeof PathAccess.make>;
	readonly prompt?: TestPrompt;
}) => {
	const prompt = input?.prompt ?? makePrompt();
	const interactivePrompt =
		input?.interactivePrompt ?? makeInteractivePrompt("Overwrite");
	const pathAccess =
		input?.pathAccess ??
		PathAccess.make({
			exists: (_path) => Effect.succeed(false),
		});
	const createPayload =
		input?.createPayload ??
		CreatePayload.make({
			execute: ({ path }) =>
				Effect.succeed(
					new CreatePayloadSuccess({
						path,
						payloadId: "bspld_0123456789abcdef" as never,
					}),
				),
		});

	return Layer.mergeAll(
		NodeContext.layer,
		Layer.succeed(CreatePayload, createPayload),
		Layer.succeed(Prompt, prompt),
		Layer.succeed(PathAccess, pathAccess),
		Layer.succeed(InteractivePrompt, interactivePrompt),
		Layer.provide(ResolveNewPayloadTarget.Default, [
			Layer.succeed(Prompt, prompt),
			Layer.succeed(PathAccess, pathAccess),
			Layer.succeed(InteractivePrompt, interactivePrompt),
		]),
	);
};

describe("createPayloadCommand", () => {
	layer(
		makeCreateCommandDependencies({
			interactivePrompt: makeUnusedInteractivePrompt(),
		}),
	)("success", (it) => {
		it.effect("creates from explicit path arg and prints concise success", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "create", "./secrets.env.enc"]);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["Created encrypted payload at ./secrets.env.enc\n"]);
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([]);
			}),
		);

		it.effect("prompts for path when arg is omitted", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "create"]);

				expect(
					(
						prompt as typeof prompt & {
							inputTextCalls: Array<{ defaultValue?: string; message: string }>;
						}
					).inputTextCalls,
				).toEqual([{ defaultValue: ".env.enc", message: "Payload path" }]);
			}),
		);

		it.effect("fails on exact existing path without overwrite prompt", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("./.env.enc");
				const interactivePrompt = makeInteractivePrompt("Overwrite");
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"create",
					"./.env.enc",
				]).pipe(
					Effect.provide(
						makeCreateCommandDependencies({
							createPayload: CreatePayload.make({
								execute: () => Effect.die("unused"),
							}),
							interactivePrompt,
							pathAccess: PathAccess.make({
								exists: (_path) => Effect.succeed(true),
							}),
							prompt,
						}),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(interactivePrompt.calls).toEqual([]);
				expect(prompt.stderr).toEqual([
					"Payload already exists: ./.env.enc\nPass a different path explicitly.\n",
				]);
			}),
		);

		it.effect("confirms before overwriting an existing guided target", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("./.env.enc");
				const interactivePrompt = makeInteractivePrompt("Overwrite");
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "create"]).pipe(
					Effect.provide(
						makeCreateCommandDependencies({
							interactivePrompt,
							pathAccess: PathAccess.make({
								exists: (_path) => Effect.succeed(true),
							}),
							prompt,
						}),
					),
				);

				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Enter different path" },
							{ title: "Overwrite" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Payload already exists: ./.env.enc",
					},
				]);
				expect(prompt.stdout).toEqual([
					"Created encrypted payload at ./.env.enc\n",
				]);
			}),
		);

		it.effect("returns quietly when guided overwrite menu goes back", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("./.env.enc");
				const interactivePrompt = makeInteractivePrompt("Back");
				let executeCalls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "create"]).pipe(
					Effect.provide(
						makeCreateCommandDependencies({
							createPayload: CreatePayload.make({
								execute: () =>
									Effect.sync(() => {
										executeCalls += 1;
										return new CreatePayloadSuccess({
											path: "./should-not-run.env.enc",
											payloadId: "bspld_0123456789abcdef" as never,
										});
									}),
							}),
							interactivePrompt,
							pathAccess: PathAccess.make({
								exists: (_path) => Effect.succeed(true),
							}),
							prompt,
						}),
					),
				);

				expect(executeCalls).toBe(0);
				expect(prompt.stdout).toEqual([]);
				expect(prompt.stderr).toEqual([]);
			}),
		);
	});

	layer(
		makeCreateCommandDependencies({
			createPayload: CreatePayload.make({
				execute: () =>
					Effect.fail(
						new CreatePayloadNotSetUpError({
							message: "No local identity is configured",
						}),
					),
			}),
			interactivePrompt: makeUnusedInteractivePrompt(),
		}),
	)("failure", (it) => {
		it.effect("prints stderr and fails when user is not set up", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"create",
					"./secrets.env.enc",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(CreatePayloadCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["No local identity is configured\n"]);
			}),
		);

		it.effect("prints persistence failures to stderr", () =>
			Effect.gen(function* () {
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);
				const prompt = makePrompt();
				const customLayer = Layer.mergeAll(
					makeCreateCommandDependencies({
						createPayload: CreatePayload.make({
							execute: () =>
								Effect.fail(
									new CreatePayloadPersistenceError({
										message: "Failed to write payload file",
										operation: "write payload file",
									}),
								),
						}),
						prompt,
					}),
				);

				const result = yield* cli([
					"node",
					"bage",
					"create",
					"./secrets.env.enc",
				]).pipe(Effect.provide(customLayer), Effect.either);

				expect(result._tag).toBe("Left");
				expect(prompt.stderr).toEqual(["Failed to write payload file\n"]);
			}),
		);

		it.effect(
			"fails with remediation when overwrite confirmation is unavailable",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("./.env.enc");
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([createPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli(["node", "bage", "create"]).pipe(
						Effect.provide(
							makeCreateCommandDependencies({
								createPayload: CreatePayload.make({
									execute: () => Effect.die("unused"),
								}),
								interactivePrompt: Object.assign(
									InteractivePrompt.make({
										select: () =>
											Effect.fail(
												new PromptUnavailableError({
													field: "overwrite",
													message: "Interactive selection is unavailable",
												}),
											),
									}),
									{
										calls: [] as Array<{
											choices: ReadonlyArray<{ title: string }>;
											message: string;
										}>,
									},
								),
								pathAccess: PathAccess.make({
									exists: (_path) => Effect.succeed(true),
								}),
								prompt,
							}),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(prompt.stderr).toEqual([
						"Payload already exists: ./.env.enc\nPass a different path explicitly.\n",
					]);
				}),
		);

		it.effect("fails with missing-path remediation in headless mode", () =>
			Effect.gen(function* () {
				const stderr: Array<string> = [];
				const stdout: Array<string> = [];
				const prompt = Object.assign(
					Prompt.make({
						inputSecret: () => Effect.die("unused"),
						inputSecretPairFromStdin: Effect.die("unused"),
						inputText: () =>
							Effect.fail(
								new PromptUnavailableError({
									field: "path",
									message: "Interactive text input is unavailable",
								}),
							),
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
						stderr,
						stdout,
					},
				);
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([createPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli(["node", "bage", "create"]).pipe(
					Effect.provide(
						makeCreateCommandDependencies({
							createPayload: CreatePayload.make({
								execute: () => Effect.die("unused"),
							}),
							prompt,
						}),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(stderr).toEqual([
					"Missing required payload path\nPass a payload path explicitly\n",
				]);
				expect(stdout).toEqual([]);
			}),
		);
	});
});
