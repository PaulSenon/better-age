import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import { CreateUserIdentitySuccess } from "../../app/create-user-identity/CreateUserIdentityError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadNoSelfIdentityError,
	UpdatePayloadUnchangedSuccess,
	UpdatePayloadUpdatedSuccess,
	UpdatePayloadVersionError,
} from "../../app/update-payload/UpdatePayloadError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptReadAbortedError } from "../../port/PromptError.js";
import {
	UpdatePayloadCommandFailedError,
	updatePayloadCommand,
} from "./updatePayloadCommand.js";

const makePrompt = (
	options: {
		inputSecretAnswers?: ReadonlyArray<string>;
		inputTextAnswers?: ReadonlyArray<string>;
	} = {},
) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	const inputTextCalls: Array<{ message: string; defaultValue?: string }> = [];
	let inputSecretIndex = 0;
	let inputTextIndex = 0;

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					const answer = options.inputSecretAnswers?.[inputSecretIndex];
					inputSecretIndex += 1;
					return answer ?? "test-passphrase";
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (input) =>
				Effect.sync(() => {
					inputTextCalls.push(input);
					const answer = options.inputTextAnswers?.[inputTextIndex];
					inputTextIndex += 1;
					return answer ?? input.defaultValue ?? "";
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
			inputSecretCalls,
			inputTextCalls,
			stderr,
			stdout,
		},
	);
};

const makeResolvePayloadTarget = (resolvedPath = "./.env.enc") =>
	ResolvePayloadTarget.make({
		resolveExistingPath: (_path) => Effect.succeed(resolvedPath),
	});

const makeUnusedCreateUserIdentity = () =>
	CreateUserIdentity.make({
		execute: () => Effect.die("unused"),
	});

const makeUnusedHomeRepository = () =>
	HomeRepository.make({
		deletePrivateKey: () => Effect.die("unused"),
		getActiveKey: Effect.die("unused"),
		getLocation: Effect.die("unused"),
		loadState: Effect.die("unused"),
		readPrivateKey: () => Effect.die("unused"),
		saveState: () => Effect.die("unused"),
		writePrivateKey: () => Effect.die("unused"),
		writePrivateKeyAtPath: () => Effect.die("unused"),
	});

const makeInteractivePrompt = (answers: ReadonlyArray<string>) => {
	const calls: Array<{
		choices: ReadonlyArray<{ disabled?: boolean; title: string }>;
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
						choices: input.choices.map((choice) =>
							choice.disabled === undefined
								? { title: choice.title }
								: { disabled: choice.disabled, title: choice.title },
						),
						message: input.message,
					});
					const answer = answers[index];
					index += 1;

					const matchedChoice = input.choices.find(
						(choice) => choice.title === answer,
					);

					if (matchedChoice === undefined) {
						throw new Error(
							`Missing choice titled "${answer}" for ${input.message}`,
						);
					}

					return matchedChoice.value;
				}),
		}),
		{ calls },
	);
};

describe("updatePayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				UpdatePayload,
				UpdatePayload.make({
					execute: ({ path, passphrase }) =>
						Effect.succeed(
							new UpdatePayloadUpdatedSuccess({
								path,
								payloadId: "bspld_0123456789abcdef",
								reasons: ["self key is stale"],
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
			Layer.succeed(CreateUserIdentity, makeUnusedCreateUserIdentity()),
			Layer.succeed(HomeRepository, makeUnusedHomeRepository()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("success", (it) => {
		it.effect("prints concise updated message", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "update", "./.env.enc"]);

				expect(
					(
						prompt as typeof prompt & {
							inputSecretCalls: Array<{ message: string }>;
						}
					).inputSecretCalls,
				).toEqual([{ message: "Passphrase: " }]);
				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["updated ./.env.enc (self key is stale)\n"]);
			}),
		);

		it.effect("prints unchanged message when no rewrite is needed", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "update", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: ({ path }) =>
										Effect.succeed(
											new UpdatePayloadUnchangedSuccess({
												path,
												reasons: [],
											}),
										),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.stdout).toEqual([
					"payload already up to date: ./.env.enc\n",
				]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				UpdatePayload,
				UpdatePayload.make({
					execute: () =>
						Effect.fail(
							new UpdatePayloadCryptoError({
								message: "Failed to rewrite payload",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(CreateUserIdentity, makeUnusedCreateUserIdentity()),
			Layer.succeed(HomeRepository, makeUnusedHomeRepository()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("failure", (it) => {
		it.effect("prints stderr and fails on update app error", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"update",
					"./.env.enc",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(UpdatePayloadCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([["Failed to update payload: ./.env.enc", ""].join("\n")]);
			}),
		);

		it.effect("prints update-cli remediation for newer payload versions", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"update",
					"./.env.enc",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () =>
										Effect.fail(
											new UpdatePayloadVersionError({
												message:
													"CLI is too old to open this payload. Update CLI to latest version.",
											}),
										),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(UpdatePayloadCommandFailedError);
				}
				expect(prompt.stderr).toEqual([
					"CLI is too old to open this payload. Update CLI to latest version.\n",
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
							Command.withSubcommands([updatePayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					const result = yield* cli([
						"node",
						"bage",
						"update",
						"./.env.enc",
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									UpdatePayload,
									UpdatePayload.make({
										execute: () =>
											Effect.fail(
												new UpdatePayloadNoSelfIdentityError({
													message: [
														"No local self identity found",
														"Run: bage setup",
													].join("\n"),
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(prompt.stderr).toEqual([
						"No local self identity found\nRun: bage setup\n",
					]);
				}),
		);

		it.effect("runs setup gate then retries update in guided mode", () =>
			Effect.gen(function* () {
				const prompt = makePrompt({
					inputSecretAnswers: [
						"payload-passphrase",
						"setup-passphrase",
						"setup-passphrase",
					],
					inputTextAnswers: ["isaac"],
				});
				const interactivePrompt = makeInteractivePrompt(["Setup now"]);
				let updateCalls = 0;
				let setupCalls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "update"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: ({ path, passphrase }) =>
										Effect.suspend(() => {
											updateCalls += 1;
											return updateCalls === 1
												? Effect.fail(
														new UpdatePayloadNoSelfIdentityError({
															message: [
																"No local self identity found",
																"Run: bage setup",
															].join("\n"),
														}),
													)
												: Effect.succeed(
														new UpdatePayloadUpdatedSuccess({
															path,
															payloadId: "bspld_0123456789abcdef",
															reasons: ["self key is stale"],
														}),
													).pipe(
														Effect.tap(() =>
															Effect.sync(() => {
																expect(passphrase).toBe("payload-passphrase");
															}),
														),
													);
										}),
								}),
							),
							Layer.succeed(
								CreateUserIdentity,
								CreateUserIdentity.make({
									execute: ({ displayName, passphrase }) =>
										Effect.sync(() => {
											setupCalls += 1;
											expect(displayName).toBe("isaac");
											expect(passphrase).toBe("setup-passphrase");
											return new CreateUserIdentitySuccess({
												displayName: "isaac" as never,
												fingerprint: "bs1_0123456789abcdef" as never,
												handle: "isaac#01234567" as never,
												ownerId: "bsid1_0123456789abcdef" as never,
												privateKeyPath:
													"keys/bs1_0123456789abcdef.key.age" as never,
												publicKey:
													"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k" as never,
											});
										}),
								}),
							),
							Layer.succeed(
								HomeRepository,
								HomeRepository.make({
									deletePrivateKey: () => Effect.die("unused"),
									getActiveKey: Effect.die("unused"),
									getLocation: Effect.succeed({
										keysDirectory: "/tmp/keys",
										rootDirectory: "/tmp/home",
										stateFile: "/tmp/home/state.json",
									}),
									loadState: Effect.die("unused"),
									readPrivateKey: () => Effect.die("unused"),
									saveState: () => Effect.die("unused"),
									writePrivateKey: () => Effect.die("unused"),
									writePrivateKeyAtPath: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(updateCalls).toBe(2);
				expect(setupCalls).toBe(1);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Setup now" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Setup required",
					},
				]);
				expect(prompt.stdout).toEqual([
					[
						"Created user key bs1_0123456789abcdef (isaac)",
						"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k",
						"Home: /tmp/home",
						"",
					].join("\n"),
					"updated ./.env.enc (self key is stale)\n",
				]);
			}),
		);

		it.effect("treats prompt abort as quiet cancel", () =>
			Effect.gen(function* () {
				const prompt = Prompt.make({
					inputSecret: () =>
						Effect.fail(
							new PromptReadAbortedError({
								message: "aborted",
								prompt: "passphrase",
							}),
						),
					inputSecretPairFromStdin: Effect.die("unused"),
					inputText: () => Effect.die("unused"),
					writeStderr: () => Effect.die("unused"),
					writeStdout: () => Effect.die("unused"),
				});
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([updatePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"update",
					"./.env.enc",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Right");
			}),
		);
	});
});
