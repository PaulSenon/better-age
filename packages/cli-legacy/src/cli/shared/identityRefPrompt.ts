import { Effect } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";

const promptForIdentityStringValue =
	"__better_secrets_prompt_identity_string__";

type IdentityRefChoice = {
	readonly disabled?: boolean;
	readonly title: string;
	readonly value: string;
};

export const promptForIdentityRef = (input: {
	readonly choices: ReadonlyArray<IdentityRefChoice>;
	readonly message: string;
	readonly promptForIdentityString?: boolean;
}) =>
	Effect.gen(function* () {
		if (input.choices.length === 0 && !input.promptForIdentityString) {
			return yield* Prompt.inputText({
				message: "Identity ref",
			});
		}

		const interactivePrompt = yield* InteractivePrompt;
		const selection = yield* interactivePrompt.select({
			choices: [
				...input.choices,
				...(input.promptForIdentityString
					? [
							{
								title: "Paste/import identity string",
								value: promptForIdentityStringValue,
							} satisfies IdentityRefChoice,
						]
					: []),
			],
			message: input.message,
		});

		if (selection === promptForIdentityStringValue) {
			return yield* Prompt.inputText({
				message: "Identity string",
			});
		}

		return selection;
	});
