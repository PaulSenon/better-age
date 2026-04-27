import { Effect } from "effect";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "./PromptError.js";

type PromptShape = {
	readonly inputSecret: (input: {
		readonly message: string;
	}) => Effect.Effect<string, PromptReadAbortedError | PromptUnavailableError>;
	readonly inputSecretPairFromStdin: Effect.Effect<
		readonly [string, string],
		PromptReadAbortedError
	>;
	readonly inputText: (input: {
		readonly defaultValue?: string;
		readonly message: string;
	}) => Effect.Effect<string, PromptReadAbortedError | PromptUnavailableError>;
	readonly writeStderr: (text: string) => Effect.Effect<void>;
	readonly writeStdout: (text: string) => Effect.Effect<void>;
};

const missingPrompt = {
	inputSecret: (_input: { readonly message: string }) =>
		Effect.dieMessage("Prompt implementation not provided") as Effect.Effect<
			string,
			PromptReadAbortedError | PromptUnavailableError
		>,
	inputSecretPairFromStdin: Effect.dieMessage(
		"Prompt implementation not provided",
	) as Effect.Effect<readonly [string, string], PromptReadAbortedError>,
	inputText: (_input: {
		readonly defaultValue?: string;
		readonly message: string;
	}) =>
		Effect.dieMessage("Prompt implementation not provided") as Effect.Effect<
			string,
			PromptReadAbortedError | PromptUnavailableError
		>,
	writeStderr: (_text: string) =>
		Effect.dieMessage(
			"Prompt implementation not provided",
		) as Effect.Effect<void>,
	writeStdout: (_text: string) =>
		Effect.dieMessage(
			"Prompt implementation not provided",
		) as Effect.Effect<void>,
} satisfies PromptShape;

export class Prompt extends Effect.Service<Prompt>()("Prompt", {
	accessors: true,
	succeed: missingPrompt,
}) {}
