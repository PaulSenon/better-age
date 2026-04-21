import { Effect, Option } from "effect";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import type {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
} from "../../app/inspect-payload/InspectPayloadError.js";
import { RevokePayloadRecipient } from "../../app/revoke-payload-recipient/RevokePayloadRecipient.js";
import {
	RevokePayloadRecipientAmbiguousIdentityError,
	type RevokePayloadRecipientCryptoError,
	type RevokePayloadRecipientEnvError,
	RevokePayloadRecipientForbiddenSelfError,
	type RevokePayloadRecipientPersistenceError,
	type RevokePayloadRecipientRemovedSuccess,
	type RevokePayloadRecipientUnchangedSuccess,
	RevokePayloadRecipientUpdateRequiredError,
} from "../../app/revoke-payload-recipient/RevokePayloadRecipientError.js";
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
import type { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import type {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import {
	promptForIdentityErrorAction,
	type ResolvedIdentityInput,
	resolveRevokeIdentityInput,
} from "../shared/identityInputFlow.js";
import {
	renderHandleCandidate,
	renderIdentityLabel,
} from "../shared/identityLabel.js";
import { makePassphraseSession } from "../shared/passphraseSession.js";
import {
	type PayloadMutationFlowStep,
	payloadMutationBack,
	payloadMutationCancel,
	payloadMutationDone,
	runResolvedPayloadMutationFlow,
} from "../shared/payloadMutationFlow.js";
import type { ResolveIdentityInputError } from "../shared/resolveIdentityInputError.js";
import {
	renderUpdateRequiredMessage,
	runPayloadUpdateGate,
} from "../shared/updateGate.js";

export type RevokeRecipientResult =
	| RevokePayloadRecipientRemovedSuccess
	| RevokePayloadRecipientUnchangedSuccess;

type RevokeRecipientFlowOutcome =
	| Extract<
			PayloadMutationFlowStep<never>,
			{ readonly _tag: "back" | "cancel" }
	  >
	| RevokeRecipientResult
	| undefined;

export type RevokePayloadFlowError =
	| GuidedFlowCancelledError
	| InspectPayloadCryptoError
	| InspectPayloadEnvError
	| InspectPayloadEnvelopeError
	| InspectPayloadFileFormatError
	| InspectPayloadPersistenceError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveIdentityInputError
	| RevokePayloadRecipientAmbiguousIdentityError
	| RevokePayloadRecipientCryptoError
	| RevokePayloadRecipientEnvError
	| RevokePayloadRecipientForbiddenSelfError
	| RevokePayloadRecipientPersistenceError
	| RevokePayloadRecipientUpdateRequiredError
	| ResolvePayloadTargetError
	| UpdatePayloadCryptoError
	| UpdatePayloadEnvError
	| UpdatePayloadEnvelopeError
	| UpdatePayloadFileFormatError
	| UpdatePayloadNoSelfIdentityError
	| UpdatePayloadPersistenceError;

export type RevokePayloadFlowContext =
	| InspectPayload
	| InteractivePrompt
	| Prompt
	| ResolvePayloadTarget
	| RevokePayloadRecipient
	| UpdatePayload;

const renderRecipient = (input: {
	readonly displayName: string;
	readonly handle: string;
	readonly isMe: boolean;
	readonly localAlias: Option.Option<string>;
}) =>
	renderIdentityLabel({
		displayName: input.displayName,
		handle: input.handle,
		isYou: input.isMe,
		localAlias: input.localAlias,
	});

const resolveIdentityRef = (input: {
	readonly identityRef: Option.Option<string>;
	readonly passphrase: string;
	readonly path: string;
}) =>
	Option.match(input.identityRef, {
		onNone: () =>
			Effect.gen(function* () {
				const inspection = yield* InspectPayload.execute({
					passphrase: input.passphrase,
					path: input.path,
				});

				return yield* resolveRevokeIdentityInput({
					choices: inspection.recipients.map((recipient) => ({
						...(recipient.isMe ? { disabled: true } : {}),
						title: renderRecipient(recipient),
						value: recipient.handle,
					})),
					identityRef: input.identityRef,
				});
			}),
		onSome: (value) =>
			Effect.succeed({
				identityRef: value,
				source: "explicit" as const,
			}),
	});

const ambiguousMessage = (input: {
	readonly identityRef: string;
	readonly candidates: ReadonlyArray<string>;
	readonly passphrase: string;
	readonly path: string;
}) =>
	InspectPayload.execute({
		passphrase: input.passphrase,
		path: input.path,
	}).pipe(
		Effect.map((inspection) =>
			[
				`Identity ref is ambiguous: ${input.identityRef}`,
				...input.candidates.map((handle) => {
					const recipient = inspection.recipients.find(
						(candidate) => candidate.handle === handle,
					);

					return recipient === undefined
						? handle
						: renderHandleCandidate({
								displayName: Option.some(recipient.displayName),
								handle: recipient.handle,
								isYou: recipient.isMe,
								localAlias: recipient.localAlias,
							});
				}),
				"",
			].join("\n"),
		),
		Effect.catchAll(() =>
			Effect.succeed(
				[
					`Identity ref is ambiguous: ${input.identityRef}`,
					...input.candidates,
					"",
				].join("\n"),
			),
		),
	);

export const runRevokePayloadFlow = (input: {
	readonly identityRef: Option.Option<string>;
	readonly path: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const isGuided =
			Option.isNone(input.path) || Option.isNone(input.identityRef);
		const getPassphrase = makePassphraseSession();

		const runRevokeAtPath: (
			resolvedPath: string,
		) => Effect.Effect<
			PayloadMutationFlowStep<void>,
			RevokePayloadFlowError,
			RevokePayloadFlowContext
		> = (resolvedPath) =>
			Effect.gen(function* () {
				const passphrase = yield* getPassphrase();
				const revokeRecipient = (
					resolvedIdentityRef: ResolvedIdentityInput,
				): Effect.Effect<
					RevokeRecipientFlowOutcome,
					RevokePayloadFlowError,
					RevokePayloadFlowContext
				> =>
					RevokePayloadRecipient.execute({
						identityRef: resolvedIdentityRef.identityRef,
						passphrase,
						path: resolvedPath,
					});
				const resolvedIdentityRef = yield* resolveIdentityRef({
					identityRef: input.identityRef,
					passphrase,
					path: resolvedPath,
				});
				const result = yield* revokeRecipient(resolvedIdentityRef).pipe(
					Effect.catchIf(
						(error): error is RevokePayloadRecipientUpdateRequiredError =>
							error instanceof RevokePayloadRecipientUpdateRequiredError,
						() =>
							Effect.gen(function* () {
								if (!isGuided) {
									return yield* new RevokePayloadRecipientUpdateRequiredError({
										message: renderUpdateRequiredMessage(
											"revoke",
											resolvedPath,
										),
										path: resolvedPath,
									});
								}

								const outcome = yield* runPayloadUpdateGate(
									UpdatePayload.execute({
										passphrase,
										path: resolvedPath,
									}),
								);

								switch (outcome) {
									case "updated":
										return yield* revokeRecipient(resolvedIdentityRef);
									case "back":
										return Option.isNone(input.identityRef)
											? payloadMutationBack("current-path")
											: payloadMutationBack("path");
									case "cancel":
										return payloadMutationCancel();
								}
							}),
					),
					Effect.catchIf(
						(error): error is RevokePayloadRecipientAmbiguousIdentityError =>
							error instanceof RevokePayloadRecipientAmbiguousIdentityError,
						(error) =>
							resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										const message = yield* ambiguousMessage({
											candidates: error.candidates,
											identityRef: error.identityRef,
											passphrase,
											path: resolvedPath,
										});
										yield* Prompt.writeStderr(message);
										const inspection = yield* InspectPayload.execute({
											passphrase,
											path: resolvedPath,
										});
										const action = yield* promptForIdentityErrorAction({
											candidates: inspection.recipients
												.filter((recipient) =>
													error.candidates.some(
														(candidate) => candidate === recipient.handle,
													),
												)
												.map((recipient) => ({
													title: renderRecipient(recipient),
													value: recipient.handle,
												})),
											kind: "ambiguous",
										});

										return action._tag === "candidate"
											? yield* revokeRecipient({
													identityRef: action.identityRef,
													source: "selected",
												})
											: yield* resolveIdentityRef({
													identityRef: Option.none(),
													passphrase,
													path: resolvedPath,
												}).pipe(Effect.flatMap(revokeRecipient));
									})
								: Effect.gen(function* () {
										const message = yield* ambiguousMessage({
											candidates: error.candidates,
											identityRef: error.identityRef,
											passphrase,
											path: resolvedPath,
										});
										yield* Prompt.writeStderr(message);
										return yield* error;
									}),
					),
					Effect.catchIf(
						(error): error is RevokePayloadRecipientForbiddenSelfError =>
							error instanceof RevokePayloadRecipientForbiddenSelfError,
						(error) =>
							resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										yield* Prompt.writeStderr(`${error.message}\n`);
										const action = yield* promptForIdentityErrorAction({
											kind: "self-forbidden",
										});

										return action._tag === "edit-input"
											? yield* resolveIdentityRef({
													identityRef: Option.none(),
													passphrase,
													path: resolvedPath,
												}).pipe(Effect.flatMap(revokeRecipient))
											: yield* Effect.fail(new GuidedFlowCancelledError());
									})
								: Effect.fail(error),
					),
				);

				if (result === undefined) {
					return payloadMutationDone(undefined);
				}

				if ("_tag" in result && result._tag === "back") {
					return result;
				}

				if ("_tag" in result && result._tag === "cancel") {
					return result;
				}

				const inspection = yield* InspectPayload.execute({
					passphrase,
					path: resolvedPath,
				});
				const summary = `recipients: ${inspection.recipientCount}\n`;

				switch (result._tag) {
					case "RevokePayloadRecipientRemovedSuccess":
						yield* Prompt.writeStdout(
							`revoked recipient from ${resolvedPath}\n${summary}`,
						);
						return payloadMutationDone(undefined);
					case "RevokePayloadRecipientUnchangedSuccess":
						yield* Prompt.writeStdout(
							`recipient not granted in ${resolvedPath}\n${summary}`,
						);
						return payloadMutationDone(undefined);
				}
			});

		return yield* runResolvedPayloadMutationFlow({
			path: input.path,
			runAtPath: runRevokeAtPath,
		});
	});
