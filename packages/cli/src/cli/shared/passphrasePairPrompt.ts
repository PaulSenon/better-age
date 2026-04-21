import { Effect } from "effect";
import { Prompt } from "../../port/Prompt.js";

export const promptForConfirmedPassphrase = (input: {
	readonly confirmMessage: string;
	readonly message: string;
	readonly mismatchMessage: string;
}) =>
	Effect.gen(function* () {
		while (true) {
			const passphrase = yield* Prompt.inputSecret({
				message: input.message,
			});
			const confirmation = yield* Prompt.inputSecret({
				message: input.confirmMessage,
			});

			if (passphrase === confirmation) {
				return passphrase;
			}

			yield* Prompt.writeStderr(`${input.mismatchMessage}\n`);
		}
	});
