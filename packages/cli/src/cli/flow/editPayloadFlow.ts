import { Effect, type Option } from "effect";
import { EditPayload } from "../../app/edit-payload/EditPayload.js";
import {
	type EditPayloadCryptoError,
	EditPayloadEnvError,
	type EditPayloadPersistenceError,
	EditPayloadUpdateRequiredError,
} from "../../app/edit-payload/EditPayloadError.js";
import { ResolveEditorCommand } from "../../app/shared/ResolveEditorCommand.js";
import type {
	ResolveEditorCommandPersistenceError,
	ResolveEditorCommandUnavailableError,
} from "../../app/shared/ResolveEditorCommandError.js";
import type { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import type { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import type {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadEnvelopeError,
	UpdatePayloadFileFormatError,
	UpdatePayloadNoSelfIdentityError,
	UpdatePayloadPersistenceError,
} from "../../app/update-payload/UpdatePayloadError.js";
import { Editor } from "../../port/Editor.js";
import type {
	EditorExitError,
	EditorLaunchError,
	EditorUnavailableError,
} from "../../port/EditorError.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { TempFile } from "../../port/TempFile.js";
import type {
	TempFileCreateError,
	TempFileReadError,
} from "../../port/TempFileError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { makePassphraseSession } from "../shared/passphraseSession.js";
import type { PayloadMutationFlowStep } from "../shared/payloadMutationFlow.js";
import {
	payloadMutationBack,
	payloadMutationCancel,
	payloadMutationDone,
	runResolvedPayloadMutationFlow,
} from "../shared/payloadMutationFlow.js";
import {
	renderUpdateRequiredMessage,
	runPayloadUpdateGate,
} from "../shared/updateGate.js";

export type EditPayloadFlowError =
	| EditPayloadCryptoError
	| EditPayloadEnvError
	| EditPayloadPersistenceError
	| EditPayloadUpdateRequiredError
	| EditorExitError
	| EditorLaunchError
	| EditorUnavailableError
	| GuidedFlowCancelledError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveEditorCommandPersistenceError
	| ResolveEditorCommandUnavailableError
	| ResolvePayloadTargetError
	| TempFileCreateError
	| TempFileReadError
	| UpdatePayloadCryptoError
	| UpdatePayloadEnvelopeError
	| UpdatePayloadEnvError
	| UpdatePayloadFileFormatError
	| UpdatePayloadNoSelfIdentityError
	| UpdatePayloadPersistenceError;

export type EditPayloadFlowContext =
	| EditPayload
	| Editor
	| InteractivePrompt
	| Prompt
	| ResolvePayloadTarget
	| TempFile
	| UpdatePayload;

const withCleanup = <A, E>(
	tempPath: string,
	effect: Effect.Effect<
		A,
		E,
		EditPayload | Editor | InteractivePrompt | Prompt | TempFile
	>,
) =>
	effect.pipe(
		Effect.ensuring(
			TempFile.delete(tempPath).pipe(Effect.catchAll(() => Effect.void)),
		),
	);

const runEditLoop = (input: {
	readonly editorCommand: string;
	readonly getPassphrase: () => Effect.Effect<
		string,
		PromptReadAbortedError | PromptUnavailableError,
		Prompt
	>;
	readonly path: string;
	readonly tempPath: string;
}): Effect.Effect<
	void,
	| EditPayloadCryptoError
	| EditPayloadPersistenceError
	| EditPayloadUpdateRequiredError
	| EditorExitError
	| EditorLaunchError
	| EditorUnavailableError
	| GuidedFlowCancelledError
	| PromptReadAbortedError
	| PromptUnavailableError
	| TempFileReadError,
	EditPayload | Editor | InteractivePrompt | Prompt | TempFile
> =>
	Effect.gen(function* () {
		yield* Editor.editFile({
			command: input.editorCommand,
			path: input.tempPath,
		});
		const editedEnvText = yield* TempFile.read(input.tempPath);
		const passphrase = yield* input.getPassphrase();
		const result = yield* EditPayload.save({
			editedEnvText,
			passphrase,
			path: input.path,
		}).pipe(Effect.either);

		if (result._tag === "Left") {
			if (!(result.left instanceof EditPayloadEnvError)) {
				return yield* result.left;
			}

			yield* Prompt.writeStderr(`${result.left.message}\n`);
			const action = yield* InteractivePrompt.pipe(
				Effect.flatMap((interactivePrompt) =>
					interactivePrompt.select({
						choices: [
							{ title: "Reopen editor", value: "reopen" as const },
							{
								title: "Discard changes and back",
								value: "discard" as const,
							},
							{ title: "Cancel", value: "cancel" as const },
						],
						message: "Edited env is invalid",
					}),
				),
			);

			if (action === "reopen") {
				return yield* runEditLoop(input);
			}

			return yield* Effect.fail(new GuidedFlowCancelledError());
		}

		switch (result.right._tag) {
			case "EditPayloadUnchangedSuccess": {
				yield* Prompt.writeStdout(`No secret changes in ${input.path}\n`);
				return;
			}
			case "EditPayloadRewrittenSuccess": {
				yield* Prompt.writeStdout(
					`Updated encrypted payload at ${input.path}\n`,
				);
				return;
			}
		}
	});

export const runEditPayloadFlow = (input: {
	readonly path: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const editorCommand = yield* ResolveEditorCommand.resolve();
		const getPassphrase = makePassphraseSession();

		const runEditAtPath = (
			resolvedPath: string,
		): Effect.Effect<
			PayloadMutationFlowStep<void>,
			EditPayloadFlowError,
			EditPayloadFlowContext
		> =>
			Effect.gen(function* () {
				const openForEdit = () =>
					getPassphrase().pipe(
						Effect.flatMap((passphrase) =>
							EditPayload.open({
								passphrase,
								path: resolvedPath,
							}),
						),
					);
				const openedPayloadResult = yield* openForEdit().pipe(Effect.either);

				if (openedPayloadResult._tag === "Left") {
					if (
						!(
							openedPayloadResult.left instanceof EditPayloadUpdateRequiredError
						)
					) {
						return yield* openedPayloadResult.left;
					}

					if (input.path._tag !== "None") {
						return yield* new EditPayloadUpdateRequiredError({
							message: renderUpdateRequiredMessage("edit", resolvedPath),
							path: resolvedPath,
						});
					}

					const outcome = yield* runPayloadUpdateGate(
						getPassphrase().pipe(
							Effect.flatMap((passphrase) =>
								UpdatePayload.execute({
									passphrase,
									path: resolvedPath,
								}),
							),
						),
					);

					switch (outcome) {
						case "updated":
							return yield* runEditAtPath(resolvedPath);
						case "back":
							return payloadMutationBack("path");
						case "cancel":
							return payloadMutationCancel();
					}
				}

				const tempFile = yield* TempFile.create({
					extension: ".env",
					initialContents: openedPayloadResult.right.envText,
				});

				yield* withCleanup(
					tempFile.path,
					runEditLoop({
						editorCommand,
						getPassphrase,
						path: resolvedPath,
						tempPath: tempFile.path,
					}),
				);

				return payloadMutationDone(undefined);
			});

		return yield* runResolvedPayloadMutationFlow({
			path: input.path,
			runAtPath: runEditAtPath,
		});
	});
