import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { ForgetIdentity } from "../../app/forget-identity/ForgetIdentity.js";
import {
	ForgetIdentityForbiddenSelfError,
	ForgetIdentityRemovedSuccess,
} from "../../app/forget-identity/ForgetIdentityError.js";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import {
	ForgetIdentityCommandFailedError,
	forgetIdentityCommand,
} from "./forgetIdentityCommand.js";

const knownPaulIdentity = {
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	fingerprint: Schema.decodeUnknownSync(KeyFingerprint)("bs1_aaaaaaaaaaaaaaaa"),
	handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	localAlias: Option.none(),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
};

const makePrompt = () => {
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
					return "paul#aaaaaaaa";
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

describe("forgetIdentityCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				HomeRepository,
				HomeRepository.make({
					deletePrivateKey: (_privateKeyPath) => Effect.void,
					getActiveKey: Effect.die("unused"),
					getLocation: Effect.die("unused"),
					loadState: Effect.succeed({
						...emptyHomeState(),
						knownIdentities: [
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
								ownerId: Schema.decodeUnknownSync(OwnerId)(
									"bsid1_aaaaaaaaaaaaaaaa",
								),
								publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
							},
						],
					}),
					readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
					saveState: (_state) => Effect.void,
					writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
					writePrivateKeyAtPath: (_input) => Effect.die("unused"),
				}),
			),
			Layer.succeed(
				ForgetIdentity,
				ForgetIdentity.make({
					execute: ({ identityRef }) =>
						Effect.succeed(
							new ForgetIdentityRemovedSuccess({
								handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
							}),
						).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									expect(identityRef).toBe("paul#aaaaaaaa");
								}),
							),
						),
				}),
			),
			Layer.sync(Prompt, makePrompt),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
		),
	)("success", (it) => {
		it.effect("prints local-only forget success", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([forgetIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "forget-identity", "paul#aaaaaaaa"]);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["forgot local identity paul#aaaaaaaa\n"]);
			}),
		);

		it.effect("opens known-identity picker when arg is omitted", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const interactivePrompt = makeInteractivePrompt([
					"paul (paul#aaaaaaaa)",
				]);
				(prompt as typeof prompt & { stdout: Array<string> }).stdout.length = 0;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([forgetIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "forget-identity"]).pipe(
					Effect.provide(Layer.succeed(InteractivePrompt, interactivePrompt)),
				);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["forgot local identity paul#aaaaaaaa\n"]);
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
							{ title: "Enter ref" },
							{ title: "Back" },
							{ title: "Cancel" },
						],
						message: "Forget identity",
					},
				]);
			}),
		);

		it.effect(
			"re-prompts guided typed self-forbidden input after edit action",
			() =>
				Effect.gen(function* () {
					let executeCalls = 0;
					const prompt = Object.assign(
						Prompt.make({
							inputSecret: () => Effect.die("unused"),
							inputSecretPairFromStdin: Effect.die("unused"),
							inputText: (_input) =>
								Effect.sync(() =>
									executeCalls === 0 ? "isaac#069f7576" : "paul#aaaaaaaa",
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
							stderr: [] as Array<string>,
							stdout: [] as Array<string>,
						},
					);
					const stderr = prompt.stderr;
					const stdout = prompt.stdout;
					const interactivePrompt = makeInteractivePrompt([
						"Enter ref",
						"Edit input",
						"Enter ref",
					]);
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([forgetIdentityCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "forget-identity"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									HomeRepository,
									HomeRepository.make({
										deletePrivateKey: (_privateKeyPath) => Effect.void,
										getActiveKey: Effect.die("unused"),
										getLocation: Effect.die("unused"),
										loadState: Effect.succeed({
											...emptyHomeState(),
											knownIdentities: [knownPaulIdentity],
										}),
										readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
										saveState: (_state) => Effect.void,
										writePrivateKey: (_fingerprint, _contents) =>
											Effect.die("unused"),
										writePrivateKeyAtPath: (_input) => Effect.die("unused"),
									}),
								),
								Layer.succeed(
									ForgetIdentity,
									ForgetIdentity.make({
										execute: ({ identityRef }) =>
											Effect.suspend(() => {
												executeCalls += 1;
												return identityRef === "isaac#069f7576"
													? Effect.fail(
															new ForgetIdentityForbiddenSelfError({
																message:
																	"Forgetting current self identity is forbidden in v0",
															}),
														)
													: Effect.succeed(
															new ForgetIdentityRemovedSuccess({
																handle: knownPaulIdentity.handle,
															}),
														);
											}),
									}),
								),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
							),
						),
					);

					expect(stdout).toEqual(["forgot local identity paul#aaaaaaaa\n"]);
					expect(stderr).toEqual([
						"Forgetting current self identity is forbidden in v0\n",
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "paul (paul#aaaaaaaa)" },
								{ title: "Enter ref" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Forget identity",
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
								{ title: "Enter ref" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Forget identity",
						},
					]);
				}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				HomeRepository,
				HomeRepository.make({
					deletePrivateKey: (_privateKeyPath) => Effect.void,
					getActiveKey: Effect.die("unused"),
					getLocation: Effect.die("unused"),
					loadState: Effect.succeed(emptyHomeState()),
					readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
					saveState: (_state) => Effect.void,
					writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
					writePrivateKeyAtPath: (_input) => Effect.die("unused"),
				}),
			),
			Layer.succeed(
				ForgetIdentity,
				ForgetIdentity.make({
					execute: () =>
						Effect.fail(
							new ForgetIdentityForbiddenSelfError({
								message: "Forgetting current self identity is forbidden in v0",
							}),
						),
				}),
			),
			Layer.sync(Prompt, makePrompt),
			Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
		),
	)("failure", (it) => {
		it.effect("prints stderr and fails on self-forget", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([forgetIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli([
					"node",
					"bage",
					"forget-identity",
					"isaac#069f7576",
				]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ForgetIdentityCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual(["Forgetting current self identity is forbidden in v0\n"]);
			}),
		);
	});
});
