import { Effect } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";

export type PayloadUpdateAction = "back" | "cancel" | "update-now";
export type PayloadUpdateGateOutcome = "back" | "cancel" | "updated";

export const promptForPayloadUpdateAction = () =>
	Effect.gen(function* () {
		const interactivePrompt = yield* InteractivePrompt;

		return yield* interactivePrompt.select<PayloadUpdateAction>({
			choices: [
				{ title: "Update now", value: "update-now" },
				{ title: "Back", value: "back" },
				{ title: "Cancel", value: "cancel" },
			],
			message: "Payload needs update before continuing",
		});
	});

export const runPayloadUpdateGate = <E, R>(
	updateEffect: Effect.Effect<unknown, E, R>,
): Effect.Effect<
	PayloadUpdateGateOutcome,
	E | PromptReadAbortedError | PromptUnavailableError,
	InteractivePrompt | R
> =>
	Effect.gen(function* () {
		const action = yield* promptForPayloadUpdateAction();

		switch (action) {
			case "update-now":
				yield* updateEffect;
				return "updated";
			case "back":
				return "back";
			case "cancel":
				return "cancel";
		}
	});

export const renderUpdateRequiredMessage = (
	command: "edit" | "grant" | "revoke",
	path: string,
) =>
	[
		`Payload must be updated before ${command}`,
		`Run: bage update ${path}`,
		"",
	].join("\n");
