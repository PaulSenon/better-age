import { Args, Command } from "@effect/cli";
import { Effect, Option } from "effect";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import {
	ImportIdentityStringConflictError,
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	ImportIdentityStringPersistenceError,
	type ImportIdentityStringSuccess,
} from "../../app/import-identity-string/ImportIdentityStringError.js";
import type { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import {
	promptForIdentityErrorAction,
	type ResolvedIdentityInput,
	resolveIdentityStringInput,
} from "../shared/identityInputFlow.js";
import type { ResolveIdentityInputError } from "../shared/resolveIdentityInputError.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class AddIdentityCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "add-identity",
			name: "AddIdentityCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const identityStringArg = Args.text({ name: "identity-string" }).pipe(
	Args.optional,
);

type AddIdentityFlowError =
	| GuidedFlowCancelledError
	| ImportIdentityStringConflictError
	| ImportIdentityStringDecodeError
	| ImportIdentityStringForbiddenSelfError
	| ImportIdentityStringPersistenceError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveIdentityInputError;

type AddIdentityFlowContext = ImportIdentityString | InteractivePrompt | Prompt;

export const addIdentityCommand = Command.make(
	"add-identity",
	{
		identityString: identityStringArg,
	},
	({ identityString }) =>
		Effect.gen(function* () {
			const isGuided = Option.isNone(identityString);
			const importIdentity = (
				resolvedIdentityString: ResolvedIdentityInput,
			): Effect.Effect<
				ImportIdentityStringSuccess,
				AddIdentityFlowError,
				AddIdentityFlowContext
			> =>
				ImportIdentityString.execute({
					identityString: resolvedIdentityString.identityRef,
				}).pipe(
					Effect.catchIf(
						(error): error is ImportIdentityStringDecodeError =>
							error instanceof ImportIdentityStringDecodeError,
						(error) =>
							isGuided && resolvedIdentityString.source === "typed"
								? Prompt.writeStderr(`${error.message}\n`).pipe(
										Effect.flatMap(() =>
											promptForIdentityErrorAction({
												kind: "invalid-identity-string",
											}),
										),
										Effect.flatMap((action) =>
											action._tag === "edit-input"
												? resolveIdentityStringInput(Option.none()).pipe(
														Effect.flatMap(importIdentity),
													)
												: Effect.fail(new GuidedFlowCancelledError()),
										),
									)
								: Effect.fail(error),
					),
					Effect.catchIf(
						(error): error is ImportIdentityStringForbiddenSelfError =>
							error instanceof ImportIdentityStringForbiddenSelfError,
						(error) =>
							isGuided && resolvedIdentityString.source === "typed"
								? Prompt.writeStderr(`${error.message}\n`).pipe(
										Effect.flatMap(() =>
											promptForIdentityErrorAction({
												kind: "self-forbidden",
											}),
										),
										Effect.flatMap((action) =>
											action._tag === "edit-input"
												? resolveIdentityStringInput(Option.none()).pipe(
														Effect.flatMap(importIdentity),
													)
												: Effect.fail(new GuidedFlowCancelledError()),
										),
									)
								: Effect.fail(error),
					),
				);

			const resolvedIdentityString =
				yield* resolveIdentityStringInput(identityString);
			const result = yield* importIdentity(resolvedIdentityString);

			yield* Prompt.writeStdout(
				`${result.outcome} ${result.displayName} (${result.handle})\n`,
			);
		}).pipe(
			Effect.catchIf(
				(error): error is ImportIdentityStringConflictError =>
					error instanceof ImportIdentityStringConflictError,
				() =>
					asCommandFailure(
						new AddIdentityCommandFailedError(),
						writeUserFacingError({
							id: "ERR.IDENTITY.CONFLICT",
						}),
					),
			),
			Effect.catchIf(
				(error): error is ImportIdentityStringDecodeError =>
					error instanceof ImportIdentityStringDecodeError,
				() =>
					asCommandFailure(
						new AddIdentityCommandFailedError(),
						writeUserFacingError({
							id: "ERR.IDENTITY_STRING.INVALID",
						}),
					),
			),
			Effect.catchIf(
				(error): error is ImportIdentityStringForbiddenSelfError =>
					error instanceof ImportIdentityStringForbiddenSelfError,
				() =>
					asCommandFailure(
						new AddIdentityCommandFailedError(),
						Prompt.writeStderr("Cannot import your own identity string\n"),
					),
			),
			Effect.catchIf(
				(error): error is ImportIdentityStringPersistenceError =>
					error instanceof ImportIdentityStringPersistenceError,
				() =>
					asCommandFailure(
						new AddIdentityCommandFailedError(),
						writeUserFacingError({
							id: "ERR.IDENTITY.IMPORT_FAILED",
						}),
					),
			),
			Effect.catchIf(
				(error): error is PromptReadAbortedError =>
					error instanceof PromptReadAbortedError,
				() => Effect.void,
			),
			Effect.catchIf(
				(error): error is GuidedFlowCancelledError =>
					error instanceof GuidedFlowCancelledError,
				() => Effect.void,
			),
			Effect.catchIf(
				(error): error is PromptUnavailableError =>
					error instanceof PromptUnavailableError,
				() =>
					asCommandFailure(
						new AddIdentityCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PROMPT.UNAVAILABLE",
						}),
					),
			),
		),
);
