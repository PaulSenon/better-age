import { Command } from "@effect/cli";
import { Effect } from "effect";
import {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { InteractiveSession } from "../flow/InteractiveSession.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";

export class InteractiveCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "interactive",
			name: "InteractiveCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

export const interactiveCommand = Command.make("interactive", {}, () =>
	InteractiveSession.run().pipe(
		Effect.catchIf(
			(error): error is HomeStateLoadError =>
				error instanceof HomeStateLoadError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InteractiveCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is HomeStateDecodeError =>
				error instanceof HomeStateDecodeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InteractiveCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InteractiveCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InteractiveCommandFailedError());
				}),
		),
	),
);
