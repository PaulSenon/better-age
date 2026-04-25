import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import { ResolveEditorCommand } from "./ResolveEditorCommand.js";
import { ResolveEditorCommandUnavailableError } from "./ResolveEditorCommandError.js";

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
						choices: input.choices.map((choice) => ({ title: choice.title })),
						message: input.message,
					});
					const answer = answers[index];

					if (answer === undefined) {
						throw new Error(`Missing answer for ${input.message}`);
					}

					index += 1;
					return answer as A;
				}),
		}),
		{ calls },
	);
};

const makeHomeRepository = (input?: {
	readonly defaultEditorCommand?: Option.Option<string>;
}) => {
	const savedStates: ReturnType<typeof emptyHomeState>[] = [];
	const state = {
		...emptyHomeState(),
		defaultEditorCommand: input?.defaultEditorCommand ?? Option.none(),
	};

	return Object.assign(
		HomeRepository.make({
			deletePrivateKey: (_privateKeyPath) => Effect.void,
			getActiveKey: Effect.die("unused"),
			getLocation: Effect.die("unused"),
			loadState: Effect.succeed(state),
			readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
			saveState: (nextState) =>
				Effect.sync(() => {
					savedStates.push(nextState);
				}),
			writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
			writePrivateKeyAtPath: (_input) => Effect.die("unused"),
		}),
		{ savedStates },
	);
};

describe("ResolveEditorCommand", () => {
	it.effect("uses env precedence before saved config", () =>
		Effect.gen(function* () {
			const homeRepository = makeHomeRepository({
				defaultEditorCommand: Option.some("nano"),
			});
			const interactivePrompt = makeInteractivePrompt([]);
			const previous = {
				BETTER_AGE_EDITOR: process.env.BETTER_AGE_EDITOR,
				EDITOR: process.env.EDITOR,
				VISUAL: process.env.VISUAL,
			};

			process.env.BETTER_AGE_EDITOR = "code --wait";
			process.env.VISUAL = "vim";
			process.env.EDITOR = "vi";

			try {
				const command = yield* ResolveEditorCommand.resolve().pipe(
					Effect.provide(
						Layer.provide(ResolveEditorCommand.Default, [
							Layer.succeed(HomeRepository, homeRepository),
							Layer.succeed(InteractivePrompt, interactivePrompt),
						]),
					),
				);

				expect(command).toBe("code --wait");
				expect(interactivePrompt.calls).toEqual([]);
			} finally {
				process.env.BETTER_AGE_EDITOR = previous.BETTER_AGE_EDITOR;
				process.env.VISUAL = previous.VISUAL;
				process.env.EDITOR = previous.EDITOR;
			}
		}),
	);

	it.effect("offers chooser and can save selected editor as default", () =>
		Effect.gen(function* () {
			const homeRepository = makeHomeRepository();
			const interactivePrompt = makeInteractivePrompt(["nvim", "save"]);
			const previous = {
				BETTER_AGE_EDITOR: process.env.BETTER_AGE_EDITOR,
				EDITOR: process.env.EDITOR,
				VISUAL: process.env.VISUAL,
			};

			delete process.env.BETTER_AGE_EDITOR;
			delete process.env.VISUAL;
			delete process.env.EDITOR;

			try {
				const command = yield* ResolveEditorCommand.resolve().pipe(
					Effect.provide(
						Layer.provide(ResolveEditorCommand.Default, [
							Layer.succeed(HomeRepository, homeRepository),
							Layer.succeed(InteractivePrompt, interactivePrompt),
						]),
					),
				);

				expect(command).toBe("nvim");
				expect(interactivePrompt.calls).toEqual([
					{
						choices: [
							{ title: "vim" },
							{ title: "nvim" },
							{ title: "nano" },
							{ title: "vi" },
							{ title: "code --wait" },
						],
						message: "Choose editor",
					},
					{
						choices: [
							{ title: "Use once" },
							{ title: "Save as default" },
							{ title: "Back" },
						],
						message: "Use nvim",
					},
				]);
				expect(homeRepository.savedStates).toHaveLength(1);
				expect(homeRepository.savedStates[0]?.defaultEditorCommand).toEqual(
					Option.some("nvim"),
				);
			} finally {
				process.env.BETTER_AGE_EDITOR = previous.BETTER_AGE_EDITOR;
				process.env.VISUAL = previous.VISUAL;
				process.env.EDITOR = previous.EDITOR;
			}
		}),
	);

	it.effect(
		"fails with remediation when no editor is configured in non-interactive mode",
		() =>
			Effect.gen(function* () {
				const homeRepository = makeHomeRepository();
				const previous = {
					BETTER_AGE_EDITOR: process.env.BETTER_AGE_EDITOR,
					EDITOR: process.env.EDITOR,
					VISUAL: process.env.VISUAL,
				};

				delete process.env.BETTER_AGE_EDITOR;
				delete process.env.VISUAL;
				delete process.env.EDITOR;

				try {
					const result = yield* ResolveEditorCommand.resolve().pipe(
						Effect.provide(
							Layer.provide(ResolveEditorCommand.Default, [
								Layer.succeed(HomeRepository, homeRepository),
								Layer.succeed(
									InteractivePrompt,
									InteractivePrompt.make({
										select: () =>
											Effect.fail(
												new PromptUnavailableError({
													field: "Choose editor",
													message: "Interactive selection is unavailable",
												}),
											),
									}),
								),
							]),
						),
						Effect.either,
					);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(
							ResolveEditorCommandUnavailableError,
						);
						expect(result.left.message).toBe(
							[
								"No editor configured.",
								"Set BETTER_AGE_EDITOR, use a saved default, or set $VISUAL/$EDITOR, then retry.",
								"",
							].join("\n"),
						);
					}
				} finally {
					process.env.BETTER_AGE_EDITOR = previous.BETTER_AGE_EDITOR;
					process.env.VISUAL = previous.VISUAL;
					process.env.EDITOR = previous.EDITOR;
				}
			}),
	);
});
