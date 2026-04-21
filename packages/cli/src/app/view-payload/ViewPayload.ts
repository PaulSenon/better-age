import { Effect, type Option } from "effect";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { SecureViewer } from "../../port/SecureViewer.js";
import {
	SecureViewerDisplayError,
	SecureViewerUnavailableError,
} from "../../port/SecureViewerError.js";
import { ReadPayload } from "../read-payload/ReadPayload.js";
import {
	ReadPayloadCryptoError,
	ReadPayloadEnvError,
	ReadPayloadEnvelopeError,
	ReadPayloadFileFormatError,
	ReadPayloadPersistenceError,
	ReadPayloadVersionError,
} from "../read-payload/ReadPayloadError.js";
import { ResolvePayloadTarget } from "../shared/ResolvePayloadTarget.js";
import { ResolvePayloadTargetError } from "../shared/ResolvePayloadTargetError.js";

export class ViewPayloadFailedError extends Error {
	override readonly name = "ViewPayloadFailedError";
}

export class ViewPayload extends Effect.Service<ViewPayload>()("ViewPayload", {
	accessors: true,
		effect: Effect.gen(function* () {
			const prompt = yield* Prompt;
		const readPayload = yield* ReadPayload;
		const resolvePayloadTarget = yield* ResolvePayloadTarget;
		const secureViewer = yield* SecureViewer;

			const failWithMessage = (message: string) =>
				Effect.gen(function* () {
					yield* prompt.writeStderr(`${message}\n`);
					return yield* Effect.fail(new ViewPayloadFailedError());
				});

			const writeUpdateWarning = (path: string) =>
				prompt.writeStderr(
					["Warning: payload should be updated", `Run: bage update ${path}`, ""].join(
						"\n",
					),
				);

		const execute = Effect.fn("ViewPayload.execute")(function* (input: {
			readonly path: Option.Option<string>;
		}) {
			return yield* Effect.gen(function* () {
				const resolvedPath = yield* resolvePayloadTarget.resolveExistingPath(
					input.path,
				);
				const passphrase = yield* prompt.inputSecret({
					message: "Passphrase: ",
				});
				const result = yield* readPayload.execute({
					passphrase,
					path: resolvedPath,
				});

				yield* secureViewer.view({
					envText: result.envText,
					path: result.path,
				});

				if (result.needsUpdate.isRequired) {
					yield* writeUpdateWarning(result.path);
				}
			}).pipe(
				Effect.catchIf(
					(error): error is ResolvePayloadTargetError =>
						error instanceof ResolvePayloadTargetError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is PromptReadAbortedError =>
						error instanceof PromptReadAbortedError,
					() => Effect.void,
				),
				Effect.catchIf(
					(error): error is PromptUnavailableError =>
						error instanceof PromptUnavailableError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadPersistenceError =>
						error instanceof ReadPayloadPersistenceError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadFileFormatError =>
						error instanceof ReadPayloadFileFormatError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadEnvelopeError =>
						error instanceof ReadPayloadEnvelopeError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadVersionError =>
						error instanceof ReadPayloadVersionError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadEnvError =>
						error instanceof ReadPayloadEnvError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is ReadPayloadCryptoError =>
						error instanceof ReadPayloadCryptoError,
					() =>
						failWithMessage(
							"Failed to decrypt payload with provided passphrase",
						),
				),
				Effect.catchIf(
					(error): error is SecureViewerUnavailableError =>
						error instanceof SecureViewerUnavailableError,
					(error) => failWithMessage(error.message),
				),
				Effect.catchIf(
					(error): error is SecureViewerDisplayError =>
						error instanceof SecureViewerDisplayError,
					(error) => failWithMessage(error.message),
				),
			);
		});

		return { execute };
	}),
}) {}
