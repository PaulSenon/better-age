import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import {
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	ImportIdentityStringSuccess,
} from "../../app/import-identity-string/ImportIdentityStringError.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptReadAbortedError } from "../../port/PromptError.js";
import {
	AddIdentityCommandFailedError,
	addIdentityCommand,
} from "./addIdentityCommand.js";

const paulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const paulHandle = Schema.decodeUnknownSync(Handle)("paul#abcdef01");

const makePrompt = (inputTextValue = "better-age://identity/v1/dGVzdA") => {
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

const makeSequencedPrompt = (answers: ReadonlyArray<string>) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];
	let index = 0;

	return Object.assign(
		Prompt.make({
			inputSecret: () => Effect.die("unused"),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (input) =>
				Effect.sync(() => {
					inputTextCalls.push(input);
					const answer = answers[index];
					index += 1;
					return answer ?? "";
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
		{ inputTextCalls, stderr, stdout },
	);
};

const makeInteractivePrompt = (answers: ReadonlyArray<string>) => {
	const calls: Array<{
		choices: ReadonlyArray<{ title: string }>;
		message: string;
	}> = [];
	let index = 0;

	return Object.assign(
		InteractivePrompt.make({
			select: <A>(input: {
				readonly choices: ReadonlyArray<InteractiveChoice<A>>;
				readonly maxPerPage?: number;
				readonly message: string;
			}) =>
				Effect.sync(() => {
					calls.push({
						choices: input.choices.map((choice) => ({ title: choice.title })),
						message: input.message,
					});
					const answer = answers[index];
					index += 1;
					const matched = input.choices.find(
						(choice) => choice.title === answer,
					);

					if (matched === undefined) {
						throw new Error(`Missing choice ${answer}`);
					}

					return matched.value;
				}),
		}),
		{ calls },
	);
};

const makeAbortingPrompt = () => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: () => Effect.die("unused"),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: () =>
				Effect.fail(
					new PromptReadAbortedError({
						message: "aborted",
						prompt: "Identity string",
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
};

describe("addIdentityCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ImportIdentityString,
				ImportIdentityString.make({
					execute: () =>
						Effect.succeed(
							new ImportIdentityStringSuccess({
								displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
								handle: Schema.decodeUnknownSync(Handle)("paul#abcdef01"),
								outcome: "added",
							}),
						),
				}),
			),
			Layer.succeed(
				InteractivePrompt,
				InteractivePrompt.make({
					select: () => Effect.die("unused"),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("success", (it) => {
		it.effect(
			"imports from explicit arg and prints concise success output",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([addIdentityCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli([
						"node",
						"bage",
						"add-identity",
						"better-age://identity/v1/dGVzdA",
					]);

					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual(["added paul (paul#abcdef01)\n"]);
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([]);
				}),
		);

		it.effect("prompts for the identity string when arg is omitted", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([addIdentityCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "add-identity"]);

				expect(
					(
						prompt as typeof prompt & {
							inputTextCalls: Array<{ message: string }>;
						}
					).inputTextCalls,
				).toEqual([{ message: "Identity string" }]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ImportIdentityString,
				ImportIdentityString.make({
					execute: () => Effect.die("unused"),
				}),
			),
			Layer.succeed(
				InteractivePrompt,
				InteractivePrompt.make({
					select: () => Effect.die("unused"),
				}),
			),
			Layer.sync(Prompt, () => makeAbortingPrompt()),
		),
	)("cancel", (it) => {
		it.effect("returns cleanly when identity prompt is aborted", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([addIdentityCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "add-identity"]);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual([]);
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
				ImportIdentityString,
				ImportIdentityString.make({
					execute: () =>
						Effect.fail(
							new ImportIdentityStringDecodeError({
								message: "Identity string is malformed",
							}),
						),
				}),
			),
			Layer.succeed(
				InteractivePrompt,
				InteractivePrompt.make({
					select: () => Effect.die("unused"),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("failure", (it) => {
		it.effect("prints stderr and fails on malformed identity string", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([addIdentityCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"add-identity",
					"bad-value",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(AddIdentityCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Invalid identity string\n"]);
			}),
		);

		it.effect("prints stderr and fails on self identity string arg", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([addIdentityCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli([
					"node",
					"bage",
					"add-identity",
					"self-value",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Cannot import your own identity string\n"]);
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							ImportIdentityString,
							ImportIdentityString.make({
								execute: () =>
									Effect.fail(
										new ImportIdentityStringForbiddenSelfError({
											message: "Cannot import your own identity string",
										}),
									),
							}),
						),
						Layer.succeed(
							InteractivePrompt,
							InteractivePrompt.make({
								select: () => Effect.die("unused"),
							}),
						),
						Layer.sync(Prompt, () => makePrompt()),
					),
				),
			),
		);

		it.effect(
			"re-prompts guided invalid identity string after edit action",
			() =>
				Effect.gen(function* () {
					let executeCalls = 0;
					const prompt = makeSequencedPrompt(["bad-value", "good-value"]);
					const interactivePrompt = makeInteractivePrompt(["Edit input"]);
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([addIdentityCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "add-identity"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: ({ identityString }) =>
											Effect.suspend(() => {
												executeCalls += 1;
												return identityString === "bad-value"
													? Effect.fail(
															new ImportIdentityStringDecodeError({
																message: "Identity string is malformed",
															}),
														)
													: Effect.succeed(
															new ImportIdentityStringSuccess({
																displayName: paulDisplayName,
																handle: paulHandle,
																outcome: "added",
															}),
														);
											}),
									}),
								),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(Prompt, prompt),
							),
						),
					);

					expect(executeCalls).toBe(2);
					expect(prompt.stderr).toEqual(["Identity string is malformed\n"]);
					expect(prompt.inputTextCalls).toEqual([
						{ message: "Identity string" },
						{ message: "Identity string" },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Edit input" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Identity input error",
						},
					]);
				}),
		);
	});
});
