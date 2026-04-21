import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { Prompt } from "../../port/Prompt.js";
import { PromptReadAbortedError } from "../../port/PromptError.js";
import { SecureViewer } from "../../port/SecureViewer.js";
import { SecureViewerUnavailableError } from "../../port/SecureViewerError.js";
import { ReadPayload } from "../read-payload/ReadPayload.js";
import { ReadPayloadSuccess } from "../read-payload/ReadPayloadError.js";
import { ResolvePayloadTarget } from "../shared/ResolvePayloadTarget.js";
import { ViewPayload, ViewPayloadFailedError } from "./ViewPayload.js";

const makePrompt = () => {
	const stderr: Array<string> = [];
	const stdout: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					return "test-passphrase";
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
		{ inputSecretCalls, stderr, stdout },
	);
};

const makeResolvePayloadTarget = (resolvedPath = "./.env.enc") =>
	ResolvePayloadTarget.make({
		resolveExistingPath: (_path) => Effect.succeed(resolvedPath),
	});

describe("ViewPayload", () => {
	it.effect("decrypts and opens the secure viewer directly", () =>
		(() => {
			const prompt = makePrompt();
			const secureViewer = Object.assign(
				SecureViewer.make({
					view: (input) =>
						Effect.sync(() => {
							secureViewer.calls.push(input);
						}),
				}),
				{ calls: [] as Array<{ envText: string; path: string }> },
			);
			const dependencies = Layer.mergeAll(
				Layer.succeed(Prompt, prompt),
				Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
				Layer.succeed(
					ReadPayload,
					ReadPayload.make({
						execute: ({ path, passphrase }) =>
							Effect.succeed(
								new ReadPayloadSuccess({
									envText: "API_TOKEN=secret\nDEBUG=true",
									needsUpdate: {
										isRequired: false,
										reason: Option.none(),
									},
									path,
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
				Layer.succeed(SecureViewer, secureViewer),
			);

			return Effect.gen(function* () {
				yield* ViewPayload.execute({
					path: Option.none(),
				});

				expect(prompt.inputSecretCalls).toEqual([{ message: "Passphrase: " }]);
				expect(secureViewer.calls).toEqual([
					{
						envText: "API_TOKEN=secret\nDEBUG=true",
						path: "./.env.enc",
					},
				]);
			}).pipe(Effect.provide(Layer.provide(ViewPayload.Default, dependencies)));
		})(),
	);

	it.effect(
		"prints remediation and fails when secure viewer is unavailable",
		() =>
			(() => {
				const prompt = makePrompt();
				const dependencies = Layer.mergeAll(
					Layer.succeed(Prompt, prompt),
					Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
					Layer.succeed(
						ReadPayload,
						ReadPayload.make({
							execute: ({ path }) =>
								Effect.succeed(
									new ReadPayloadSuccess({
										envText: "API_TOKEN=secret",
										needsUpdate: {
											isRequired: false,
											reason: Option.none(),
										},
										path,
									}),
								),
						}),
					),
					Layer.succeed(
						SecureViewer,
						SecureViewer.make({
							view: () =>
								Effect.fail(
									new SecureViewerUnavailableError({
										message:
											"Secure viewer is unavailable in this environment. Use an interactive TTY.",
									}),
								),
						}),
					),
				);

				return Effect.gen(function* () {
					const result = yield* ViewPayload.execute({
						path: Option.none(),
					}).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(ViewPayloadFailedError);
					}
					expect(prompt.stderr).toEqual([
						"Secure viewer is unavailable in this environment. Use an interactive TTY.\n",
					]);
				}).pipe(
					Effect.provide(Layer.provide(ViewPayload.Default, dependencies)),
				);
			})(),
	);

	it.effect("treats passphrase prompt abort as quiet cancel", () =>
		(() => {
			const stderr: Array<string> = [];
			const prompt = Prompt.make({
				inputSecret: () =>
					Effect.fail(
						new PromptReadAbortedError({
							message: "Prompt aborted by user",
							prompt: "Passphrase: ",
						}),
					),
				inputSecretPairFromStdin: Effect.die("unused"),
				inputText: () => Effect.die("unused"),
				writeStderr: (text) =>
					Effect.sync(() => {
						stderr.push(text);
					}),
				writeStdout: () => Effect.void,
			});
			const secureViewer = SecureViewer.make({
				view: () => Effect.die("unused"),
			});
			const dependencies = Layer.mergeAll(
				Layer.succeed(Prompt, prompt),
				Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
				Layer.succeed(
					ReadPayload,
					ReadPayload.make({
						execute: () => Effect.die("unused"),
					}),
				),
				Layer.succeed(SecureViewer, secureViewer),
			);

			return Effect.gen(function* () {
				const result = yield* ViewPayload.execute({
					path: Option.none(),
				}).pipe(Effect.either);

				expect(result._tag).toBe("Right");
				expect(stderr).toEqual([]);
			}).pipe(Effect.provide(Layer.provide(ViewPayload.Default, dependencies)));
		})(),
	);
});
