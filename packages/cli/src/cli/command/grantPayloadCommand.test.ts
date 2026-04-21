import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { GrantPayloadRecipient } from "../../app/grant-payload-recipient/GrantPayloadRecipient.js";
import {
	GrantPayloadRecipientAddedSuccess,
	GrantPayloadRecipientAmbiguousIdentityError,
	GrantPayloadRecipientUnchangedSuccess,
	GrantPayloadRecipientUpdateRequiredError,
	GrantPayloadRecipientVersionError,
} from "../../app/grant-payload-recipient/GrantPayloadRecipientError.js";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import {
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	ImportIdentityStringSuccess,
} from "../../app/import-identity-string/ImportIdentityStringError.js";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import { InspectPayloadSuccess } from "../../app/inspect-payload/InspectPayloadError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import { UpdatePayloadUpdatedSuccess } from "../../app/update-payload/UpdatePayloadError.js";
import { emptyHomeState, type HomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import {
	encodeIdentityString,
	IdentityStringPayload,
} from "../../domain/identity/IdentityString.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import {
	GrantPayloadCommandFailedError,
	grantPayloadCommand,
} from "./grantPayloadCommand.js";

const importedPaulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const importedPaulHandle = Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa");
const importedAnneDisplayName = Schema.decodeUnknownSync(DisplayName)("anne");
const importedAnneHandle = Schema.decodeUnknownSync(Handle)("anne#cccccccc");
const otherPaulHandle = Schema.decodeUnknownSync(Handle)("paul#bbbbbbbb");
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac#069f7576");
const guidedCollisionDisplayName =
	Schema.decodeUnknownSync(DisplayName)("isaac");
const guidedCollisionHandle =
	Schema.decodeUnknownSync(Handle)("isaac#99999999");
const exactCollisionDisplayName =
	Schema.decodeUnknownSync(DisplayName)("isaac");
const exactCollisionHandle = Schema.decodeUnknownSync(Handle)("isaac#88888888");
const guidedCollisionIdentityString = encodeIdentityString(
	Schema.decodeUnknownSync(IdentityStringPayload)({
		displayName: guidedCollisionDisplayName,
		fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
			"bs1_9999999999999999",
		),
		handle: guidedCollisionHandle,
		identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
			"2026-04-20T10:00:00.000Z",
		),
		ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_9999999999999999"),
		publicKey: Schema.decodeUnknownSync(PublicKey)("age1colliding"),
		version: "v1",
	}),
);
const exactCollisionIdentityString = encodeIdentityString(
	Schema.decodeUnknownSync(IdentityStringPayload)({
		displayName: exactCollisionDisplayName,
		fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
			"bs1_8888888888888888",
		),
		handle: exactCollisionHandle,
		identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
			"2026-04-20T10:00:00.000Z",
		),
		ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_8888888888888888"),
		publicKey: Schema.decodeUnknownSync(PublicKey)("age1exact"),
		version: "v1",
	}),
);

const makePrompt = (
	inputTextValue: string | ReadonlyArray<string> = "paul#aaaaaaaa",
) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];
	const inputTextValues = Array.isArray(inputTextValue)
		? [...inputTextValue]
		: [inputTextValue];

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					return "test-passphrase";
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (input) =>
				Effect.suspend(() => {
					inputTextCalls.push(input);
					const nextValue = inputTextValues.shift();

					if (nextValue === undefined) {
						return Effect.dieMessage(
							`Missing inputText answer for ${input.message}`,
						);
					}

					return Effect.succeed(nextValue);
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

const makeHomeRepository = (
	knownIdentities: HomeState["knownIdentities"] = [
		{
			displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
			fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
				"bs1_aaaaaaaaaaaaaaaa",
			),
			handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
			identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
				"2026-04-14T10:00:00.000Z",
			),
			localAlias: Option.none(),
			ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
			publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
		},
	],
) =>
	HomeRepository.make({
		deletePrivateKey: (_privateKeyPath) => Effect.void,
		getActiveKey: Effect.die("unused"),
		getLocation: Effect.die("unused"),
		loadState: Effect.succeed({
			...emptyHomeState(),
			knownIdentities,
			self: Option.some({
				createdAt: "2026-04-14T10:00:00.000Z",
				displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
				fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
					"bs1_1111111111111111",
				),
				handle: selfHandle,
				identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
					"2026-04-14T10:00:00.000Z",
				),
				keyMode: "pq-hybrid",
				ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
				privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
					"keys/active.key.age",
				),
				publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
			}),
		}),
		readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
		saveState: (_state) => Effect.void,
		writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
		writePrivateKeyAtPath: (_input) => Effect.die("unused"),
	});

describe("grantPayloadCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(HomeRepository, makeHomeRepository()),
			Layer.succeed(
				ImportIdentityString,
				ImportIdentityString.make({
					execute: () =>
						Effect.succeed(
							new ImportIdentityStringSuccess({
								displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
								handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
								outcome: "added",
							}),
						),
				}),
			),
			Layer.succeed(
				GrantPayloadRecipient,
				GrantPayloadRecipient.make({
					execute: ({ identityRef, passphrase, path }) =>
						Effect.succeed(
							new GrantPayloadRecipientAddedSuccess({
								handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
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
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("success", (it) => {
		it.effect(
			"grants from explicit handle arg and prints concise success",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					(prompt as typeof prompt & { stdout: Array<string> }).stdout.length =
						0;
					(prompt as typeof prompt & { stderr: Array<string> }).stderr.length =
						0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc", "paul#aaaaaaaa"]);

					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual([
						["granted paul#aaaaaaaa in ./.env.enc", "recipients: 2", ""].join(
							"\n",
						),
					]);
				}),
		);

		it.effect("opens known-identity picker when arg is omitted", () =>
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
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
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
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter identity" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose identity",
					},
				]);
			}),
		);

		it.effect("resolves omitted path before granting", () =>
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
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "grant"]).pipe(
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

		it.effect(
			"opens unified enter-identity branch before importing identity string",
			() =>
				Effect.gen(function* () {
					let importedIdentityString: string | null = null;
					const prompt = makePrompt(
						"better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ",
					);
					const interactivePrompt = makeInteractivePrompt(["Enter identity"]);
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: ({ identityString }) =>
											Effect.sync(() => {
												importedIdentityString = identityString;
												return new ImportIdentityStringSuccess({
													displayName: importedPaulDisplayName,
													handle: importedPaulHandle,
													outcome: "added",
												});
											}),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ path }) =>
											Effect.succeed(
												new GrantPayloadRecipientAddedSuccess({
													handle: importedPaulHandle,
													path,
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(importedIdentityString).toBe(
						"better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ",
					);
					expect(prompt.inputTextCalls).toEqual([{ message: "Identity" }]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
						},
					]);
				}),
		);

		it.effect("prints warning for unchanged outdated-input result", () =>
			Effect.gen(function* () {
				const prompt = makePrompt();
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli([
					"node",
					"bage",
					"grant",
					"./.env.enc",
					"paul#aaaaaaaa",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(HomeRepository, makeHomeRepository()),
							Layer.succeed(
								ImportIdentityString,
								ImportIdentityString.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								GrantPayloadRecipient,
								GrantPayloadRecipient.make({
									execute: ({ path }) =>
										Effect.succeed(
											new GrantPayloadRecipientUnchangedSuccess({
												handle: importedPaulHandle,
												path,
												reason: "outdated-input",
											}),
										),
								}),
							),
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
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(prompt.stdout).toEqual([
					[
						"provided identity is outdated; recipient already has newer access: paul#aaaaaaaa",
						"recipients: 2",
						"",
					].join("\n"),
				]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(HomeRepository, makeHomeRepository()),
			Layer.succeed(
				ImportIdentityString,
				ImportIdentityString.make({
					execute: () => Effect.die("unused"),
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
			Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		),
	)("failure", (it) => {
		it.effect("prints [you] on ambiguous self candidate", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				(prompt as typeof prompt & { stderr: Array<string> }).stderr.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"grant",
					"./.env.enc",
					"isaac",
				]).pipe(
					Effect.provide(
						Layer.succeed(
							GrantPayloadRecipient,
							GrantPayloadRecipient.make({
								execute: () =>
									Effect.fail(
										new GrantPayloadRecipientAmbiguousIdentityError({
											candidates: [selfHandle, otherPaulHandle],
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
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(GrantPayloadCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					[
						"Identity ref is ambiguous: isaac",
						"isaac (isaac#069f7576) [you]",
						"paul#bbbbbbbb",
						"",
					].join("\n"),
				]);
			}),
		);

		it.effect(
			"re-prompts guided entered ambiguous identity and lets user choose candidate",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("isaac");
					const interactivePrompt = makeInteractivePrompt([
						"Enter identity",
						"Choose candidate",
						"paul#bbbbbbbb",
					]);
					let grantCalls = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ identityRef, path }) =>
											Effect.suspend(() => {
												grantCalls += 1;
												return grantCalls === 1
													? Effect.fail(
															new GrantPayloadRecipientAmbiguousIdentityError({
																candidates: [selfHandle, otherPaulHandle],
																identityRef: "isaac",
																message: "Identity ref is ambiguous",
															}),
														)
													: Effect.succeed(
															new GrantPayloadRecipientAddedSuccess({
																handle: otherPaulHandle,
																path,
															}),
														).pipe(
															Effect.tap(() =>
																Effect.sync(() => {
																	expect(identityRef).toBe("paul#bbbbbbbb");
																}),
															),
														);
											}),
									}),
								),
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
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(grantCalls).toBe(2);
					expect(prompt.stderr).toEqual([
						[
							"Identity ref is ambiguous: isaac",
							"isaac (isaac#069f7576) [you]",
							"paul#bbbbbbbb",
							"",
						].join("\n"),
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
						},
						{
							choices: [
								{ title: "Choose candidate" },
								{ title: "Edit input" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Identity ref is ambiguous",
						},
						{
							choices: [
								{ title: "isaac (isaac#069f7576) [you]" },
								{ title: "paul#bbbbbbbb" },
							],
							message: "Choose candidate",
						},
					]);
				}),
		);

		it.effect("prints self identity string failure for exact grant arg", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				(prompt as typeof prompt & { stderr: Array<string> }).stderr.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"grant",
					"./.env.enc",
					"better-age://identity/v1/self",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
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
								GrantPayloadRecipient,
								GrantPayloadRecipient.make({
									execute: () => Effect.die("unused"),
								}),
							),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Cannot grant your own identity string\n"]);
			}),
		);

		it.effect(
			"re-prompts guided entered invalid identity string after edit action",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("better-age://identity/v1/not-valid-json");
					const interactivePrompt = makeInteractivePrompt([
						"Enter identity",
						"Edit input",
						"paul (paul#aaaaaaaa)",
					]);
					let importCalls = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: ({ identityString }) =>
											Effect.suspend(() => {
												importCalls += 1;
												return identityString ===
													"better-age://identity/v1/not-valid-json"
													? Effect.fail(
															new ImportIdentityStringDecodeError({
																message: "Identity string is malformed",
															}),
														)
													: Effect.die("unused");
											}),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ identityRef, path }) =>
											Effect.succeed(
												new GrantPayloadRecipientAddedSuccess({
													handle: Schema.decodeUnknownSync(Handle)(identityRef),
													path,
												}),
											),
									}),
								),
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
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
						Effect.either,
					);

					expect(importCalls).toBe(1);
					expect(prompt.stderr).toEqual(["Identity string is malformed\n"]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
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
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
						},
					]);
				}),
		);

		it.effect(
			"prompts for local alias when entered identity string would collide by visible label",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt([
						guidedCollisionIdentityString,
						"ops-isaac",
					]);
					const interactivePrompt = makeInteractivePrompt(["Enter identity"]);
					let importedLocalAlias: Option.Option<string> | undefined;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: ({ localAlias }) =>
											Effect.sync(() => {
												importedLocalAlias =
													localAlias?._tag === "Some"
														? Option.some(localAlias.value)
														: Option.none();
												return new ImportIdentityStringSuccess({
													displayName: guidedCollisionDisplayName,
													handle: guidedCollisionHandle,
													outcome: "added",
												});
											}),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ path }) =>
											Effect.succeed(
												new GrantPayloadRecipientAddedSuccess({
													handle:
														Schema.decodeUnknownSync(Handle)("isaac#99999999"),
													path,
												}),
											),
									}),
								),
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
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(prompt.inputTextCalls).toEqual([
						{ message: "Identity" },
						{ message: "Local alias" },
					]);
					expect(importedLocalAlias).toEqual(Option.some("ops-isaac"));
				}),
		);

		it.effect(
			"does not prompt for local alias in exact mode even when entered identity string collides",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt();
					let importedLocalAlias: Option.Option<string> | undefined;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli([
						"node",
						"bage",
						"grant",
						"./.env.enc",
						exactCollisionIdentityString,
					]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: ({ localAlias }) =>
											Effect.sync(() => {
												importedLocalAlias =
													localAlias?._tag === "Some"
														? Option.some(localAlias.value)
														: Option.none();
												return new ImportIdentityStringSuccess({
													displayName: exactCollisionDisplayName,
													handle: exactCollisionHandle,
													outcome: "added",
												});
											}),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ path }) =>
											Effect.succeed(
												new GrantPayloadRecipientAddedSuccess({
													handle:
														Schema.decodeUnknownSync(Handle)("isaac#88888888"),
													path,
												}),
											),
									}),
								),
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
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(prompt.inputTextCalls).toEqual([]);
					expect(importedLocalAlias).toEqual(Option.none());
				}),
		);

		it.effect(
			"prints update remediation when payload must be updated first",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("n");
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(HomeRepository, makeHomeRepository()),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									UpdatePayload,
									UpdatePayload.make({
										execute: () => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ path }) =>
											Effect.fail(
												new GrantPayloadRecipientUpdateRequiredError({
													message: "Payload must be updated before grant",
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
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(prompt.stderr).toEqual([]);
					expect(prompt.stdout).toEqual([]);
				}),
		);

		it.effect("prints update-cli remediation when payload version is unsupported", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("n");
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(HomeRepository, makeHomeRepository()),
							Layer.succeed(
								ImportIdentityString,
								ImportIdentityString.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								UpdatePayload,
								UpdatePayload.make({
									execute: () => Effect.die("unused"),
								}),
							),
							Layer.succeed(
								GrantPayloadRecipient,
								GrantPayloadRecipient.make({
									execute: () =>
										Effect.fail(
											new GrantPayloadRecipientVersionError({
												message:
													"CLI is too old to open this payload. Update CLI to latest version.",
											}),
										),
								}),
							),
							Layer.succeed(Prompt, prompt),
							Layer.succeed(
								InteractivePrompt,
								makeInteractivePrompt(["paul (paul#aaaaaaaa)"]),
							),
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

		it.effect("runs update then retries grant when accepted", () =>
			Effect.gen(function* () {
				const prompt = makePrompt("Y");
				const interactivePrompt = makeInteractivePrompt([
					"paul (paul#aaaaaaaa)",
					"Update now",
				]);
				let grantCalls = 0;
				let updateCalls = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([grantPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(HomeRepository, makeHomeRepository()),
							Layer.succeed(
								ImportIdentityString,
								ImportIdentityString.make({
									execute: () => Effect.die("unused"),
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
								GrantPayloadRecipient,
								GrantPayloadRecipient.make({
									execute: ({ path }) =>
										Effect.suspend(() => {
											grantCalls += 1;
											return grantCalls === 1
												? Effect.fail(
														new GrantPayloadRecipientUpdateRequiredError({
															message: "Payload must be updated before grant",
															path,
														}),
													)
												: Effect.succeed(
														new GrantPayloadRecipientAddedSuccess({
															handle: importedPaulHandle,
															path,
														}),
													);
										}),
								}),
							),
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
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
						),
					),
				);

				expect(updateCalls).toBe(1);
				expect(grantCalls).toBe(2);
				expect(prompt.inputSecretCalls).toEqual([{ message: "Passphrase: " }]);
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "paul (paul#aaaaaaaa)" },
							{ title: "Enter identity" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Choose identity",
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
					["granted paul#aaaaaaaa in ./.env.enc", "recipients: 2", ""].join(
						"\n",
					),
				]);
			}),
		);

		it.effect(
			"returns to identity selection when guided update gate goes back",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt("Y");
					const interactivePrompt = makeInteractivePrompt([
						"paul (paul#aaaaaaaa)",
						"Back",
						"anne (anne#cccccccc)",
					]);
					let grantCalls = 0;
					let updateCalls = 0;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([grantPayloadCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "grant", "./.env.enc"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									HomeRepository,
									makeHomeRepository([
										{
											displayName: importedPaulDisplayName,
											fingerprint: "bs1_aaaaaaaaaaaaaaaa" as never,
											handle: importedPaulHandle,
											identityUpdatedAt: "2026-04-14T10:00:00.000Z" as never,
											localAlias: Option.none(),
											ownerId: "bsid1_aaaaaaaaaaaaaaaa" as never,
											publicKey: "age1paul" as never,
										},
										{
											displayName: importedAnneDisplayName,
											fingerprint: "bs1_cccccccccccccccc" as never,
											handle: importedAnneHandle,
											identityUpdatedAt: "2026-04-14T10:00:00.000Z" as never,
											localAlias: Option.none(),
											ownerId: "bsid1_cccccccccccccccc" as never,
											publicKey: "age1anne" as never,
										},
									]),
								),
								Layer.succeed(
									ImportIdentityString,
									ImportIdentityString.make({
										execute: () => Effect.die("unused"),
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
									GrantPayloadRecipient,
									GrantPayloadRecipient.make({
										execute: ({ identityRef, path }) =>
											Effect.suspend(() => {
												grantCalls += 1;
												return identityRef === importedPaulHandle
													? Effect.fail(
															new GrantPayloadRecipientUpdateRequiredError({
																message: "Payload must be updated before grant",
																path,
															}),
														)
													: Effect.succeed(
															new GrantPayloadRecipientAddedSuccess({
																handle: importedAnneHandle,
																path,
															}),
														);
											}),
									}),
								),
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
													recipientCount: 3,
													recipients: [],
													secretCount: 1,
													version: 2,
												}),
											),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
							),
						),
					);

					expect(updateCalls).toBe(0);
					expect(grantCalls).toBe(2);
					expect(prompt.inputSecretCalls).toEqual([
						{ message: "Passphrase: " },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "anne (anne#cccccccc)" },
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
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
								{ title: "Enter identity" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Choose identity",
						},
					]);
					expect(prompt.stdout).toEqual([
						["granted anne#cccccccc in ./.env.enc", "recipients: 3", ""].join(
							"\n",
						),
					]);
				}),
		);
	});
});
