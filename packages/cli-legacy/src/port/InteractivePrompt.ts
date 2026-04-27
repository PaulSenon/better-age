import { Effect } from "effect";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "./PromptError.js";

export type InteractiveChoice<A> = {
	readonly description?: string;
	readonly disabled?: boolean;
	readonly selected?: boolean;
	readonly title: string;
	readonly value: A;
};

type InteractivePromptShape = {
	readonly select: <A>(input: {
		readonly choices: ReadonlyArray<InteractiveChoice<A>>;
		readonly maxPerPage?: number;
		readonly message: string;
	}) => Effect.Effect<A, PromptReadAbortedError | PromptUnavailableError>;
};

const missingInteractivePrompt = {
	select: <A>(_input: {
		readonly choices: ReadonlyArray<InteractiveChoice<A>>;
		readonly maxPerPage?: number;
		readonly message: string;
	}) =>
		Effect.dieMessage(
			"InteractivePrompt implementation not provided",
		) as Effect.Effect<A, PromptReadAbortedError | PromptUnavailableError>,
} satisfies InteractivePromptShape;

export class InteractivePrompt extends Effect.Service<InteractivePrompt>()(
	"InteractivePrompt",
	{
		accessors: false,
		succeed: missingInteractivePrompt,
	},
) {}
