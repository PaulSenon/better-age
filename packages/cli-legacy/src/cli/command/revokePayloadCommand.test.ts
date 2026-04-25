import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import { InspectPayloadSuccess } from "../../app/inspect-payload/InspectPayloadError.js";
import { RevokePayloadRecipient } from "../../app/revoke-payload-recipient/RevokePayloadRecipient.js";
import {
	RevokePayloadRecipientAmbiguousIdentityError,
	RevokePayloadRecipientForbiddenSelfError,
	RevokePayloadRecipientRemovedSuccess,
	RevokePayloadRecipientUnchangedSuccess,
	RevokePayloadRecipientUpdateRequiredError,
	RevokePayloadRecipientVersionError,
} from "../../app/revoke-payload-recipient/RevokePayloadRecipientError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import { UpdatePayloadUpdatedSuccess } from "../../app/update-payload/UpdatePayloadError.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import {
	RevokePayloadCommandFailedError,
	revokePayloadCommand,
} from "./revokePayloadCommand.js";

const makePrompt = (inputTextValue = "paul#aaaaaaaa") => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					return "test-passphrase";
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

describe("revokePayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectPayload,
				InspectPayload.make({
					execute: ({ path }) =>
						Effect.succeed(
							new InspectPayloadSuccess({
								createdAt: "2026-04-14T10:00:00.000Z",
								envKeys: ["API_TOKEN"],
								lastRewrittenAt: "2026-04-14T10:00:00.000Z",
								needsUpdate: {
									isRequired: false,
									reason: Option.none(),
								},
								path,
								payloadId: "bspld_0123456789abcdef" as never,
								recipientCount: 2,
								recipients: [
									{
										displayName: "isaac",
										fingerprint: "bs1_1111111111111111",
										handle: "isaac#069f7576",
										isMe: true,
										isStaleSelf: false,
										localAlias: Option.none(),
									},
									{
										displayName: "paul",
										fingerprint: "bs1_aaaaaaaaaaaaaaaa",
										handle: "paul#aaaaaaaa",
										isMe: false,
										isStaleSelf: false,
										localAlias: Option.none(),
									},
								],
								secretCount: 1,
								version: 2,
							}),
						),
				}),
			),
			Layer.succeed(
				RevokePayloadRecipient,
				RevokePayloadRecipient.make({
					execute: ({ identityRef, passphrase, path }) =>
						Effect.succeed(
							new RevokePayloadRecipientRemovedSuccess({
								path,
							}),
						).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(passphrase).toBe("test-passphrase");
									expect(identityRef).toBe("paul#aaaaaaaa");
								}),
							),
						),
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
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("success", (it) => {
		it.effect(
			"revokes from explicit handle arg and prints concise success",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					(prompt as typeof prompt & { stdout: Array<string> }).stdout.length =
						0;
					(prompt as typeof prompt & { stderr: Array<string> }).stderr.length =
						0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([revokePayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "revoke", "./.env.enc", "paul#aaaaaaaa"]);

					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual([
						["revoked recipient from ./.env.enc", "recipients: 2", ""].join(
							"\n",
						),
					]);
				}),
		);

		it.effect("opens granted-recipient picker when arg is omitted", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const interactivePrompt = makeInteractivePrompt([
					"paul (paul#aaaaaaaa)",
				]);
				(prompt as typeof prompt & { stdout: Array<string> }).stdout.length = 0;
				(prompt as typeof prompt & { stderr: Array<string> }).stderr.length = 0;
				(
					prompt as typeof prompt & {
						inputTextCalls: Array<{ message: string }>;
					}
				).inputTextCalls.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "revoke", "./.env.enc"]).pipe(
					Effect.provide(Layer.succeed(InteractivePrompt, interactivePrompt)),
				);

				expect(
					(
						prompt as typeof prompt & {
							inputTextCalls: Array<{ message: string }>;
						}
					).inputTextCalls,
				).toEqual([]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ disabled: true, title: "isaac (isaac#069f7576) [you]" },
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter ref" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose recipient",
					},
				]);
			}),
		);

		it.effect("resolves omitted path before revoking", () =>
			Effect.gen(function* () {
				const resolvePayloadTarget = yield* ResolvePayloadTarget;
				const interactivePrompt = makeInteractivePrompt([
					"paul (paul#aaaaaaaa)",
				]);
				(
					resolvePayloadTarget as typeof resolvePayloadTarget & {
						calls: Array<Option.Option<string>>;
					}
				).calls.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "revoke"]).pipe(
					Effect.provide(Layer.succeed(InteractivePrompt, interactivePrompt)),
				);

				expect(
					(
						resolvePayloadTarget as typeof resolvePayloadTarget & {
							calls: Array<Option.Option<string>>;
						}
					).calls,
				).toEqual([Option.none()]);
			}),
		);

		it.effect("prints no-op message when recipient is not granted", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli([
					"node",
					"bage",
					"revoke",
					"./.env.enc",
					"paul#aaaaaaaa",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								InspectPayload,
								InspectPayload.make({
									execute: ({ path }) =>
										Effect.succeed(
											new InspectPayloadSuccess({
												createdAt: "2026-04-14T10:00:00.000Z",
												envKeys: ["API_TOKEN"],
												lastRewrittenAt: "2026-04-14T10:00:00.000Z",
												needsUpdate: {
													isRequired: false,
													reason: Option.none(),
												},
												path,
												payloadId: "bspld_0123456789abcdef" as never,
												recipientCount: 2,
												recipients: [],
												secretCount: 1,
												version: 2,
											}),
										),
								}),
							),
							Layer.succeed(
								RevokePayloadRecipient,
								RevokePayloadRecipient.make({
									execute: ({ path }) =>
										Effect.succeed(
											new RevokePayloadRecipientUnchangedSuccess({
												path,
												reason: "recipient-not-granted",
											}),
										),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.stdout).toEqual([
					["recipient not granted in ./.env.enc", "recipients: 2", ""].join(
						"\n",
					),
				]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectPayload,
				InspectPayload.make({
					execute: ({ path }) =>
						Effect.succeed(
							new InspectPayloadSuccess({
								createdAt: "2026-04-14T10:00:00.000Z",
								envKeys: ["API_TOKEN"],
								lastRewrittenAt: "2026-04-14T10:00:00.000Z",
								needsUpdate: {
									isRequired: false,
									reason: Option.none(),
								},
								path,
								payloadId: "bspld_0123456789abcdef" as never,
								recipientCount: 2,
								recipients: [
									{
										displayName: "isaac",
										fingerprint: "bs1_1111111111111111",
										handle: "isaac#069f7576",
										isMe: true,
										isStaleSelf: false,
										localAlias: Option.none(),
									},
									{
										displayName: "isaac",
										fingerprint: "bs1_d9b8956011111111",
										handle: "isaac#d9b89560",
										isMe: false,
										isStaleSelf: false,
										localAlias: Option.none(),
									},
								],
								secretCount: 1,
								version: 2,
							}),
						),
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
			Layer.sync(Prompt, () => makePrompt()),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("failure", (it) => {
		it.effect("prints self-revoke failure", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				(prompt as typeof prompt & { stderr: Array<string> }).stderr.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"revoke",
					"./.env.enc",
					"isaac#069f7576",
				]).pipe(
					Effect.provide(
						Layer.succeed(
							RevokePayloadRecipient,
							RevokePayloadRecipient.make({
								execute: () =>
									Effect.fail(
										new RevokePayloadRecipientForbiddenSelfError({
											message:
												"Revoking current self identity is forbidden in v0",
										}),
									),
							}),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(RevokePayloadCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Revoking current self identity is forbidden in v0\n"]);
			}),
		);

		it.effect("re-prompts guided typed self target after edit action", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("isaac#069f7576");
				const interactivePrompt = makeInteractivePrompt([
					"Enter ref",
					"Edit input",
					"paul (paul#aaaaaaaa)",
				]);
				let revokeCalls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "revoke", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								InspectPayload,
								InspectPayload.make({
									execute: ({ path }) =>
										Effect.succeed(
											new InspectPayloadSuccess({
												createdAt: "2026-04-14T10:00:00.000Z",
												envKeys: ["API_TOKEN"],
												lastRewrittenAt: "2026-04-14T10:00:00.000Z",
												needsUpdate: {
													isRequired: false,
													reason: Option.none(),
												},
												path,
												payloadId: "bspld_0123456789abcdef" as never,
												recipientCount: 2,
												recipients: [
													{
														displayName: "isaac",
														fingerprint: "bs1_1111111111111111",
														handle: "isaac#069f7576",
														isMe: true,
														isStaleSelf: false,
														localAlias: Option.none(),
													},
													{
														displayName: "paul",
														fingerprint: "bs1_aaaaaaaaaaaaaaaa",
														handle: "paul#aaaaaaaa",
														isMe: false,
														isStaleSelf: false,
														localAlias: Option.none(),
													},
												],
												secretCount: 1,
												version: 2,
											}),
										),
								}),
							),
							Layer.succeed(
								RevokePayloadRecipient,
								RevokePayloadRecipient.make({
									execute: ({ identityRef, path }) =>
										Effect.suspend(() => {
											revokeCalls += 1;
											return identityRef === "isaac#069f7576"
												? Effect.fail(
														new RevokePayloadRecipientForbiddenSelfError({
															message:
																"Revoking current self identity is forbidden in v0",
														}),
													)
												: Effect.succeed(
														new RevokePayloadRecipientRemovedSuccess({
															path,
														}),
													);
										}),
								}),
							),
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(revokeCalls).toBe(2);
				expect(prompt.stderr).toEqual([
					"Revoking current self identity is forbidden in v0\n",
				]);
				expect(prompt.stdout).toEqual([
					["revoked recipient from ./.env.enc", "recipients: 2", ""].join("\n"),
				]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ disabled: true, title: "isaac (isaac#069f7576) [you]" },
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter ref" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose recipient",
					},
					{
						choices: [
							{ title: "Edit input" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Identity input error",
					},
					{
						choices: [
							{ disabled: true, title: "isaac (isaac#069f7576) [you]" },
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter ref" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose recipient",
					},
				]);
			}),
		);

		it.effect("prints [you] on ambiguous self candidate", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				(prompt as typeof prompt & { stderr: Array<string> }).stderr.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"revoke",
					"./.env.enc",
					"isaac",
				]).pipe(
					Effect.provide(
						Layer.succeed(
							RevokePayloadRecipient,
							RevokePayloadRecipient.make({
								execute: () =>
									Effect.fail(
										new RevokePayloadRecipientAmbiguousIdentityError({
											candidates: ["isaac#069f7576", "isaac#d9b89560"] as never,
											identityRef: "isaac",
											message: "Identity ref is ambiguous",
										}),
									),
							}),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					[
						"Identity ref is ambiguous: isaac",
						"isaac (isaac#069f7576) [you]",
						"isaac (isaac#d9b89560)",
						"",
					].join("\n"),
				]);
			}),
		);

		it.effect(
			"prints update remediation when payload must be updated first",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("n");
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([revokePayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "revoke", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									InspectPayload,
									InspectPayload.make({
										execute: ({ path }) =>
											Effect.succeed(
												new InspectPayloadSuccess({
													createdAt: "2026-04-14T10:00:00.000Z",
													envKeys: ["API_TOKEN"],
													lastRewrittenAt: "2026-04-14T10:00:00.000Z",
													needsUpdate: {
														isRequired: false,
														reason: Option.none(),
													},
													path,
													payloadId: "bspld_0123456789abcdef" as never,
													recipientCount: 1,
													recipients: [
														{
															displayName: "paul",
															fingerprint: "bs1_aaaaaaaaaaaaaaaa",
															handle: "paul#aaaaaaaa",
															isMe: false,
															isStaleSelf: false,
															localAlias: Option.none(),
														},
													],
													secretCount: 1,
													version: 2,
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
									RevokePayloadRecipient,
									RevokePayloadRecipient.make({
										execute: ({ path }) =>
											Effect.fail(
												new RevokePayloadRecipientUpdateRequiredError({
													message: "Payload must be updated before revoke",
													path,
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(
									InteractivePrompt,
									makeInteractivePrompt(["paul (paul#aaaaaaaa)", "Cancel"]),
								),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(prompt.stderr).toEqual([]);
					expect(prompt.stdout).toEqual([]);
				}),
		);

		it.effect(
			"prints update-cli remediation when payload version is unsupported",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("n");
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([revokePayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					const result = yield* cli([
						"node",
						"bage",
						"revoke",
						"./.env.enc",
						"paul#aaaaaaaa",
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									InspectPayload,
									InspectPayload.make({
										execute: ({ path }) =>
											Effect.succeed(
												new InspectPayloadSuccess({
													createdAt: "2026-04-14T10:00:00.000Z",
													envKeys: ["API_TOKEN"],
													lastRewrittenAt: "2026-04-14T10:00:00.000Z",
													needsUpdate: {
														isRequired: false,
														reason: Option.none(),
													},
													path,
													payloadId: "bspld_0123456789abcdef" as never,
													recipientCount: 1,
													recipients: [],
													secretCount: 1,
													version: 2,
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
									RevokePayloadRecipient,
									RevokePayloadRecipient.make({
										execute: () =>
											Effect.fail(
												new RevokePayloadRecipientVersionError({
													message:
														"CLI is too old to open this payload. Update CLI to latest version.",
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					expect(prompt.stderr).toEqual([
						"CLI is too old to open this payload. Update CLI to latest version.\n",
					]);
				}),
		);

		it.effect("runs update then retries revoke when accepted", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("Y");
				const interactivePrompt = makeInteractivePrompt([
					"paul (paul#aaaaaaaa)",
					"Update now",
				]);
				let revokeCalls = 0;
				let updateCalls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([revokePayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "revoke", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								InspectPayload,
								InspectPayload.make({
									execute: ({ path }) =>
										Effect.succeed(
											new InspectPayloadSuccess({
												createdAt: "2026-04-14T10:00:00.000Z",
												envKeys: ["API_TOKEN"],
												lastRewrittenAt: "2026-04-14T10:00:00.000Z",
												needsUpdate: {
													isRequired: false,
													reason: Option.none(),
												},
												path,
												payloadId: "bspld_0123456789abcdef" as never,
												recipientCount: 1,
												recipients: [
													{
														displayName: "paul",
														fingerprint: "bs1_aaaaaaaaaaaaaaaa",
														handle: "paul#aaaaaaaa",
														isMe: false,
														isStaleSelf: false,
														localAlias: Option.none(),
													},
												],
												secretCount: 1,
												version: 2,
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
								RevokePayloadRecipient,
								RevokePayloadRecipient.make({
									execute: ({ path }) =>
										Effect.suspend(() => {
											revokeCalls += 1;
											return revokeCalls === 1
												? Effect.fail(
														new RevokePayloadRecipientUpdateRequiredError({
															message: "Payload must be updated before revoke",
															path,
														}),
													)
												: Effect.succeed(
														new RevokePayloadRecipientRemovedSuccess({
															path,
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

				expect(updateCalls).toBe(1);
				expect(revokeCalls).toBe(2);
				expect(prompt.inputSecretCalls).toEqual([{ message: "Passphrase: " }]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter ref" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose recipient",
					},
					{
						choices: [
							{ title: "Update now" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Payload needs update before continuing",
					},
				]);
				expect(prompt.stdout).toEqual([
					["revoked recipient from ./.env.enc", "recipients: 1", ""].join("\n"),
				]);
			}),
		);

		it.effect(
			"returns to recipient selection when guided update gate goes back",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("Y");
					const interactivePrompt = makeInteractivePrompt([
						"paul (paul#aaaaaaaa)",
						"Back",
						"anne (anne#cccccccc)",
					]);
					let revokeCalls = 0;
					let updateCalls = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([revokePayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "revoke", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									InspectPayload,
									InspectPayload.make({
										execute: ({ path }) =>
											Effect.succeed(
												new InspectPayloadSuccess({
													createdAt: "2026-04-14T10:00:00.000Z",
													envKeys: ["API_TOKEN"],
													lastRewrittenAt: "2026-04-14T10:00:00.000Z",
													needsUpdate: {
														isRequired: false,
														reason: Option.none(),
													},
													path,
													payloadId: "bspld_0123456789abcdef" as never,
													recipientCount: 2,
													recipients: [
														{
															displayName: "paul",
															fingerprint: "bs1_aaaaaaaaaaaaaaaa",
															handle: "paul#aaaaaaaa",
															isMe: false,
															isStaleSelf: false,
															localAlias: Option.none(),
														},
														{
															displayName: "anne",
															fingerprint: "bs1_cccccccccccccccc",
															handle: "anne#cccccccc",
															isMe: false,
															isStaleSelf: false,
															localAlias: Option.none(),
														},
													],
													secretCount: 1,
													version: 2,
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
									RevokePayloadRecipient,
									RevokePayloadRecipient.make({
										execute: ({ identityRef, path }) =>
											Effect.suspend(() => {
												revokeCalls += 1;
												return identityRef === "paul#aaaaaaaa"
													? Effect.fail(
															new RevokePayloadRecipientUpdateRequiredError({
																message:
																	"Payload must be updated before revoke",
																path,
															}),
														)
													: Effect.succeed(
															new RevokePayloadRecipientRemovedSuccess({
																path,
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

					expect(updateCalls).toBe(0);
					expect(revokeCalls).toBe(2);
					expect(prompt.inputSecretCalls).toEqual([
						{ message: "Passphrase: " },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "anne (anne#cccccccc)" },
								{ title: "Enter ref" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose recipient",
						},
						{
							choices: [
								{ title: "Update now" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Payload needs update before continuing",
						},
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "anne (anne#cccccccc)" },
								{ title: "Enter ref" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose recipient",
						},
					]);
					expect(prompt.stdout).toEqual([
						["revoked recipient from ./.env.enc", "recipients: 2", ""].join(
							"\n",
						),
					]);
				}),
		);
	});
});
