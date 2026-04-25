import { Effect, Option } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PathAccess } from "../../port/PathAccess.js";
import { Prompt } from "../../port/Prompt.js";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { PromptUnavailableError as PromptUnavailableTaggedError } from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { ResolveNewPayloadTargetError } from "./ResolveNewPayloadTargetError.js";

const renderPathAlreadyExistsMessage = (path: string) =>
	[`Payload already exists: ${path}`, "Pass a different path explicitly."].join(
		"\n",
	);

const renderMissingPathMessage = () =>
	["Missing required payload path", "Pass a payload path explicitly"].join(
		"\n",
	);

type ResolveNewPayloadResult = {
	readonly overwriteApproved: boolean;
	readonly path: string;
};

type ResolveNewPayloadTargetFailure =
	| GuidedFlowCancelledError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveNewPayloadTargetError;

type ResolveNewPayloadTargetShape = {
	readonly resolvePath: (
		path: Option.Option<string>,
	) => Effect.Effect<ResolveNewPayloadResult, ResolveNewPayloadTargetFailure>;
};

export class ResolveNewPayloadTarget extends Effect.Service<ResolveNewPayloadTarget>()(
	"ResolveNewPayloadTarget",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const interactivePrompt = yield* InteractivePrompt;
			const pathAccess = yield* PathAccess;
			const prompt = yield* Prompt;

			const chooseOverwrite = Effect.fn(
				"ResolveNewPayloadTarget.chooseOverwrite",
			)(function* (path: string) {
				return yield* interactivePrompt
					.select({
						choices: [
							{ title: "Enter different path", value: "retry" as const },
							{ title: "Overwrite", value: "overwrite" as const },
							{ title: "Back", value: "back" as const },
							{ title: "Cancel", value: "cancel" as const },
						],
						message: `Payload already exists: ${path}`,
					})
					.pipe(
						Effect.catchIf(
							(error): error is PromptUnavailableError =>
								error instanceof PromptUnavailableTaggedError,
							() =>
								Effect.fail(
									new ResolveNewPayloadTargetError({
										message: renderPathAlreadyExistsMessage(path),
									}),
								),
						),
					);
			});

			const resolveGuidedPath = (): Effect.Effect<
				ResolveNewPayloadResult,
				ResolveNewPayloadTargetFailure
			> =>
				Effect.gen(function* () {
					const path = yield* prompt
						.inputText({
							defaultValue: ".env.enc",
							message: "Payload path",
						})
						.pipe(
							Effect.catchIf(
								(error): error is PromptUnavailableError =>
									error instanceof PromptUnavailableTaggedError,
								() =>
									Effect.fail(
										new ResolveNewPayloadTargetError({
											message: renderMissingPathMessage(),
										}),
									),
							),
						);
					const alreadyExists = yield* pathAccess.exists(path);

					if (!alreadyExists) {
						return {
							overwriteApproved: false,
							path,
						} as const;
					}

					const nextStep = yield* chooseOverwrite(path);

					switch (nextStep) {
						case "overwrite":
							return {
								overwriteApproved: true,
								path,
							} as const;
						case "retry":
							return yield* resolveGuidedPath();
						case "back":
						case "cancel":
							return yield* Effect.fail(new GuidedFlowCancelledError());
					}
				});

			const resolvePath: ResolveNewPayloadTargetShape["resolvePath"] =
				Effect.fn("ResolveNewPayloadTarget.resolvePath")(function* (path) {
					if (Option.isSome(path)) {
						const alreadyExists = yield* pathAccess.exists(path.value);

						if (alreadyExists) {
							return yield* new ResolveNewPayloadTargetError({
								message: renderPathAlreadyExistsMessage(path.value),
							});
						}

						return {
							overwriteApproved: false,
							path: path.value,
						} as const;
					}

					return yield* resolveGuidedPath();
				});

			return { resolvePath };
		}),
	},
) {}
