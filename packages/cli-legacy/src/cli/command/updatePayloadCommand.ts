import { Args, Command } from "@effect/cli";
import { Effect, type Option } from "effect";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadEnvelopeError,
	UpdatePayloadFileFormatError,
	UpdatePayloadNoSelfIdentityError,
	UpdatePayloadPersistenceError,
	UpdatePayloadVersionError,
} from "../../app/update-payload/UpdatePayloadError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { makePassphraseSession } from "../shared/passphraseSession.js";
import { runSetupGate } from "../shared/setupFlow.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class UpdatePayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "update",
			name: "UpdatePayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);

const renderUpdateSuccessMessage = (input: {
	readonly path: string;
	readonly reasons: ReadonlyArray<string>;
}) =>
	input.reasons.length === 0
		? `updated ${input.path}\n`
		: `updated ${input.path} (${input.reasons.join(", ")})\n`;

export const runUpdatePayload = (input: {
	readonly path: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const path = yield* ResolvePayloadTarget.resolveExistingPath(input.path);
		const getPassphrase = makePassphraseSession();

		return yield* Effect.gen(function* () {
			const runUpdate = () =>
				getPassphrase().pipe(
					Effect.flatMap((passphrase) =>
						UpdatePayload.execute({
							passphrase,
							path,
						}),
					),
				);
			const attemptUpdate = runUpdate().pipe(
				Effect.catchIf(
					(error): error is UpdatePayloadNoSelfIdentityError =>
						error instanceof UpdatePayloadNoSelfIdentityError,
					(error) =>
						Effect.gen(function* () {
							if (input.path._tag === "Some") {
								yield* Prompt.writeStderr(`${error.message}\n`);
								return yield* Effect.fail(
									new UpdatePayloadCommandFailedError(),
								);
							}

							yield* runSetupGate();
							return yield* runUpdate();
						}),
				),
			);
			const result = yield* attemptUpdate;

			switch (result._tag) {
				case "UpdatePayloadUnchangedSuccess":
					yield* Prompt.writeStdout(`payload already up to date: ${path}\n`);
					return;
				case "UpdatePayloadUpdatedSuccess":
					yield* Prompt.writeStdout(
						renderUpdateSuccessMessage({
							path,
							reasons: result.reasons,
						}),
					);
			}
		}).pipe(
			Effect.catchIf(
				(error): error is UpdatePayloadPersistenceError =>
					error instanceof UpdatePayloadPersistenceError,
				() =>
					asCommandFailure(
						new UpdatePayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.UPDATE.FAILED",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is UpdatePayloadFileFormatError =>
					error instanceof UpdatePayloadFileFormatError,
				() =>
					asCommandFailure(
						new UpdatePayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.UPDATE.FAILED",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is UpdatePayloadCryptoError =>
					error instanceof UpdatePayloadCryptoError,
				() =>
					asCommandFailure(
						new UpdatePayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.UPDATE.FAILED",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is UpdatePayloadEnvelopeError =>
					error instanceof UpdatePayloadEnvelopeError,
				() =>
					asCommandFailure(
						new UpdatePayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.UPDATE.FAILED",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is UpdatePayloadVersionError =>
					error instanceof UpdatePayloadVersionError,
				(error) =>
					Effect.gen(function* () {
						yield* Prompt.writeStderr(`${error.message}\n`);
						return yield* Effect.fail(new UpdatePayloadCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is UpdatePayloadEnvError =>
					error instanceof UpdatePayloadEnvError,
				() =>
					asCommandFailure(
						new UpdatePayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.UPDATE.FAILED",
							path,
						}),
					),
			),
		);
	}).pipe(
		Effect.catchIf(
			(error): error is UpdatePayloadNoSelfIdentityError =>
				error instanceof UpdatePayloadNoSelfIdentityError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new UpdatePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GuidedFlowCancelledError =>
				error instanceof GuidedFlowCancelledError,
			() => Effect.void,
		),
		Effect.catchIf(
			(error): error is ResolvePayloadTargetError =>
				error instanceof ResolvePayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new UpdatePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			() => Effect.void,
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			() =>
				asCommandFailure(
					new UpdatePayloadCommandFailedError(),
					writeUserFacingError({
						id: "ERR.PASSPHRASE.UNAVAILABLE",
					}),
				),
		),
	);

export const updatePayloadCommand = Command.make(
	"update",
	{
		path: pathArg,
	},
	({ path }) => runUpdatePayload({ path }),
);
