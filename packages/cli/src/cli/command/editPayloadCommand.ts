import { Args, Command } from "@effect/cli";
import { Effect, type Option } from "effect";
import {
	EditPayloadCryptoError,
	EditPayloadEnvError,
	EditPayloadPersistenceError,
	EditPayloadUpdateRequiredError,
} from "../../app/edit-payload/EditPayloadError.js";
import {
	ResolveEditorCommandPersistenceError,
	ResolveEditorCommandUnavailableError,
} from "../../app/shared/ResolveEditorCommandError.js";
import { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadPersistenceError,
} from "../../app/update-payload/UpdatePayloadError.js";
import {
	EditorExitError,
	EditorLaunchError,
	EditorUnavailableError,
} from "../../port/EditorError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import {
	TempFileCreateError,
	TempFileReadError,
} from "../../port/TempFileError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { runEditPayloadFlow } from "../flow/editPayloadFlow.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { renderUpdateRequiredMessage } from "../shared/updateGate.js";

export class EditPayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "edit",
			name: "EditPayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);

export const runEditPayload = (input: {
	readonly path: Option.Option<string>;
}) =>
	runEditPayloadFlow(input).pipe(
		Effect.catchIf(
			(error): error is EditPayloadUpdateRequiredError =>
				error instanceof EditPayloadUpdateRequiredError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(
						renderUpdateRequiredMessage("edit", error.path),
					);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadPersistenceError =>
				error instanceof UpdatePayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadCryptoError =>
				error instanceof UpdatePayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadEnvError =>
				error instanceof UpdatePayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditPayloadPersistenceError =>
				error instanceof EditPayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditPayloadCryptoError =>
				error instanceof EditPayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditPayloadEnvError =>
				error instanceof EditPayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is TempFileCreateError =>
				error instanceof TempFileCreateError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolvePayloadTargetError =>
				error instanceof ResolvePayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is TempFileReadError => error instanceof TempFileReadError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditorLaunchError => error instanceof EditorLaunchError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditorExitError => error instanceof EditorExitError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is EditorUnavailableError =>
				error instanceof EditorUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolveEditorCommandPersistenceError =>
				error instanceof ResolveEditorCommandPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolveEditorCommandUnavailableError =>
				error instanceof ResolveEditorCommandUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(error.message);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new EditPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GuidedFlowCancelledError =>
				error instanceof GuidedFlowCancelledError,
			() => Effect.void,
		),
	);

export const editPayloadCommand = Command.make(
	"edit",
	{
		path: pathArg,
	},
	({ path }) => runEditPayload({ path }),
);
