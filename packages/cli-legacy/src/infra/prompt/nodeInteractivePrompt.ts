import * as CliPrompt from "@effect/cli/Prompt";
import * as Terminal from "@effect/platform/Terminal";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";

const ensureInteractiveTty = (message: string) =>
	Effect.sync(() => {
		const stdin = process.stdin;
		const stderr = process.stderr;

		if (!stdin.isTTY || !stderr.isTTY) {
			throw new PromptUnavailableError({
				field: message,
				message: "Interactive selection is unavailable",
			});
		}
	});

const toSelectOptions = <A>(input: {
	readonly choices: ReadonlyArray<{
		readonly description?: string;
		readonly disabled?: boolean;
		readonly selected?: boolean;
		readonly title: string;
		readonly value: A;
	}>;
	readonly maxPerPage?: number;
	readonly message: string;
}) => ({
	choices: input.choices,
	message: input.message,
	...(input.maxPerPage === undefined
		? {}
		: {
				maxPerPage: input.maxPerPage,
			}),
});

export const makeNodeInteractivePrompt = () =>
	InteractivePrompt.make({
		select: <A>(input: {
			readonly choices: ReadonlyArray<{
				readonly description?: string;
				readonly disabled?: boolean;
				readonly selected?: boolean;
				readonly title: string;
				readonly value: A;
			}>;
			readonly maxPerPage?: number;
			readonly message: string;
		}) =>
			ensureInteractiveTty(input.message).pipe(
				Effect.flatMap(() =>
					CliPrompt.run(CliPrompt.select(toSelectOptions(input))),
				),
				Effect.provide(NodeContext.layer),
				Effect.flatMap((value) =>
					value === undefined
						? Effect.fail(
								new PromptReadAbortedError({
									message: "Prompt aborted by user",
									prompt: input.message,
								}),
							)
						: Effect.succeed(value),
				),
				Effect.catchIf(Terminal.isQuitException, () =>
					Effect.fail(
						new PromptReadAbortedError({
							message: "Prompt aborted by user",
							prompt: input.message,
						}),
					),
				),
			),
	});

export const NodeInteractivePromptLive = Layer.succeed(
	InteractivePrompt,
	makeNodeInteractivePrompt(),
);
