import { Args, Command } from "@effect/cli";
import { Effect, type Option } from "effect";
import { CreatePayload } from "../../app/create-payload/CreatePayload.js";
import {
	CreatePayloadCryptoError,
	CreatePayloadNotSetUpError,
	CreatePayloadPersistenceError,
} from "../../app/create-payload/CreatePayloadError.js";
import { ResolveNewPayloadTarget } from "../../app/shared/ResolveNewPayloadTarget.js";
import { ResolveNewPayloadTargetError } from "../../app/shared/ResolveNewPayloadTargetError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";

export class CreatePayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "create",
			name: "CreatePayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);

export const runCreatePayload = (input: {
	readonly path: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const { path: resolvedPath } = yield* ResolveNewPayloadTarget.resolvePath(
			input.path,
		);

		const result = yield* CreatePayload.execute({
			path: resolvedPath,
		});

		yield* Prompt.writeStdout(`Created encrypted payload at ${result.path}\n`);
	}).pipe(
		Effect.catchIf(
			(error): error is CreatePayloadNotSetUpError =>
				error instanceof CreatePayloadNotSetUpError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new CreatePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is CreatePayloadPersistenceError =>
				error instanceof CreatePayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new CreatePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is CreatePayloadCryptoError =>
				error instanceof CreatePayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new CreatePayloadCommandFailedError());
				}),
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
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new CreatePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolveNewPayloadTargetError =>
				error instanceof ResolveNewPayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new CreatePayloadCommandFailedError());
				}),
		),
	);

export const createPayloadCommand = Command.make(
	"create",
	{
		path: pathArg,
	},
	({ path }) => runCreatePayload({ path }),
);
