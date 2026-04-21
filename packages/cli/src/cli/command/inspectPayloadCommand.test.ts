import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import {
	InspectPayloadCryptoError,
	InspectPayloadSuccess,
} from "../../app/inspect-payload/InspectPayloadError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import {
	InspectPayloadCommandFailedError,
	inspectPayloadCommand,
} from "./inspectPayloadCommand.js";

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

describe("inspectPayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectPayload,
				InspectPayload.make({
					execute: ({ path, passphrase }) =>
						Effect.succeed(
							new InspectPayloadSuccess({
								createdAt: "2026-04-14T10:00:00.000Z",
								envKeys: ["API_TOKEN", "DEBUG"],
								lastRewrittenAt: "2026-04-14T11:00:00.000Z",
								needsUpdate: {
									isRequired: true,
									reason: Option.some("self key is stale"),
								},
								path,
								payloadId: "bspld_0123456789abcdef" as never,
								recipientCount: 2,
								recipients: [
									{
										displayName: "isaac-mbp",
										fingerprint: "bs1_0123456789abcdef",
										handle: "isaac-mbp#069f7576",
										isMe: true,
										isStaleSelf: true,
										localAlias: Option.none(),
									},
									{
										displayName: "paul",
										fingerprint: "bs1_aaaaaaaaaaaaaaaa",
										handle: "paul#aaaaaaaa",
										isMe: false,
										isStaleSelf: false,
										localAlias: Option.some("ops-paul"),
									},
								],
								secretCount: 2,
								version: 1,
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
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("success", (it) => {
		it.effect(
			"prompts for passphrase and prints human-readable inspect output",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([inspectPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					yield* cli(["node", "bage", "inspect", "./.env.enc"]);

					expect(
						(
							prompt as typeof prompt & {
								inputSecretCalls: Array<{ message: string }>;
							}
						).inputSecretCalls,
					).toEqual([{ message: "Passphrase: " }]);
					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual([
						[
							"Payload",
							"path: ./.env.enc",
							"version: 1",
							"payload id: bspld_0123456789abcdef",
							"created at: 2026-04-14T10:00:00.000Z",
							"last rewritten at: 2026-04-14T11:00:00.000Z",
							"secret count: 2",
							"recipient count: 2",
							"needs update: yes (self key is stale)",
							"",
							"Recipients",
							"isaac-mbp (isaac-mbp#069f7576) [you] bs1_01234567 stale-self",
							"ops-paul: paul (paul#aaaaaaaa) bs1_aaaaaaaa",
							"",
							"Env keys",
							"API_TOKEN",
							"DEBUG",
							"",
							"",
						].join("\n"),
					]);
				}),
		);

		it.effect("resolves omitted path before inspection", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const resolvePayloadTarget = yield* ResolvePayloadTarget;
				(
					resolvePayloadTarget as typeof resolvePayloadTarget & {
						calls: Array<Option.Option<string>>;
					}
				).calls.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([inspectPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "inspect"]);

				expect(
					(
						resolvePayloadTarget as typeof resolvePayloadTarget & {
							calls: Array<Option.Option<string>>;
						}
					).calls,
				).toEqual([Option.none()]);
				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout[0],
				).toContain("path: ./.env.enc");
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectPayload,
				InspectPayload.make({
					execute: () =>
						Effect.fail(
							new InspectPayloadCryptoError({
								message: "Failed to decrypt payload envelope",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("failure", (it) => {
		it.effect(
			"prints normalized stderr and fails on exact decrypt failure",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([inspectPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"inspect",
						"./.env.enc",
					]).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(
							InspectPayloadCommandFailedError,
						);
					}
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual(["Failed to decrypt payload with provided passphrase\n"]);
				}),
		);

		it.effect("retries passphrase in guided mode after decrypt failure", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const interactivePrompt = makeInteractivePrompt(["Retry passphrase"]);
				let calls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([inspectPayloadCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "inspect"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								InspectPayload,
								InspectPayload.make({
									execute: ({ path }) =>
										Effect.suspend(() => {
											calls += 1;
											return calls === 1
												? Effect.fail(
														new InspectPayloadCryptoError({
															message: "Failed to decrypt payload envelope",
														}),
													)
												: Effect.succeed(
														new InspectPayloadSuccess({
															createdAt: "2026-04-14T10:00:00.000Z",
															envKeys: ["API_TOKEN"],
															lastRewrittenAt: "2026-04-14T11:00:00.000Z",
															needsUpdate: {
																isRequired: false,
																reason: Option.none(),
															},
															path,
															payloadId: "bspld_0123456789abcdef" as never,
															recipientCount: 1,
															recipients: [],
															secretCount: 1,
															version: 1,
														}),
													);
										}),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.inputSecretCalls).toEqual([
					{ message: "Passphrase: " },
					{ message: "Passphrase: " },
				]);
				expect(prompt.stderr).toEqual([
					"Failed to decrypt payload with provided passphrase\n",
				]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "Retry passphrase" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Passphrase failed",
					},
				]);
				expect(prompt.stdout[0]).toContain("path: ./.env.enc");
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
							Command.withSubcommands([inspectPayloadCommand]),
						),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli([
						"node",
						"bage",
						"inspect",
						"./.env.enc",
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									InspectPayload,
									InspectPayload.make({
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
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
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
	});
});
