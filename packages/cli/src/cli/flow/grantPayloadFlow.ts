import { Effect, Option } from "effect";
import { GrantPayloadRecipient } from "../../app/grant-payload-recipient/GrantPayloadRecipient.js";
import {
	type GrantPayloadRecipientAddedSuccess,
	GrantPayloadRecipientAmbiguousIdentityError,
	type GrantPayloadRecipientCryptoError,
	type GrantPayloadRecipientEnvError,
	GrantPayloadRecipientIdentityNotFoundError,
	type GrantPayloadRecipientPersistenceError,
	type GrantPayloadRecipientUnchangedSuccess,
	type GrantPayloadRecipientUpdatedSuccess,
	GrantPayloadRecipientUpdateRequiredError,
} from "../../app/grant-payload-recipient/GrantPayloadRecipientError.js";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import {
	type ImportIdentityStringConflictError,
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	type ImportIdentityStringPersistenceError,
} from "../../app/import-identity-string/ImportIdentityStringError.js";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import type {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
} from "../../app/inspect-payload/InspectPayloadError.js";
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
import type { HomeState } from "../../domain/home/HomeState.js";
import { decodeIdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { decodeIdentityString } from "../../domain/identity/IdentityString.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
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
	resolveGrantIdentityInput,
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

const identityStringPrefix = "better-age://identity/v1/";

export type GrantRecipientResult =
	| GrantPayloadRecipientAddedSuccess
	| GrantPayloadRecipientUpdatedSuccess
	| GrantPayloadRecipientUnchangedSuccess;

type GrantRecipientFlowOutcome =
	| GrantRecipientResult
	| Extract<
			PayloadMutationFlowStep<never>,
			{ readonly _tag: "back" | "cancel" }
	  >
	| undefined;

export type GrantPayloadFlowError =
	| GrantPayloadRecipientAmbiguousIdentityError
	| GrantPayloadRecipientCryptoError
	| GrantPayloadRecipientEnvError
	| GrantPayloadRecipientIdentityNotFoundError
	| GrantPayloadRecipientPersistenceError
	| GrantPayloadRecipientUpdateRequiredError
	| GuidedFlowCancelledError
	| HomeStateDecodeError
	| HomeStateLoadError
	| ImportIdentityStringConflictError
	| ImportIdentityStringDecodeError
	| ImportIdentityStringForbiddenSelfError
	| ImportIdentityStringPersistenceError
	| InspectPayloadCryptoError
	| InspectPayloadEnvError
	| InspectPayloadEnvelopeError
	| InspectPayloadFileFormatError
	| InspectPayloadPersistenceError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveIdentityInputError
	| ResolvePayloadTargetError
	| UpdatePayloadCryptoError
	| UpdatePayloadEnvelopeError
	| UpdatePayloadEnvError
	| UpdatePayloadFileFormatError
	| UpdatePayloadNoSelfIdentityError
	| UpdatePayloadPersistenceError;

export type GrantPayloadFlowContext =
	| GrantPayloadRecipient
	| HomeRepository
	| ImportIdentityString
	| InspectPayload
	| InteractivePrompt
	| Prompt
	| ResolvePayloadTarget
	| UpdatePayload;

const renderKnownIdentity = (input: {
	readonly displayName: string;
	readonly handle: string;
	readonly localAlias: Option.Option<string>;
}) =>
	renderIdentityLabel({
		displayName: input.displayName,
		handle: input.handle,
		isYou: false,
		localAlias: input.localAlias,
	});

const resolveIdentityRef = (identityRef: Option.Option<string>) =>
	Option.match(identityRef, {
		onNone: () =>
			Effect.gen(function* () {
				const state = yield* HomeRepository.loadState;

				return yield* resolveGrantIdentityInput({
					choices: state.knownIdentities.map((identity) => ({
						title: renderKnownIdentity(identity),
						value: identity.handle,
					})),
					identityRef,
				});
			}),
		onSome: (value) =>
			Effect.succeed({
				identityRef: value,
				source: "explicit" as const,
			}),
	});

const visibleLabel = (input: {
	readonly displayName: string;
	readonly localAlias: Option.Option<string>;
}) => Option.getOrElse(input.localAlias, () => input.displayName);

const collidingVisibleLabels = (input: {
	readonly ownerId: string;
	readonly state: HomeState;
}) =>
	new Set<string>([
		...(Option.isSome(input.state.self)
			? [input.state.self.value.displayName]
			: []),
		...input.state.knownIdentities
			.filter((identity) => identity.ownerId !== input.ownerId)
			.map((identity) =>
				visibleLabel({
					displayName: identity.displayName,
					localAlias: identity.localAlias,
				}),
			),
	]);

const promptForUniqueLocalAlias = (takenLabels: ReadonlySet<string>) =>
	Effect.gen(function* () {
		while (true) {
			const alias = yield* Prompt.inputText({
				message: "Local alias",
			});
			const decodedAlias = yield* decodeIdentityAlias(alias).pipe(
				Effect.either,
			);

			if (decodedAlias._tag === "Left" || takenLabels.has(decodedAlias.right)) {
				yield* Prompt.writeStderr("Invalid local alias\n");
				continue;
			}

			return Option.some(decodedAlias.right);
		}
	});

const localAliasOverrideForGrantImport = (input: {
	readonly identityRef: string;
	readonly isGuided: boolean;
	readonly source: ResolvedIdentityInput["source"];
}) =>
	Effect.gen(function* () {
		if (!(input.isGuided && input.source === "typed")) {
			return undefined;
		}

		const decoded = decodeIdentityString(input.identityRef);

		if (decoded._tag === "Left") {
			return undefined;
		}

		const state = yield* HomeRepository.loadState;
		const existingIdentity = state.knownIdentities.find(
			(identity) => identity.ownerId === decoded.right.ownerId,
		);

		if (
			existingIdentity !== undefined &&
			existingIdentity.identityUpdatedAt >= decoded.right.identityUpdatedAt
		) {
			return undefined;
		}

		if (
			existingIdentity !== undefined &&
			Option.isSome(existingIdentity.localAlias)
		) {
			return undefined;
		}

		const takenLabels = collidingVisibleLabels({
			ownerId: decoded.right.ownerId,
			state,
		});

		return takenLabels.has(decoded.right.displayName)
			? yield* promptForUniqueLocalAlias(takenLabels)
			: undefined;
	});

const ambiguousMessage = (input: {
	readonly identityRef: string;
	readonly candidates: ReadonlyArray<string>;
}) =>
	HomeRepository.loadState.pipe(
		Effect.map((state) =>
			[
				`Identity ref is ambiguous: ${input.identityRef}`,
				...input.candidates.map((handle) => {
					const knownIdentity = state.knownIdentities.find(
						(identity) => identity.handle === handle,
					);
					const isYou =
						state.self._tag === "Some" && state.self.value.handle === handle;

					return renderHandleCandidate({
						displayName:
							knownIdentity !== undefined
								? Option.some(knownIdentity.displayName)
								: isYou && state.self._tag === "Some"
									? Option.some(state.self.value.displayName)
									: Option.none(),
						handle,
						isYou,
						localAlias: knownIdentity?.localAlias ?? Option.none(),
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

export const runGrantPayloadFlow = (input: {
	readonly identityRef: Option.Option<string>;
	readonly path: Option.Option<string>;
}) => {
	const isGuided =
		Option.isNone(input.path) || Option.isNone(input.identityRef);
	const getPassphrase = makePassphraseSession();

	const runGrantAtPath: (
		resolvedPath: string,
	) => Effect.Effect<
		PayloadMutationFlowStep<void>,
		GrantPayloadFlowError,
		GrantPayloadFlowContext
	> = (resolvedPath) =>
		Effect.gen(function* () {
			const grantRecipient = (
				resolvedIdentityRef: ResolvedIdentityInput,
			): Effect.Effect<
				GrantRecipientFlowOutcome,
				GrantPayloadFlowError,
				GrantPayloadFlowContext
			> =>
				localAliasOverrideForGrantImport({
					identityRef: resolvedIdentityRef.identityRef,
					isGuided,
					source: resolvedIdentityRef.source,
				}).pipe(
					Effect.flatMap((localAlias) =>
						resolvedIdentityRef.identityRef.startsWith(identityStringPrefix)
							? ImportIdentityString.execute({
									identityString: resolvedIdentityRef.identityRef,
									...(localAlias === undefined ? {} : { localAlias }),
								}).pipe(Effect.asVoid)
							: Effect.void,
					),
					Effect.flatMap(() =>
						getPassphrase().pipe(
							Effect.flatMap((passphrase) =>
								GrantPayloadRecipient.execute({
									identityRef: resolvedIdentityRef.identityRef,
									passphrase,
									path: resolvedPath,
								}),
							),
						),
					),
					Effect.catchIf(
						(error): error is ImportIdentityStringDecodeError =>
							error instanceof ImportIdentityStringDecodeError,
						(error) =>
							isGuided && resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										yield* Prompt.writeStderr(`${error.message}\n`);
										const action = yield* promptForIdentityErrorAction({
											kind: "invalid-identity-string",
										});

										return action._tag === "edit-input"
											? yield* resolveIdentityRef(Option.none()).pipe(
													Effect.flatMap(grantRecipient),
												)
											: yield* Effect.fail(new GuidedFlowCancelledError());
									})
								: Effect.fail(error),
					),
					Effect.catchIf(
						(error): error is ImportIdentityStringForbiddenSelfError =>
							error instanceof ImportIdentityStringForbiddenSelfError,
						(error) =>
							isGuided && resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										yield* Prompt.writeStderr(
											"Cannot grant your own identity string\n",
										);
										const action = yield* promptForIdentityErrorAction({
											kind: "self-forbidden",
										});

										return action._tag === "edit-input"
											? yield* resolveIdentityRef(Option.none()).pipe(
													Effect.flatMap(grantRecipient),
												)
											: yield* Effect.fail(new GuidedFlowCancelledError());
									})
								: Effect.fail(error),
					),
					Effect.catchIf(
						(error): error is GrantPayloadRecipientUpdateRequiredError =>
							error instanceof GrantPayloadRecipientUpdateRequiredError,
						() =>
							Effect.gen(function* () {
								if (!isGuided) {
									return yield* new GrantPayloadRecipientUpdateRequiredError({
										message: renderUpdateRequiredMessage("grant", resolvedPath),
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
										return yield* grantRecipient(resolvedIdentityRef);
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
						(error): error is GrantPayloadRecipientAmbiguousIdentityError =>
							error instanceof GrantPayloadRecipientAmbiguousIdentityError,
						(error) =>
							isGuided && resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										const message = yield* ambiguousMessage({
											candidates: error.candidates,
											identityRef: error.identityRef,
										});
										yield* Prompt.writeStderr(message);
										const state = yield* HomeRepository.loadState;
										const action = yield* promptForIdentityErrorAction({
											candidates: error.candidates.map((handle) => {
												const knownIdentity = state.knownIdentities.find(
													(identity) => identity.handle === handle,
												);
												const isYou =
													state.self._tag === "Some" &&
													state.self.value.handle === handle;

												return {
													title: renderHandleCandidate({
														displayName:
															knownIdentity !== undefined
																? Option.some(knownIdentity.displayName)
																: isYou && state.self._tag === "Some"
																	? Option.some(state.self.value.displayName)
																	: Option.none(),
														handle,
														isYou,
														localAlias:
															knownIdentity?.localAlias ?? Option.none(),
													}),
													value: handle,
												};
											}),
											kind: "ambiguous",
										});

										return action._tag === "candidate"
											? yield* grantRecipient({
													identityRef: action.identityRef,
													source: "selected",
												})
											: yield* resolveIdentityRef(Option.none()).pipe(
													Effect.flatMap(grantRecipient),
												);
									})
								: Effect.gen(function* () {
										const message = yield* ambiguousMessage({
											candidates: error.candidates,
											identityRef: error.identityRef,
										});
										yield* Prompt.writeStderr(message);
										return yield* error;
									}),
					),
					Effect.catchIf(
						(error): error is GrantPayloadRecipientIdentityNotFoundError =>
							error instanceof GrantPayloadRecipientIdentityNotFoundError,
						(error) =>
							isGuided && resolvedIdentityRef.source === "typed"
								? Effect.gen(function* () {
										yield* Prompt.writeStderr(`${error.message}\n`);
										const action = yield* promptForIdentityErrorAction({
											kind: "not-found",
										});

										return action._tag === "edit-input"
											? yield* resolveIdentityRef(Option.none()).pipe(
													Effect.flatMap(grantRecipient),
												)
											: yield* Effect.fail(new GuidedFlowCancelledError());
									})
								: Effect.fail(error),
					),
				);

			const resolvedIdentityRef = yield* resolveIdentityRef(input.identityRef);
			const result = yield* grantRecipient(resolvedIdentityRef);

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
				passphrase: yield* getPassphrase(),
				path: resolvedPath,
			});
			const summary = `recipients: ${inspection.recipientCount}\n`;

			switch (result._tag) {
				case "GrantPayloadRecipientAddedSuccess":
					yield* Prompt.writeStdout(
						`granted ${result.handle} in ${resolvedPath}\n${summary}`,
					);
					return payloadMutationDone(undefined);
				case "GrantPayloadRecipientUpdatedSuccess":
					yield* Prompt.writeStdout(
						`updated recipient ${result.handle} in ${resolvedPath}\n${summary}`,
					);
					return payloadMutationDone(undefined);
				case "GrantPayloadRecipientUnchangedSuccess":
					yield* Prompt.writeStdout(
						result.reason === "already-granted"
							? `recipient already granted: ${result.handle}\n${summary}`
							: `provided identity is outdated; recipient already has newer access: ${result.handle}\n${summary}`,
					);
					return payloadMutationDone(undefined);
			}
		});

	return runResolvedPayloadMutationFlow({
		path: input.path,
		runAtPath: runGrantAtPath,
	});
};
