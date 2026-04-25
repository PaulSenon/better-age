import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ChangePassphrase } from "../../app/change-passphrase/ChangePassphrase.js";
import {
	ChangePassphraseCryptoError,
	ChangePassphraseNoActiveIdentityError,
	ChangePassphraseSuccess,
} from "../../app/change-passphrase/ChangePassphraseError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	type PromptUnavailableError,
} from "../../port/PromptError.js";
import {
	ChangePassphraseCommandFailedError,
	changePassphraseCommand,
} from "./changePassphraseCommand.js";

const makePrompt = (input?: {
	readonly inputSecretError?: PromptReadAbortedError | PromptUnavailableError;
	readonly secrets?: ReadonlyArray<string>;
}) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	let index = 0;
	const secrets = [
		...(input?.secrets ?? [
			"old-passphrase",
			"new-passphrase",
			"new-passphrase",
		]),
	];

	return Object.assign(
		Prompt.make({
			inputSecret: (args) =>
				Effect.gen(function* () {
					inputSecretCalls.push(args);

					if (input?.inputSecretError) {
						return yield* input.inputSecretError;
					}

					const value = secrets[index];
					index += 1;
					return value ?? "";
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

describe("changePassphraseCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ChangePassphrase,
				ChangePassphrase.make({
					execute: ({ currentPassphrase, nextPassphrase }) =>
						Effect.succeed(new ChangePassphraseSuccess({})).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(currentPassphrase).toBe("old-passphrase");
									expect(nextPassphrase).toBe("new-passphrase");
								}),
							),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("success", (it) => {
		it.effect("prompts current new confirm and prints success", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([changePassphraseCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "change-passphrase"]);

				expect(
					(
						prompt as typeof prompt & {
							inputSecretCalls: Array<{ message: string }>;
						}
					).inputSecretCalls,
				).toEqual([
					{ message: "Current passphrase: " },
					{ message: "New passphrase: " },
					{ message: "Confirm new passphrase: " },
				]);
				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["updated passphrase for all local keys\n"]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ChangePassphrase,
				ChangePassphrase.make({
					execute: ({ currentPassphrase, nextPassphrase }) =>
						Effect.succeed(new ChangePassphraseSuccess({})).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(currentPassphrase).toBe("old-passphrase");
									expect(nextPassphrase).toBe("new-passphrase");
								}),
							),
						),
				}),
			),
			Layer.sync(Prompt, () =>
				makePrompt({
					secrets: [
						"old-passphrase",
						"new-passphrase",
						"wrong-confirmation",
						"new-passphrase",
						"new-passphrase",
					],
				}),
			),
		),
	)("mismatch", (it) => {
		it.effect("retries passphrase pair on mismatch before app", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([changePassphraseCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "change-passphrase"]);
				expect(
					(
						prompt as typeof prompt & {
							inputSecretCalls: Array<{ message: string }>;
						}
					).inputSecretCalls,
				).toEqual([
					{ message: "Current passphrase: " },
					{ message: "New passphrase: " },
					{ message: "Confirm new passphrase: " },
					{ message: "New passphrase: " },
					{ message: "Confirm new passphrase: " },
				]);
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Passphrases do not match\n"]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ChangePassphrase,
				ChangePassphrase.make({
					execute: () =>
						Effect.fail(
							new ChangePassphraseCryptoError({
								message:
									"Failed to decrypt private key with provided passphrase",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("failure", (it) => {
		it.effect("prints normalized stderr and fails on app error", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([changePassphraseCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "change-passphrase"]).pipe(
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						ChangePassphraseCommandFailedError,
					);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					["Failed to change local passphrase", "Retry", ""].join("\n"),
				]);
			}),
		);

		it.effect(
			"prints setup remediation when no local self identity exists",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt();
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([changePassphraseCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					const result = yield* cli(["node", "bage", "change-passphrase"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									ChangePassphrase,
									ChangePassphrase.make({
										execute: () =>
											Effect.fail(
												new ChangePassphraseNoActiveIdentityError({
													message: "raw setup required",
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
							),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(prompt.stderr).toEqual([
						["No local self identity found", "Run: bage setup", ""].join("\n"),
					]);
				}),
		);

		it.effect("treats prompt abort as quiet cancel", () =>
			Effect.gen(function* () {
				const prompt = makePrompt({
					inputSecretError: new PromptReadAbortedError({
						message: "aborted",
						prompt: "passphrase",
					}),
				});
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([changePassphraseCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "change-passphrase"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								ChangePassphrase,
								ChangePassphrase.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Right");
				expect(prompt.stderr).toEqual([]);
				expect(prompt.stdout).toEqual([]);
			}),
		);
	});
});
