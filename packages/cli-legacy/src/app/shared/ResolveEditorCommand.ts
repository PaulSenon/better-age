import { Effect, Option } from "effect";
import {
	getDefaultEditorCommand,
	type HomeState,
} from "../../domain/home/HomeState.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import {
	type PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import {
	ResolveEditorCommandPersistenceError,
	ResolveEditorCommandUnavailableError,
} from "./ResolveEditorCommandError.js";

const editorChooserRemediationMessage = [
	"No editor configured.",
	"Set BETTER_AGE_EDITOR, use a saved default, or set $VISUAL/$EDITOR, then retry.",
	"",
].join("\n");

export class ResolveEditorCommand extends Effect.Service<ResolveEditorCommand>()(
	"ResolveEditorCommand",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;
			const interactivePrompt = yield* InteractivePrompt;

			const chooseEditor = (
				state: HomeState,
			): Effect.Effect<
				string,
				| PromptReadAbortedError
				| ResolveEditorCommandPersistenceError
				| ResolveEditorCommandUnavailableError
			> =>
				interactivePrompt
					.select({
						choices: [
							{ title: "vim", value: "vim" },
							{ title: "nvim", value: "nvim" },
							{ title: "nano", value: "nano" },
							{ title: "vi", value: "vi" },
							{ title: "code --wait", value: "code --wait" },
						],
						message: "Choose editor",
					})
					.pipe(
						Effect.flatMap((editorCommand) =>
							interactivePrompt
								.select({
									choices: [
										{ title: "Use once", value: "once" as const },
										{
											title: "Save as default",
											value: "save" as const,
										},
										{ title: "Back", value: "back" as const },
									],
									message: `Use ${editorCommand}`,
								})
								.pipe(
									Effect.flatMap((action) => {
										if (action === "back") {
											return chooseEditor(state);
										}

										if (action === "save") {
											return homeRepository
												.saveState({
													...state,
													defaultEditorCommand: Option.some(editorCommand),
												})
												.pipe(
													Effect.mapError(
														(error) =>
															new ResolveEditorCommandPersistenceError({
																message: error.message,
															}),
													),
													Effect.as(editorCommand),
												);
										}

										return Effect.succeed(editorCommand);
									}),
								),
						),
						Effect.catchIf(
							(error): error is PromptUnavailableError =>
								error instanceof PromptUnavailableError,
							() =>
								Effect.fail(
									new ResolveEditorCommandUnavailableError({
										message: editorChooserRemediationMessage,
									}),
								),
						),
					);

			const resolve: () => Effect.Effect<
				string,
				| PromptReadAbortedError
				| ResolveEditorCommandPersistenceError
				| ResolveEditorCommandUnavailableError
			> = Effect.fn("ResolveEditorCommand.resolve")(function* () {
				const state = yield* homeRepository.loadState.pipe(
					Effect.mapError(
						(error) =>
							new ResolveEditorCommandPersistenceError({
								message: error.message,
							}),
					),
				);
				const configuredEditor =
					process.env.BETTER_AGE_EDITOR ??
					Option.getOrUndefined(getDefaultEditorCommand(state)) ??
					process.env.VISUAL ??
					process.env.EDITOR;

				if (configuredEditor !== undefined && configuredEditor.trim() !== "") {
					return configuredEditor;
				}

				return yield* chooseEditor(state);
			});

			return { resolve };
		}),
	},
) {}
