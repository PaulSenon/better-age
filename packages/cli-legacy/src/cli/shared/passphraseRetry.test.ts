import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { runWithPassphraseRetry } from "./passphraseRetry.js";

class RetryableDecryptError extends Error {
	override readonly name = "RetryableDecryptError";
}

const makePrompt = (answers: ReadonlyArray<string>) => {
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	let index = 0;

	return Object.assign(
		Prompt.make({
			inputSecret: (input) =>
				Effect.sync(() => {
					inputSecretCalls.push(input);
					const answer = answers[index];
					index += 1;

					if (!answer) {
						throw new Error("Missing passphrase answer");
					}

					return answer;
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: () => Effect.die("unused"),
			writeStderr: (text) =>
				Effect.sync(() => {
					stderr.push(text);
				}),
			writeStdout: () => Effect.void,
		}),
		{ inputSecretCalls, stderr },
	);
};

const makeInteractivePrompt = (answer: string) =>
	InteractivePrompt.make({
		select: <A>(input: {
			readonly choices: ReadonlyArray<{ title: string; value: A }>;
			readonly maxPerPage?: number;
			readonly message: string;
		}) =>
			Effect.sync(() => {
				const choice = input.choices.find((item) => item.title === answer);

				if (!choice) {
					throw new Error(`Missing choice ${answer}`);
				}

				return choice.value;
			}),
	});

describe("passphraseRetry", () => {
	it.effect("retries in guided mode after retryable decrypt failure", () =>
		(() => {
			const prompt = makePrompt(["wrong", "correct"]);
			let calls = 0;

			return Effect.gen(function* () {
				const result = yield* runWithPassphraseRetry({
					invocationShape: "guided",
					isRetryableError: (error): error is RetryableDecryptError =>
						error instanceof RetryableDecryptError,
					run: (passphrase) =>
						Effect.suspend(() => {
							calls += 1;

							return passphrase === "correct"
								? Effect.succeed("ok")
								: Effect.fail(new RetryableDecryptError("bad"));
						}),
				});

				expect(result).toBe("ok");
				expect(calls).toBe(2);
				expect(prompt.inputSecretCalls).toEqual([
					{ message: "Passphrase: " },
					{ message: "Passphrase: " },
				]);
				expect(prompt.stderr).toEqual([
					"Failed to decrypt payload with provided passphrase\n",
				]);
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						Layer.succeed(Prompt, prompt),
						Layer.succeed(
							InteractivePrompt,
							makeInteractivePrompt("Retry passphrase"),
						),
					),
				),
			);
		})(),
	);

	it.effect("returns guided cancel on back action", () =>
		Effect.gen(function* () {
			const result = yield* runWithPassphraseRetry({
				invocationShape: "guided",
				isRetryableError: (error): error is RetryableDecryptError =>
					error instanceof RetryableDecryptError,
				run: () => Effect.fail(new RetryableDecryptError("bad")),
			}).pipe(Effect.either);

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left).toBeInstanceOf(GuidedFlowCancelledError);
			}
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(Prompt, makePrompt(["wrong"])),
					Layer.succeed(InteractivePrompt, makeInteractivePrompt("Back")),
				),
			),
		),
	);

	it.effect(
		"fails immediately in exact mode after retryable decrypt failure",
		() =>
			(() => {
				const prompt = makePrompt(["wrong"]);

				return Effect.gen(function* () {
					const result = yield* runWithPassphraseRetry({
						invocationShape: "exact",
						isRetryableError: (error): error is RetryableDecryptError =>
							error instanceof RetryableDecryptError,
						run: () => Effect.fail(new RetryableDecryptError("bad")),
					}).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					expect(prompt.stderr).toEqual([
						"Failed to decrypt payload with provided passphrase\n",
					]);
				}).pipe(
					Effect.provide(
						Layer.mergeAll(
							Layer.succeed(Prompt, prompt),
							Layer.succeed(
								InteractivePrompt,
								makeInteractivePrompt("Retry passphrase"),
							),
						),
					),
				);
			})(),
	);
});
