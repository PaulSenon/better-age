import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PathAccess } from "../../port/PathAccess.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import { ResolveNewPayloadTarget } from "./ResolveNewPayloadTarget.js";
import { ResolveNewPayloadTargetError } from "./ResolveNewPayloadTargetError.js";

const makePrompt = (answers: ReadonlyArray<string>) => {
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
					return answer ?? input.defaultValue ?? "";
				}),
			writeStderr: () => Effect.void,
			writeStdout: () => Effect.void,
		}),
		{ inputTextCalls },
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

const makePathAccess = (existing: ReadonlyArray<string>) =>
	PathAccess.make({
		exists: (path) => Effect.succeed(existing.includes(path)),
	});

const makeDependencies = (input: {
	readonly existing: ReadonlyArray<string>;
	readonly promptAnswers: ReadonlyArray<string>;
	readonly selectAnswers: ReadonlyArray<string>;
}) => {
	const prompt = makePrompt(input.promptAnswers);
	const interactivePrompt = makeInteractivePrompt(input.selectAnswers);
	const pathAccess = makePathAccess(input.existing);

	return {
		interactivePrompt,
		layer: Layer.mergeAll(
			Layer.succeed(Prompt, prompt),
			Layer.succeed(InteractivePrompt, interactivePrompt),
			Layer.succeed(PathAccess, pathAccess),
			Layer.provide(ResolveNewPayloadTarget.Default, [
				Layer.succeed(Prompt, prompt),
				Layer.succeed(InteractivePrompt, interactivePrompt),
				Layer.succeed(PathAccess, pathAccess),
			]),
		),
		prompt,
	};
};

describe("ResolveNewPayloadTarget", () => {
	it.effect("passes through explicit free path", () =>
		(() => {
			const dependencies = makeDependencies({
				existing: [],
				promptAnswers: [],
				selectAnswers: [],
			});

			return Effect.gen(function* () {
				const result = yield* ResolveNewPayloadTarget.resolvePath(
					Option.some("./new.env.enc"),
				);

				expect(result).toEqual({
					overwriteApproved: false,
					path: "./new.env.enc",
				});
			}).pipe(Effect.provide(dependencies.layer));
		})(),
	);

	it.effect("fails on explicit existing path without overwrite prompt", () =>
		(() => {
			const dependencies = makeDependencies({
				existing: ["./.env.enc"],
				promptAnswers: [],
				selectAnswers: [],
			});

			return Effect.gen(function* () {
				const result = yield* ResolveNewPayloadTarget.resolvePath(
					Option.some("./.env.enc"),
				).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ResolveNewPayloadTargetError);
					expect(result.left.message).toBe(
						"Payload already exists: ./.env.enc\nPass a different path explicitly.",
					);
				}
				expect(dependencies.interactivePrompt.calls).toEqual([]);
			}).pipe(Effect.provide(dependencies.layer));
		})(),
	);

	it.effect("prompts with default .env.enc when path omitted", () =>
		(() => {
			const dependencies = makeDependencies({
				existing: [],
				promptAnswers: ["./typed.env.enc"],
				selectAnswers: [],
			});

			return Effect.gen(function* () {
				const result = yield* ResolveNewPayloadTarget.resolvePath(
					Option.none(),
				);

				expect(result).toEqual({
					overwriteApproved: false,
					path: "./typed.env.enc",
				});
				expect(dependencies.prompt.inputTextCalls).toEqual([
					{ defaultValue: ".env.enc", message: "Payload path" },
				]);
			}).pipe(Effect.provide(dependencies.layer));
		})(),
	);

	it.effect(
		"loops to enter different path when guided target already exists",
		() =>
			(() => {
				const dependencies = makeDependencies({
					existing: ["./.env.enc"],
					promptAnswers: ["./.env.enc", "./other.env.enc"],
					selectAnswers: ["Enter different path"],
				});

				return Effect.gen(function* () {
					const result = yield* ResolveNewPayloadTarget.resolvePath(
						Option.none(),
					);

					expect(result).toEqual({
						overwriteApproved: false,
						path: "./other.env.enc",
					});
					expect(dependencies.prompt.inputTextCalls).toEqual([
						{ defaultValue: ".env.enc", message: "Payload path" },
						{ defaultValue: ".env.enc", message: "Payload path" },
					]);
					expect(dependencies.interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Enter different path" },
								{ title: "Overwrite" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Payload already exists: ./.env.enc",
						},
					]);
				}).pipe(Effect.provide(dependencies.layer));
			})(),
	);

	it.effect(
		"fails with missing-path remediation when guided prompt is unavailable",
		() =>
			(() => {
				const prompt = Prompt.make({
					inputSecret: () => Effect.die("unused"),
					inputSecretPairFromStdin: Effect.die("unused"),
					inputText: () =>
						Effect.fail(
							new PromptUnavailableError({
								field: "path",
								message: "Interactive text input is unavailable",
							}),
						),
					writeStderr: () => Effect.void,
					writeStdout: () => Effect.void,
				});
				const interactivePrompt = makeInteractivePrompt([]);
				const pathAccess = makePathAccess([]);

				return ResolveNewPayloadTarget.resolvePath(Option.none()).pipe(
					Effect.either,
					Effect.map((result) => {
						expect(result._tag).toBe("Left");
						if (result._tag === "Left") {
							expect(result.left).toBeInstanceOf(ResolveNewPayloadTargetError);
							expect(result.left.message).toBe(
								"Missing required payload path\nPass a payload path explicitly",
							);
						}
						return result;
					}),
					Effect.provide(
						Layer.mergeAll(
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(PathAccess, pathAccess),
							Layer.provide(ResolveNewPayloadTarget.Default, [
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(PathAccess, pathAccess),
							]),
						),
					),
				);
			})(),
	);
});
