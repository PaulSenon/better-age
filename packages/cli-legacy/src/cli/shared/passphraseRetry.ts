import { Effect, Either } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { writeUserFacingError } from "./userFacingMessage.js";

type PassphraseRetryAction = "back" | "cancel" | "retry-passphrase";

const promptForPassphraseRetryAction = () =>
	Effect.gen(function* () {
		const interactivePrompt = yield* InteractivePrompt;

		return yield* interactivePrompt.select<PassphraseRetryAction>({
			choices: [
				{ title: "Retry passphrase", value: "retry-passphrase" },
				{ title: "Back", value: "back" },
				{ title: "Cancel", value: "cancel" },
			],
			message: "Passphrase failed",
		});
	});

export const runWithPassphraseRetry = <A, E, R>(input: {
	readonly invocationShape: "exact" | "guided";
	readonly isRetryableError: (error: unknown) => error is E;
	readonly run: (passphrase: string) => Effect.Effect<A, E, R>;
}) =>
	Effect.gen(function* () {
		while (true) {
			const passphrase = yield* Prompt.inputSecret({
				message: "Passphrase: ",
			});
			const result = yield* input.run(passphrase).pipe(Effect.either);

			if (Either.isRight(result)) {
				return result.right;
			}

			if (!input.isRetryableError(result.left)) {
				return yield* Effect.fail(result.left);
			}

			if (input.invocationShape === "exact") {
				yield* writeUserFacingError({
					id: "ERR.PAYLOAD.DECRYPT_FAILED",
				});
				return yield* Effect.fail(result.left);
			}

			yield* writeUserFacingError({
				id: "ERR.PAYLOAD.DECRYPT_FAILED",
			});
			const action = yield* promptForPassphraseRetryAction();

			if (action !== "retry-passphrase") {
				return yield* Effect.fail(new GuidedFlowCancelledError());
			}
		}
	});
