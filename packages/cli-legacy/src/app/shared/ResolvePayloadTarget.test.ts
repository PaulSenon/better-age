import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PayloadDiscovery } from "../../port/PayloadDiscovery.js";
import type { PayloadDiscoveryError } from "../../port/PayloadDiscoveryError.js";
import { Prompt } from "../../port/Prompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import { ResolvePayloadTarget } from "./ResolvePayloadTarget.js";
import { ResolvePayloadTargetError } from "./ResolvePayloadTargetError.js";

const makePrompt = (inputTextValue = "./typed.env.enc") => {
	const stderr: Array<string> = [];
	const stdout: Array<string> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: () => Effect.die("unused"),
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
						choices: input.choices.map((choice: InteractiveChoice<A>) => ({
							title: choice.title,
						})),
						message: input.message,
					});

					const answer = answers[index];

					if (answer === undefined) {
						throw new Error(
							`Missing test answer for select prompt: ${input.message}`,
						);
					}

					index += 1;
					return answer as A;
				}),
		}),
		{ calls },
	);
};

const makePayloadDiscovery = (paths: ReadonlyArray<string>) =>
	PayloadDiscovery.make({
		discoverFromCwd: Effect.succeed(paths) as Effect.Effect<
			ReadonlyArray<string>,
			PayloadDiscoveryError
		>,
	});

describe("ResolvePayloadTarget", () => {
	it.effect("passes through explicit paths without discovery", () =>
		Effect.gen(function* () {
			const resolvedPath = yield* ResolvePayloadTarget.resolveExistingPath(
				Option.some("./explicit.env.enc"),
			);

			expect(resolvedPath).toBe("./explicit.env.enc");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(Prompt, makePrompt()),
					Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
					Layer.succeed(PayloadDiscovery, makePayloadDiscovery([])),
					Layer.provide(ResolvePayloadTarget.Default, [
						Layer.succeed(Prompt, makePrompt()),
						Layer.succeed(InteractivePrompt, makeInteractivePrompt([])),
						Layer.succeed(PayloadDiscovery, makePayloadDiscovery([])),
					]),
				),
			),
		),
	);

	it.effect("auto-selects one discovered payload and confirms it", () =>
		Effect.gen(function* () {
			const prompt = yield* Prompt;
			const resolvedPath = yield* ResolvePayloadTarget.resolveExistingPath(
				Option.none(),
			);

			expect(resolvedPath).toBe("./.env.enc");
			expect(
				(prompt as typeof prompt & { stderr: Array<string> }).stderr,
			).toEqual(["Using ./.env.enc\n"]);
		}).pipe(
			Effect.provide(
				(() => {
					const prompt = makePrompt();
					const interactivePrompt = makeInteractivePrompt([]);
					const payloadDiscovery = makePayloadDiscovery(["./.env.enc"]);

					return Layer.mergeAll(
						Layer.succeed(Prompt, prompt),
						Layer.succeed(InteractivePrompt, interactivePrompt),
						Layer.succeed(PayloadDiscovery, payloadDiscovery),
						Layer.provide(ResolvePayloadTarget.Default, [
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(PayloadDiscovery, payloadDiscovery),
						]),
					);
				})(),
			),
		),
	);

	it.effect(
		"opens a keyboard picker when multiple payloads are discovered",
		() =>
			Effect.gen(function* () {
				const interactivePrompt = yield* InteractivePrompt;
				const resolvedPath = yield* ResolvePayloadTarget.resolveExistingPath(
					Option.none(),
				);

				expect(resolvedPath).toBe("./.env.production.enc");
				expect(
					(
						interactivePrompt as typeof interactivePrompt & {
							calls: Array<{
								choices: ReadonlyArray<{ title: string }>;
								message: string;
							}>;
						}
					).calls,
				).toEqual([
					{
						choices: [
							{ title: "./.env.enc" },
							{ title: "./.env.production.enc" },
						],
						message: "Select payload",
					},
				]);
			}).pipe(
				Effect.provide(
					(() => {
						const prompt = makePrompt();
						const interactivePrompt = makeInteractivePrompt([
							"./.env.production.enc",
						]);
						const payloadDiscovery = makePayloadDiscovery([
							"./.env.enc",
							"./.env.production.enc",
						]);

						return Layer.mergeAll(
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(PayloadDiscovery, payloadDiscovery),
							Layer.provide(ResolvePayloadTarget.Default, [
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(PayloadDiscovery, payloadDiscovery),
							]),
						);
					})(),
				),
			),
	);

	it.effect("prompts for a path when discovery finds nothing", () =>
		Effect.gen(function* () {
			const prompt = yield* Prompt;
			const resolvedPath = yield* ResolvePayloadTarget.resolveExistingPath(
				Option.none(),
			);

			expect(resolvedPath).toBe("./typed.env.enc");
			expect(
				(
					prompt as typeof prompt & {
						inputTextCalls: Array<{ message: string }>;
					}
				).inputTextCalls,
			).toEqual([{ message: "Payload path" }]);
		}).pipe(
			Effect.provide(
				(() => {
					const prompt = makePrompt();
					const interactivePrompt = makeInteractivePrompt([]);
					const payloadDiscovery = makePayloadDiscovery([]);

					return Layer.mergeAll(
						Layer.succeed(Prompt, prompt),
						Layer.succeed(InteractivePrompt, interactivePrompt),
						Layer.succeed(PayloadDiscovery, payloadDiscovery),
						Layer.provide(ResolvePayloadTarget.Default, [
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(PayloadDiscovery, payloadDiscovery),
						]),
					);
				})(),
			),
		),
	);

	it.effect(
		"fails with remediation when multiple payloads are found in non-interactive mode",
		() =>
			Effect.gen(function* () {
				const result = yield* ResolvePayloadTarget.resolveExistingPath(
					Option.none(),
				).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ResolvePayloadTargetError);
					expect(result.left.message).toBe(
						[
							"Multiple .env*.enc payloads were found in the current directory.",
							"Pass one path explicitly:",
							"./.env.enc",
							"./.env.production.enc",
						].join("\n"),
					);
				}
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						Layer.succeed(Prompt, makePrompt()),
						Layer.succeed(
							InteractivePrompt,
							InteractivePrompt.make({
								select: () =>
									Effect.fail(
										new PromptUnavailableError({
											field: "payload",
											message: "Interactive selection is unavailable",
										}),
									),
							}),
						),
						Layer.succeed(
							PayloadDiscovery,
							makePayloadDiscovery(["./.env.enc", "./.env.production.enc"]),
						),
						Layer.provide(ResolvePayloadTarget.Default, [
							Layer.succeed(Prompt, makePrompt()),
							Layer.succeed(
								InteractivePrompt,
								InteractivePrompt.make({
									select: () =>
										Effect.fail(
											new PromptUnavailableError({
												field: "payload",
												message: "Interactive selection is unavailable",
											}),
										),
								}),
							),
							Layer.succeed(
								PayloadDiscovery,
								makePayloadDiscovery(["./.env.enc", "./.env.production.enc"]),
							),
						]),
					),
				),
			),
	);

	it.effect(
		"fails with remediation when no payloads are found in non-interactive mode",
		() =>
			Effect.gen(function* () {
				const result = yield* ResolvePayloadTarget.resolveExistingPath(
					Option.none(),
				).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ResolvePayloadTargetError);
					expect(result.left.message).toBe(
						[
							"No payload path provided and no .env*.enc payloads were found in the current directory.",
							"Pass a path explicitly.",
						].join("\n"),
					);
				}
			}).pipe(
				Effect.provide(
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
							writeStderr: (_text) => Effect.void,
							writeStdout: (_text) => Effect.void,
						});
						const interactivePrompt = makeInteractivePrompt([]);
						const payloadDiscovery = makePayloadDiscovery([]);

						return Layer.mergeAll(
							Layer.succeed(Prompt, prompt),
							Layer.succeed(InteractivePrompt, interactivePrompt),
							Layer.succeed(PayloadDiscovery, payloadDiscovery),
							Layer.provide(ResolvePayloadTarget.Default, [
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(PayloadDiscovery, payloadDiscovery),
							]),
						);
					})(),
				),
			),
	);
});
