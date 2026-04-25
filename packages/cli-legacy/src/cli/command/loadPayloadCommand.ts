import { Args, Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";
import { ReadPayload } from "../../app/read-payload/ReadPayload.js";
import {
	ReadPayloadCryptoError,
	ReadPayloadEnvError,
	ReadPayloadEnvelopeError,
	ReadPayloadFileFormatError,
	ReadPayloadPersistenceError,
	ReadPayloadVersionError,
} from "../../app/read-payload/ReadPayloadError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { PROTOCOL_VERSION } from "../shared/loadProtocolContract.js";
import {
	asCommandFailure,
	writeUserFacingError,
	writeUserFacingWarning,
} from "../shared/userFacingMessage.js";

export class LoadPayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "load",
			name: "LoadPayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const protocolVersionOption = Options.optional(
	Options.text("protocol-version"),
);
const pathArg = Args.text({ name: "path" });

export const loadPayloadCommand = Command.make(
	"load",
	{
		protocolVersion: protocolVersionOption,
		path: pathArg,
	},
	({ protocolVersion, path }) =>
		Effect.gen(function* () {
			if (Option.isNone(protocolVersion)) {
				return yield* asCommandFailure(
					new LoadPayloadCommandFailedError(),
					writeUserFacingError({
						id: "ERR.LOAD.PROTOCOL_REQUIRED",
					}),
				);
			}

			const resolvedProtocolVersion = protocolVersion.value;

			if (resolvedProtocolVersion !== PROTOCOL_VERSION) {
				return yield* asCommandFailure(
					new LoadPayloadCommandFailedError(),
					writeUserFacingError({
						id: "ERR.LOAD.PROTOCOL_UNSUPPORTED",
						receivedVersion: resolvedProtocolVersion,
					}),
				);
			}

			const passphrase = yield* Prompt.inputSecret({
				message: "Passphrase: ",
			});
			const result = yield* ReadPayload.execute({
				passphrase,
				path,
			});

			yield* Prompt.writeStdout(result.envText);

			if (result.needsUpdate.isRequired) {
				yield* writeUserFacingWarning({
					id: "WARN.LOAD.UPDATE_REQUIRED",
					path,
				});
			}
		}).pipe(
			Effect.catchIf(
				(error): error is ReadPayloadPersistenceError =>
					error instanceof ReadPayloadPersistenceError,
				(error) =>
					Effect.gen(function* () {
						yield* Prompt.writeStderr(`${error.message}\n`);
						return yield* Effect.fail(new LoadPayloadCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is ReadPayloadFileFormatError =>
					error instanceof ReadPayloadFileFormatError,
				() =>
					asCommandFailure(
						new LoadPayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PAYLOAD.INVALID_FORMAT",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is ReadPayloadCryptoError =>
					error instanceof ReadPayloadCryptoError,
				() =>
					asCommandFailure(
						new LoadPayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PAYLOAD.DECRYPT_FAILED",
						}),
					),
			),
			Effect.catchIf(
				(error): error is ReadPayloadEnvelopeError =>
					error instanceof ReadPayloadEnvelopeError,
				() =>
					asCommandFailure(
						new LoadPayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PAYLOAD.INVALID_FORMAT",
							path,
						}),
					),
			),
			Effect.catchIf(
				(error): error is ReadPayloadVersionError =>
					error instanceof ReadPayloadVersionError,
				(error) =>
					Effect.gen(function* () {
						yield* Prompt.writeStderr(`${error.message}\n`);
						return yield* Effect.fail(new LoadPayloadCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is ReadPayloadEnvError =>
					error instanceof ReadPayloadEnvError,
				() =>
					asCommandFailure(
						new LoadPayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PAYLOAD.INVALID_FORMAT",
							path,
						}),
					),
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
						new LoadPayloadCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PASSPHRASE.UNAVAILABLE",
						}),
					),
			),
		),
);
