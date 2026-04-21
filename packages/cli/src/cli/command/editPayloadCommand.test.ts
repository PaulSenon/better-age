import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { EditPayload } from "../../app/edit-payload/EditPayload.js";
import {
	EditPayloadEnvError,
	EditPayloadOpenSuccess,
	EditPayloadRewrittenSuccess,
	EditPayloadUnchangedSuccess,
	EditPayloadUpdateRequiredError,
} from "../../app/edit-payload/EditPayloadError.js";
import { ResolveEditorCommand } from "../../app/shared/ResolveEditorCommand.js";
import { ResolveEditorCommandUnavailableError } from "../../app/shared/ResolveEditorCommandError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import { UpdatePayloadUpdatedSuccess } from "../../app/update-payload/UpdatePayloadError.js";
import { Editor } from "../../port/Editor.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import { TempFile } from "../../port/TempFile.js";
import { editPayloadCommand } from "./editPayloadCommand.js";

const makePrompt = (passphrase = "test-passphrase", inputTextValue = "Y") => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];
	const inputSecretCalls: Array<{ message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					return passphrase;
				}),
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
			inputSecretCalls,
			inputTextCalls,
			stderr,
			stdout,
		},
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

					if (answer === undefined) {
						throw new Error(`Missing answer for ${input.message}`);
					}

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

const makeResolvePayloadTarget = (resolvedPath = "./.env.enc") => {
	const calls: Array<Option.Option<string>> = [];

	return Object.assign(
		ResolvePayloadTarget.make({
			resolveExistingPath: (path) =>
				Effect.sync(() => {
					calls.push(path);
					return Option.match(path, {
						onNone: () => resolvedPath,
						onSome: (value) => value,
					});
				}),
		}),
		{ calls },
	);
};

const makeResolveEditorCommand = (command = "vim") =>
	ResolveEditorCommand.make({
		resolve: () => Effect.succeed(command),
	});

describe("editPayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				EditPayload,
				EditPayload.make({
					open: ({ path, passphrase }) =>
						Effect.succeed(
							new EditPayloadOpenSuccess({
								envText: "API_TOKEN=secret\nDEBUG=true\n",
								path,
							}),
						).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(passphrase).toBe("test-passphrase");
								}),
							),
						),
					save: ({ editedEnvText, path }) =>
						editedEnvText === "API_TOKEN=secret\nDEBUG=false\n"
							? Effect.succeed(
									new EditPayloadRewrittenSuccess({
										path,
										payloadId: "bspld_0123456789abcdef" as never,
									}),
								)
							: Effect.die(`unexpected env text: ${editedEnvText}`),
				}),
			),
			Layer.succeed(
				UpdatePayload,
				UpdatePayload.make({
					execute: ({ path }) =>
						Effect.succeed(
							new UpdatePayloadUpdatedSuccess({
								path,
								payloadId: "bspld_0123456789abcdef",
								reasons: ["self key is stale"],
							}),
						),
				}),
			),
			Layer.succeed(
				Editor,
				Editor.make({
					editFile: (_input) => Effect.void,
				}),
			),
			Layer.succeed(
				TempFile,
				(() => {
					let contents = "";
					const deleted: Array<string> = [];
					return Object.assign(
						TempFile.make({
							create: ({ initialContents }) =>
								Effect.sync(() => {
									contents = initialContents;
									return {
										path: "/tmp/edit.env",
									};
								}),
							delete: (path) =>
								Effect.sync(() => {
									deleted.push(path);
								}),
							read: (_path) =>
								Effect.sync(() => {
									contents = "API_TOKEN=secret\nDEBUG=false\n";
									return contents;
								}),
						}),
						{ deleted },
					);
				})(),
			),
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("success", (it) => {
		it.effect(
			"opens plaintext env, saves rewrite, prints success, and cleans up temp file",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const tempFile = yield* TempFile;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([editPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli(["node", "bage", "edit", "./.env.enc"]);

					expect(
						(
							prompt as typeof prompt & {
								inputSecretCalls: Array<{ message: string }>;
							}
						).inputSecretCalls,
					).toEqual([{ message: "Passphrase: " }]);
					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual(["Updated encrypted payload at ./.env.enc\n"]);
					expect(
						(tempFile as typeof tempFile & { deleted: Array<string> }).deleted,
					).toEqual(["/tmp/edit.env"]);
				}),
		);

		it.effect("resolves omitted path before editing", () =>
			Effect.gen(function* () {
				const resolvePayloadTarget = yield* ResolvePayloadTarget;
				(
					resolvePayloadTarget as typeof resolvePayloadTarget & {
						calls: Array<Option.Option<string>>;
					}
				).calls.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "edit"]);

				expect(
					(
						resolvePayloadTarget as typeof resolvePayloadTarget & {
							calls: Array<Option.Option<string>>;
						}
					).calls,
				).toEqual([Option.none()]);
			}),
		);

		it.effect("reopens editor when env is invalid, then succeeds", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const interactivePrompt = makeInteractivePrompt(["Reopen editor"]);
				let editCalls = 0;
				let saveCalls = 0;
				let contents = "";
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "edit", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: ({ path }) =>
										Effect.succeed(
											new EditPayloadOpenSuccess({
												envText: "API_TOKEN=secret\nDEBUG=true\n",
												path,
											}),
										),
									save: ({ editedEnvText, path }) =>
										Effect.suspend(() => {
											saveCalls += 1;
											if (editedEnvText === "API_TOKEN=one\nAPI_TOKEN=two\n") {
												return Effect.fail(
													new EditPayloadEnvError({
														message: "Env key is duplicated",
													}),
												);
											}
											return Effect.succeed(
												new EditPayloadRewrittenSuccess({
													path,
													payloadId: "bspld_0123456789abcdef" as never,
												}),
											);
										}),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) =>
										Effect.sync(() => {
											editCalls += 1;
											contents =
												editCalls === 1
													? "API_TOKEN=one\nAPI_TOKEN=two\n"
													: "API_TOKEN=secret\nDEBUG=false\n";
										}),
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: ({ initialContents }) =>
										Effect.sync(() => {
											contents = initialContents;
											return { path: "/tmp/edit.env" };
										}),
									delete: (_path) => Effect.void,
									read: (_path) => Effect.succeed(contents),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(editCalls).toBe(2);
				expect(saveCalls).toBe(2);
				expect(prompt.stderr).toEqual(["Env key is duplicated\n"]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Reopen editor" },
							{ title: "Discard changes and back" },
							{ title: "Cancel" },
						],
						message: "Edited env is invalid",
					},
				]);
				expect(prompt.stdout).toEqual([
					"Updated encrypted payload at ./.env.enc\n",
				]);
			}),
		);

		it.effect("discards invalid edited env and returns quietly", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const interactivePrompt = makeInteractivePrompt([
					"Discard changes and back",
				]);
				let editCalls = 0;
				let saveCalls = 0;
				let contents = "";
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "edit", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: ({ path }) =>
										Effect.succeed(
											new EditPayloadOpenSuccess({
												envText: "API_TOKEN=secret\nDEBUG=true\n",
												path,
											}),
										),
									save: ({ editedEnvText }) =>
										Effect.suspend(() => {
											saveCalls += 1;
											return editedEnvText === "API_TOKEN=one\nAPI_TOKEN=two\n"
												? Effect.fail(
														new EditPayloadEnvError({
															message: "Env key is duplicated",
														}),
													)
												: Effect.die("unexpected save");
										}),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) =>
										Effect.sync(() => {
											editCalls += 1;
											contents = "API_TOKEN=one\nAPI_TOKEN=two\n";
										}),
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: ({ initialContents }) =>
										Effect.sync(() => {
											contents = initialContents;
											return { path: "/tmp/edit.env" };
										}),
									delete: (_path) => Effect.void,
									read: (_path) => Effect.succeed(contents),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(editCalls).toBe(1);
				expect(saveCalls).toBe(1);
				expect(prompt.stderr).toEqual(["Env key is duplicated\n"]);
				expect(prompt.stdout).toEqual([]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Reopen editor" },
							{ title: "Discard changes and back" },
							{ title: "Cancel" },
						],
						message: "Edited env is invalid",
					},
				]);
			}),
		);

		it.effect("prints no-op message when env text is unchanged", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "edit", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: ({ path }) =>
										Effect.succeed(
											new EditPayloadOpenSuccess({
												envText: "API_TOKEN=secret\nDEBUG=true\n",
												path,
											}),
										),
									save: ({ path }) =>
										Effect.succeed(
											new EditPayloadUnchangedSuccess({
												path,
											}),
										),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) => Effect.void,
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: ({ initialContents }) =>
										Effect.succeed({
											path: "/tmp/edit.env",
											initialContents,
										}),
									delete: (_path) => Effect.void,
									read: (_path) =>
										Effect.succeed("API_TOKEN=secret\nDEBUG=true\n"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
							Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.stdout).toEqual(["No secret changes in ./.env.enc\n"]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				EditPayload,
				EditPayload.make({
					open: () =>
						Effect.fail(
							new EditPayloadUpdateRequiredError({
								message: "Payload must be updated before edit",
								path: "./.env.enc",
							}),
						),
					save: () => Effect.die("unused"),
				}),
			),
			Layer.succeed(
				UpdatePayload,
				UpdatePayload.make({
					execute: ({ path }) =>
						Effect.succeed(
							new UpdatePayloadUpdatedSuccess({
								path,
								payloadId: "bspld_0123456789abcdef",
								reasons: ["self key is stale"],
							}),
						),
				}),
			),
			Layer.succeed(
				Editor,
				Editor.make({
					editFile: (_input) => Effect.void,
				}),
			),
			Layer.succeed(
				TempFile,
				TempFile.make({
					create: (_input) => Effect.die("unused"),
					delete: (_path) => Effect.void,
					read: (_path) => Effect.die("unused"),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("failure", (it) => {
		it.effect("prints update remediation before opening editor", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("test-passphrase", "n");
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli(["node", "bage", "edit", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: () =>
										Effect.fail(
											new EditPayloadUpdateRequiredError({
												message: "Payload must be updated before edit",
												path: "./.env.enc",
											}),
										),
									save: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) => Effect.void,
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: (_input) => Effect.die("unused"),
									delete: (_path) => Effect.void,
									read: (_path) => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(
								InteractivePrompt,
								makeInteractivePrompt(["Cancel"]),
							),
							Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(prompt.stderr).toEqual([
					[
						"Payload must be updated before edit",
						"Run: bage update ./.env.enc",
						"",
					].join("\n"),
				]);
			}),
		);

		it.effect(
			"runs update then reopens editor when accepted in guided mode",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("test-passphrase", "Y");
					const interactivePrompt = makeInteractivePrompt(["Update now"]);
					let openCalls = 0;
					let updateCalls = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([editPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli(["node", "bage", "edit"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									EditPayload,
									EditPayload.make({
										open: ({ path }) =>
											Effect.suspend(() => {
												openCalls += 1;

												return openCalls === 1
													? Effect.fail(
															new EditPayloadUpdateRequiredError({
																message: "Payload must be updated before edit",
																path,
															}),
														)
													: Effect.succeed(
															new EditPayloadOpenSuccess({
																envText: "API_TOKEN=secret\nDEBUG=true\n",
																path,
															}),
														);
											}),
										save: ({ path }) =>
											Effect.succeed(
												new EditPayloadUnchangedSuccess({
													path,
												}),
											),
									}),
								),
								Layer.succeed(
									UpdatePayload,
									UpdatePayload.make({
										execute: ({ path }) =>
											Effect.sync(() => {
												updateCalls += 1;
												return new UpdatePayloadUpdatedSuccess({
													path,
													payloadId: "bspld_0123456789abcdef",
													reasons: ["self key is stale"],
												});
											}),
									}),
								),
								Layer.succeed(
									Editor,
									Editor.make({
										editFile: (_input) => Effect.void,
									}),
								),
								Layer.succeed(
									TempFile,
									TempFile.make({
										create: ({ initialContents }) =>
											Effect.succeed({
												path: "/tmp/edit.env",
												initialContents,
											}),
										delete: (_path) => Effect.void,
										read: (_path) =>
											Effect.succeed("API_TOKEN=secret\nDEBUG=true\n"),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(updateCalls).toBe(1);
					expect(openCalls).toBe(2);
					expect(prompt.inputSecretCalls).toEqual([
						{ message: "Passphrase: " },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Update now" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Payload needs update before continuing",
						},
					]);
				}),
		);

		it.effect("cancels quietly when guided update gate is cancelled", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("test-passphrase", "Y");
				const interactivePrompt = makeInteractivePrompt(["Cancel"]);
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "edit"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: ({ path }) =>
										Effect.fail(
											new EditPayloadUpdateRequiredError({
												message: "Payload must be updated before edit",
												path,
											}),
										),
									save: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) => Effect.void,
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: (_input) => Effect.die("unused"),
									delete: (_path) => Effect.void,
									read: (_path) => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.stderr).toEqual([]);
				expect(prompt.stdout).toEqual([]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Update now" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Payload needs update before continuing",
					},
				]);
			}),
		);

		it.effect(
			"returns to payload selection when guided update gate goes back",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("test-passphrase", "Y");
					const interactivePrompt = makeInteractivePrompt(["Back"]);
					const resolveCalls: Array<Option.Option<string>> = [];
					const openedPaths: Array<string> = [];
					const resolvedPaths = ["./stale.env.enc", "./fresh.env.enc"];
					let resolveIndex = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([editPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli(["node", "bage", "edit"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									EditPayload,
									EditPayload.make({
										open: ({ path }) =>
											Effect.suspend(() => {
												openedPaths.push(path);

												return path === "./stale.env.enc"
													? Effect.fail(
															new EditPayloadUpdateRequiredError({
																message: "Payload must be updated before edit",
																path,
															}),
														)
													: Effect.succeed(
															new EditPayloadOpenSuccess({
																envText: "API_TOKEN=secret\nDEBUG=true\n",
																path,
															}),
														);
											}),
										save: ({ path }) =>
											Effect.succeed(
												new EditPayloadUnchangedSuccess({
													path,
												}),
											),
									}),
								),
								Layer.succeed(
									UpdatePayload,
									UpdatePayload.make({
										execute: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									Editor,
									Editor.make({
										editFile: (_input) => Effect.void,
									}),
								),
								Layer.succeed(
									TempFile,
									TempFile.make({
										create: ({ initialContents }) =>
											Effect.succeed({
												initialContents,
												path: "/tmp/edit.env",
											}),
										delete: (_path) => Effect.void,
										read: (_path) =>
											Effect.succeed("API_TOKEN=secret\nDEBUG=true\n"),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
								Layer.succeed(
									ResolvePayloadTarget,
									ResolvePayloadTarget.make({
										resolveExistingPath: (path) =>
											Effect.sync(() => {
												resolveCalls.push(path);
												const resolvedPath = resolvedPaths[resolveIndex];

												if (resolvedPath === undefined) {
													throw new Error("Missing resolved path");
												}

												resolveIndex += 1;
												return resolvedPath;
											}),
									}),
								),
							),
						),
					);

					expect(resolveCalls).toEqual([Option.none(), Option.none()]);
					expect(openedPaths).toEqual(["./stale.env.enc", "./fresh.env.enc"]);
					expect(prompt.stdout).toEqual([
						"No secret changes in ./fresh.env.enc\n",
					]);
					expect(prompt.stderr).toEqual([]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Update now" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Payload needs update before continuing",
						},
					]);
				}),
		);

		it.effect("prints editor remediation when no editor is configured", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([editPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli(["node", "bage", "edit", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								EditPayload,
								EditPayload.make({
									open: ({ path }) =>
										Effect.succeed(
											new EditPayloadOpenSuccess({
												envText: "API_TOKEN=secret\nDEBUG=true\n",
												path,
											}),
										),
									save: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								TempFile,
								TempFile.make({
									create: ({ initialContents }) =>
										Effect.succeed({
											path: "/tmp/edit.env",
											initialContents,
										}),
									delete: (_path) => Effect.void,
									read: (_path) => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
							Layer.succeed(
								ResolveEditorCommand,
								ResolveEditorCommand.make({
									resolve: () =>
										Effect.fail(
											new ResolveEditorCommandUnavailableError({
												message: [
													"No editor configured.",
													"Set BETTER_AGE_EDITOR, use a saved default, or set $VISUAL/$EDITOR, then retry.",
													"",
												].join("\n"),
											}),
										),
								}),
							),
							Layer.succeed(
								Editor,
								Editor.make({
									editFile: (_input) => Effect.die("unused"),
								}),
							),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(prompt.inputSecretCalls).toEqual([]);
				expect(prompt.stderr).toEqual([
					[
						"No editor configured.",
						"Set BETTER_AGE_EDITOR, use a saved default, or set $VISUAL/$EDITOR, then retry.",
						"",
					].join("\n"),
				]);
			}),
		);

		it.effect(
			"prints stderr and fails when passphrase prompt is unavailable",
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
							Command.withSubcommands([editPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"edit",
						"./.env.enc",
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									EditPayload,
									EditPayload.make({
										open: () => Effect.die("unused"),
										save: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									Editor,
									Editor.make({
										editFile: (_input) => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									TempFile,
									TempFile.make({
										create: (_input) => Effect.die("unused"),
										delete: (_path) => Effect.void,
										read: (_path) => Effect.die("unused"),
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
								Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
								Layer.succeed(ResolveEditorCommand, makeResolveEditorCommand()),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(stderr).toEqual(["Missing required input for passphrase\n"]);
				}),
		);
	});
});
