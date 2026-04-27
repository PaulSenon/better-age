import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { RotateUserIdentity } from "../../app/rotate-user-identity/RotateUserIdentity.js";
import {
	RotateUserIdentityCryptoError,
	RotateUserIdentityNoActiveIdentityError,
	RotateUserIdentitySuccess,
} from "../../app/rotate-user-identity/RotateUserIdentityError.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	type PromptUnavailableError,
} from "../../port/PromptError.js";
import {
	RotateUserIdentityCommandFailedError,
	rotateUserIdentityCommand,
} from "./rotateUserIdentity.js";

const oldFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const newFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_2222222222222222",
);
const ownerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");

const makePrompt = (input?: {
	readonly inputSecretError?: PromptReadAbortedError | PromptUnavailableError;
	readonly passphrase?: string;
}) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: (args) =>
				Effect.gen(function* () {
					inputSecretCalls.push(args);

					if (input?.inputSecretError) {
						return yield* input.inputSecretError;
					}

					return input?.passphrase ?? "test-passphrase";
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

describe("rotateUserIdentityCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				RotateUserIdentity,
				RotateUserIdentity.make({
					execute: ({ passphrase }) =>
						Effect.succeed(
							new RotateUserIdentitySuccess({
								newFingerprint,
								oldFingerprint,
								ownerId,
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
		it.effect("prints rotated fingerprint transition and reshare hint", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([rotateUserIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "rotate"]);

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
						"rotated identity bs1_1111111111111111 -> bs1_2222222222222222",
						"Share updated identity: bage me",
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
				RotateUserIdentity,
				RotateUserIdentity.make({
					execute: () =>
						Effect.fail(
							new RotateUserIdentityCryptoError({
								message:
									"Failed to decrypt private key with provided passphrase",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt({ passphrase: "wrong-passphrase" })),
		),
	)("wrong passphrase", (it) => {
		it.effect(
			"prints normalized stderr and fails on wrong rotate passphrase",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([rotateUserIdentityCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					const result = yield* cli(["node", "bage", "rotate"]).pipe(
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(
							RotateUserIdentityCommandFailedError,
						);
					}
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([
						["Failed to rotate local identity", "Retry", ""].join("\n"),
					]);
				}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				RotateUserIdentity,
				RotateUserIdentity.make({
					execute: () =>
						Effect.fail(
							new RotateUserIdentityCryptoError({
								message: "Failed to generate rotated identity",
							}),
						),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("failure", (it) => {
		it.effect("prints normalized stderr and fails on rotate app error", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([rotateUserIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "rotate"]).pipe(
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(
						RotateUserIdentityCommandFailedError,
					);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					["Failed to rotate local identity", "Retry", ""].join("\n"),
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
							Command.withSubcommands([rotateUserIdentityCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					const result = yield* cli(["node", "bage", "rotate"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.succeed(
									RotateUserIdentity,
									RotateUserIdentity.make({
										execute: () =>
											Effect.fail(
												new RotateUserIdentityNoActiveIdentityError({
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
						Command.withSubcommands([rotateUserIdentityCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "rotate"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								RotateUserIdentity,
								RotateUserIdentity.make({
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
