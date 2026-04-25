import { Effect, Option } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PayloadDiscovery } from "../../port/PayloadDiscovery.js";
import { Prompt } from "../../port/Prompt.js";
import type { PromptReadAbortedError } from "../../port/PromptError.js";
import { PromptUnavailableError } from "../../port/PromptError.js";
import { ResolvePayloadTargetError } from "./ResolvePayloadTargetError.js";

const renderNoPayloadsMessage = () =>
	[
		"No payload path provided and no .env*.enc payloads were found in the current directory.",
		"Pass a path explicitly.",
	].join("\n");

const renderMultiplePayloadsMessage = (paths: ReadonlyArray<string>) =>
	[
		"Multiple .env*.enc payloads were found in the current directory.",
		"Pass one path explicitly:",
		...paths,
	].join("\n");

type ResolvePayloadTargetShape = {
	readonly resolveExistingPath: (
		path: Option.Option<string>,
	) => Effect.Effect<
		string,
		PromptReadAbortedError | ResolvePayloadTargetError
	>;
};

export class ResolvePayloadTarget extends Effect.Service<ResolvePayloadTarget>()(
	"ResolvePayloadTarget",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const interactivePrompt = yield* InteractivePrompt;
			const payloadDiscovery = yield* PayloadDiscovery;
			const prompt = yield* Prompt;

			const selectDiscoveredPath: (
				paths: ReadonlyArray<string>,
			) => Effect.Effect<
				string,
				PromptReadAbortedError | ResolvePayloadTargetError
			> = Effect.fn("ResolvePayloadTarget.selectDiscoveredPath")(
				function* (paths) {
					switch (paths.length) {
						case 0:
							return yield* prompt
								.inputText({
									message: "Payload path",
								})
								.pipe(
									Effect.catchIf(
										(error): error is PromptUnavailableError =>
											error instanceof PromptUnavailableError,
										() =>
											Effect.fail(
												new ResolvePayloadTargetError({
													message: renderNoPayloadsMessage(),
												}),
											),
									),
								);
						case 1: {
							const onlyPath = paths[0];

							if (onlyPath === undefined) {
								return yield* Effect.dieMessage(
									"Expected one discovered payload",
								);
							}

							yield* prompt.writeStderr(`Using ${onlyPath}\n`);
							return onlyPath;
						}
						default:
							return yield* interactivePrompt
								.select<string>({
									choices: paths.map((path) => ({
										title: path,
										value: path,
									})),
									message: "Select payload",
								})
								.pipe(
									Effect.catchIf(
										(error): error is PromptUnavailableError =>
											error instanceof PromptUnavailableError,
										() =>
											Effect.fail(
												new ResolvePayloadTargetError({
													message: renderMultiplePayloadsMessage(paths),
												}),
											),
									),
								);
					}
				},
			);

			const resolveExistingPath: ResolvePayloadTargetShape["resolveExistingPath"] =
				Effect.fn("ResolvePayloadTarget.resolveExistingPath")(function* (path) {
					if (Option.isSome(path)) {
						return path.value;
					}

					const discoveredPaths = yield* payloadDiscovery.discoverFromCwd.pipe(
						Effect.mapError(
							(error) =>
								new ResolvePayloadTargetError({
									message: error.message,
								}),
						),
					);
					return yield* selectDiscoveredPath(discoveredPaths);
				});

			return { resolveExistingPath };
		}),
	},
) {}
