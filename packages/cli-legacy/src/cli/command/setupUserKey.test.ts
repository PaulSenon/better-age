import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import {
	CreateUserIdentityCryptoError,
	CreateUserIdentitySuccess,
} from "../../app/create-user-identity/CreateUserIdentityError.js";
import {
	ActiveKeyAlreadyExistsError,
	InvalidIdentityAliasError,
} from "../../domain/error/IdentityDomainError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { setupUserKeyCommand } from "./setupUserKey.js";

const makePrompt = (input?: {
	readonly alias?: string;
	readonly passphrases?: ReadonlyArray<string>;
	readonly inputTextError?: PromptUnavailableError | PromptReadAbortedError;
	readonly inputSecretError?: PromptUnavailableError | PromptReadAbortedError;
}) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	const passphrases = [
		...(input?.passphrases ?? ["test-passphrase", "test-passphrase"]),
	];

	return Object.assign(
		Prompt.make({
			inputSecret: (args) =>
				Effect.gen(function* () {
					inputSecretCalls.push(args);

					if (input?.inputSecretError) {
						return yield* input.inputSecretError;
					}

					const nextPassphrase = passphrases.shift();

					if (!nextPassphrase) {
						return yield* Effect.die("missing passphrase fixture");
					}

					return nextPassphrase;
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (args) =>
				Effect.gen(function* () {
					inputTextCalls.push(args);

					if (input?.inputTextError) {
						return yield* input.inputTextError;
					}

					return input?.alias ?? "guided-alias";
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

const makeCli = () =>
	Command.run(
		Command.make("bage").pipe(Command.withSubcommands([setupUserKeyCommand])),
		{ name: "bage", version: "0.0.1" },
	);

const homeRepositoryLayer = Layer.succeed(
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
);

describe("setupUserKeyCommand", () => {
	it.effect("prints success details only to stdout", () =>
		Effect.gen(function* () {
			const prompt = makePrompt();
			const cli = makeCli();

			yield* cli(["node", "bage", "setup", "--alias=isaac"]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: ({ displayName, passphrase }) =>
									Effect.succeed(
										new CreateUserIdentitySuccess({
											displayName: displayName as never,
											fingerprint: "bs1_0123456789abcdef" as never,
											handle: "isaac#01234567" as never,
											ownerId: "bsid1_0123456789abcdef" as never,
											privateKeyPath:
												"keys/bs1_0123456789abcdef.key.age" as never,
											publicKey:
												"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k" as never,
										}),
									).pipe(
										Effect.tap(() =>
											Effect.sync(() => {
												expect(displayName).toBe("isaac");
												expect(passphrase).toBe("test-passphrase");
											}),
										),
									),
							}),
						),
						homeRepositoryLayer,
						Layer.succeed(Prompt, prompt),
					),
				),
			);

			expect(prompt.stdout).toEqual([
				[
					"Created user key bs1_0123456789abcdef (isaac)",
					"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k",
					"Home: /tmp/home",
					"",
				].join("\n"),
			]);
			expect(prompt.stderr).toEqual([]);
			expect(prompt.inputTextCalls).toEqual([]);
			expect(prompt.inputSecretCalls).toEqual([
				{ message: "Passphrase: " },
				{ message: "Confirm passphrase: " },
			]);
		}),
	);

	it.effect("prompts for alias in guided mode when omitted", () =>
		Effect.gen(function* () {
			const prompt = makePrompt({ alias: "guided-isaac" });
			const cli = makeCli();

			yield* cli(["node", "bage", "setup"]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: ({ displayName }) =>
									Effect.succeed(
										new CreateUserIdentitySuccess({
											displayName: displayName as never,
											fingerprint: "bs1_0123456789abcdef" as never,
											handle: "guided#01234567" as never,
											ownerId: "bsid1_0123456789abcdef" as never,
											privateKeyPath:
												"keys/bs1_0123456789abcdef.key.age" as never,
											publicKey:
												"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k" as never,
										}),
									).pipe(
										Effect.tap(() =>
											Effect.sync(() => {
												expect(displayName).toBe("guided-isaac");
											}),
										),
									),
							}),
						),
						homeRepositoryLayer,
						Layer.succeed(Prompt, prompt),
					),
				),
			);

			expect(prompt.inputTextCalls).toEqual([
				expect.objectContaining({ message: "Alias" }),
			]);
			expect(prompt.stderr).toEqual([]);
		}),
	);

	it.effect(
		"prints alias-required remediation when alias prompt is unavailable",
		() =>
			Effect.gen(function* () {
				const prompt = makePrompt({
					inputTextError: new PromptUnavailableError({
						field: "alias",
						message: "Interactive input is unavailable in this environment",
					}),
				});
				const cli = makeCli();

				const result = yield* cli(["node", "bage", "setup"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								CreateUserIdentity,
								CreateUserIdentity.make({
									execute: () => Effect.die("unused"),
								}),
							),
							homeRepositoryLayer,
							Layer.succeed(Prompt, prompt),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(prompt.stderr).toEqual([
					[
						"Missing required display name",
						"Run: bage setup --alias <display-name>",
						"",
					].join("\n"),
				]);
				expect(prompt.stdout).toEqual([]);
				expect(prompt.inputSecretCalls).toEqual([]);
			}),
	);

	it.effect(
		"prints secure passphrase unavailable when passphrase prompt is unavailable",
		() =>
			Effect.gen(function* () {
				const prompt = makePrompt({
					inputSecretError: new PromptUnavailableError({
						field: "passphrase",
						message: "Interactive input is unavailable in this environment",
					}),
				});
				const cli = makeCli();

				const result = yield* cli([
					"node",
					"bage",
					"setup",
					"--alias=isaac",
				]).pipe(
					Effect.provide(
						Layer.mergeAll(
							NodeContext.layer,
							Layer.succeed(
								CreateUserIdentity,
								CreateUserIdentity.make({
									execute: () => Effect.die("unused"),
								}),
							),
							homeRepositoryLayer,
							Layer.succeed(Prompt, prompt),
						),
					),
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				expect(prompt.stderr).toEqual([
					[
						"Secure passphrase input is unavailable in this environment",
						"Use an interactive terminal",
						"",
					].join("\n"),
				]);
				expect(prompt.stdout).toEqual([]);
			}),
	);

	it.effect("prints normalized already-configured wording", () =>
		Effect.gen(function* () {
			const prompt = makePrompt();
			const cli = makeCli();

			const result = yield* cli([
				"node",
				"bage",
				"setup",
				"--alias=isaac",
			]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: () =>
									Effect.fail(
										new ActiveKeyAlreadyExistsError({
											displayName: "isaac" as never,
											fingerprint: "bs1_0123456789abcdef" as never,
											message: "raw message",
										}),
									),
							}),
						),
						homeRepositoryLayer,
						Layer.succeed(Prompt, prompt),
					),
				),
				Effect.either,
			);

			expect(result._tag).toBe("Left");
			expect(prompt.stderr).toEqual([
				[
					"Local self identity already exists",
					"Use existing identity or rotate it",
					"",
				].join("\n"),
			]);
		}),
	);

	it.effect("prints normalized alias-invalid wording", () =>
		Effect.gen(function* () {
			const prompt = makePrompt();
			const cli = makeCli();

			const result = yield* cli(["node", "bage", "setup", "--alias=bad"]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: () =>
									Effect.fail(
										new InvalidIdentityAliasError({
											displayName: "bad",
											message: "raw invalid",
										}),
									),
							}),
						),
						homeRepositoryLayer,
						Layer.succeed(Prompt, prompt),
					),
				),
				Effect.either,
			);

			expect(result._tag).toBe("Left");
			expect(prompt.stderr).toEqual([["Invalid display name", ""].join("\n")]);
		}),
	);

	it.effect("prints normalized create-failed wording", () =>
		Effect.gen(function* () {
			const prompt = makePrompt();
			const cli = makeCli();

			const result = yield* cli([
				"node",
				"bage",
				"setup",
				"--alias=isaac",
			]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: () =>
									Effect.fail(
										new CreateUserIdentityCryptoError({
											message: "raw crypto failure",
										}),
									),
							}),
						),
						homeRepositoryLayer,
						Layer.succeed(Prompt, prompt),
					),
				),
				Effect.either,
			);

			expect(result._tag).toBe("Left");
			expect(prompt.stderr).toEqual([
				["Failed to create local identity", "Retry setup", ""].join("\n"),
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
			const cli = makeCli();

			const result = yield* cli([
				"node",
				"bage",
				"setup",
				"--alias=isaac",
			]).pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeContext.layer,
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: () => Effect.die("unused"),
							}),
						),
						homeRepositoryLayer,
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
