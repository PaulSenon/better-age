import { Args, Command } from "@effect/cli";
import { Effect, Option } from "effect";
import { ForgetIdentity } from "../../app/forget-identity/ForgetIdentity.js";
import {
	ForgetIdentityAmbiguousIdentityError,
	ForgetIdentityForbiddenSelfError,
	ForgetIdentityPersistenceError,
	type ForgetIdentityRemovedSuccess,
	type ForgetIdentityUnchangedSuccess,
} from "../../app/forget-identity/ForgetIdentityError.js";
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
import { CliCommandFailedError } from "../shared/commandFailure.js";
import {
	promptForIdentityErrorAction,
	type ResolvedIdentityInput,
	resolveForgetIdentityInput,
} from "../shared/identityInputFlow.js";
import {
	renderHandleCandidate,
	renderIdentityLabel,
} from "../shared/identityLabel.js";
import type { ResolveIdentityInputError } from "../shared/resolveIdentityInputError.js";

export class ForgetIdentityCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "forget-identity",
			name: "ForgetIdentityCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const identityRefArg = Args.text({ name: "identity-ref" });
const optionalIdentityRefArg = identityRefArg.pipe(Args.optional);

type ForgetIdentityResult =
	| ForgetIdentityRemovedSuccess
	| ForgetIdentityUnchangedSuccess;

type ForgetIdentityFlowError =
	| ForgetIdentityAmbiguousIdentityError
	| ForgetIdentityForbiddenSelfError
	| ForgetIdentityPersistenceError
	| GuidedFlowCancelledError
	| HomeStateDecodeError
	| HomeStateLoadError
	| PromptReadAbortedError
	| PromptUnavailableError
	| ResolveIdentityInputError;

type ForgetIdentityFlowContext =
	| ForgetIdentity
	| HomeRepository
	| InteractivePrompt
	| Prompt;

const resolveIdentityRef = (identityRef: Option.Option<string>) =>
	Option.match(identityRef, {
		onNone: () =>
			Effect.gen(function* () {
				const state = yield* HomeRepository.loadState;

				return yield* resolveForgetIdentityInput({
					choices: state.knownIdentities.map((identity) => ({
						title: renderIdentityLabel({
							displayName: identity.displayName,
							handle: identity.handle,
							isYou: false,
							localAlias: identity.localAlias,
						}),
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

const renderCandidateChoices = (input: {
	readonly candidates: ReadonlyArray<string>;
}) =>
	Effect.gen(function* () {
		const state = yield* HomeRepository.loadState.pipe(
			Effect.catchAll(() => Effect.succeed(null)),
		);

		return input.candidates.map((handle) => {
			if (state === null) {
				return { title: handle, value: handle };
			}

			const knownIdentity = state.knownIdentities.find(
				(identity) => identity.handle === handle,
			);
			const isYou =
				state.self._tag === "Some" && state.self.value.handle === handle;

			return {
				title: renderHandleCandidate({
					displayName:
						knownIdentity !== undefined
							? Option.some(knownIdentity.displayName)
							: state.self._tag === "Some" && state.self.value.handle === handle
								? Option.some(state.self.value.displayName)
								: Option.none(),
					handle,
					isYou,
					localAlias: knownIdentity?.localAlias ?? Option.none(),
				}),
				value: handle,
			};
		});
	});

const forgetIdentityWithRecovery = (input: {
	readonly identityRef: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const execute = (
			resolvedIdentityRef: ResolvedIdentityInput,
		): Effect.Effect<
			ForgetIdentityResult,
			ForgetIdentityFlowError,
			ForgetIdentityFlowContext
		> =>
			ForgetIdentity.execute({
				identityRef: resolvedIdentityRef.identityRef,
			}).pipe(
				Effect.catchIf(
					(error): error is ForgetIdentityAmbiguousIdentityError =>
						error instanceof ForgetIdentityAmbiguousIdentityError,
					(error) =>
						resolvedIdentityRef.source === "typed"
							? Effect.gen(function* () {
									const message = yield* renderAmbiguousMessage({
										candidates: error.candidates,
										identityRef: error.identityRef,
									});
									yield* Prompt.writeStderr(message);
									const action = yield* promptForIdentityErrorAction({
										candidates: yield* renderCandidateChoices({
											candidates: error.candidates,
										}),
										kind: "ambiguous",
									});

									return action._tag === "candidate"
										? yield* execute({
												identityRef: action.identityRef,
												source: "selected",
											})
										: yield* resolveIdentityRef(Option.none()).pipe(
												Effect.flatMap(execute),
											);
								})
							: Effect.fail(error),
				),
				Effect.catchIf(
					(error): error is ForgetIdentityForbiddenSelfError =>
						error instanceof ForgetIdentityForbiddenSelfError,
					(error) =>
						resolvedIdentityRef.source === "typed"
							? Effect.gen(function* () {
									yield* Prompt.writeStderr(`${error.message}\n`);
									const action = yield* promptForIdentityErrorAction({
										kind: "self-forbidden",
									});

									return action._tag === "edit-input"
										? yield* resolveIdentityRef(Option.none()).pipe(
												Effect.flatMap(execute),
											)
										: yield* Effect.fail(new GuidedFlowCancelledError());
								})
							: Effect.fail(error),
				),
			);

		return yield* resolveIdentityRef(input.identityRef).pipe(
			Effect.flatMap(execute),
		);
	});

const renderAmbiguousMessage = (input: {
	readonly candidates: ReadonlyArray<string>;
	readonly identityRef: string;
}) =>
	Effect.gen(function* () {
		const state = yield* HomeRepository.loadState.pipe(
			Effect.catchAll(() => Effect.succeed(null)),
		);
		const lines = input.candidates.map((handle) => {
			if (state === null) {
				return handle;
			}

			const knownIdentity = state.knownIdentities.find(
				(identity) => identity.handle === handle,
			);
			const isYou =
				state.self._tag === "Some" && state.self.value.handle === handle;

			return renderHandleCandidate({
				displayName:
					knownIdentity !== undefined
						? Option.some(knownIdentity.displayName)
						: state.self._tag === "Some" && state.self.value.handle === handle
							? Option.some(state.self.value.displayName)
							: Option.none(),
				handle,
				isYou,
				localAlias: knownIdentity?.localAlias ?? Option.none(),
			});
		});

		return [
			`Identity ref is ambiguous: ${input.identityRef}`,
			...lines,
			"",
		].join("\n");
	});

export const forgetIdentityCommand = Command.make(
	"forget-identity",
	{
		identityRef: optionalIdentityRefArg,
	},
	({ identityRef }) =>
		Effect.gen(function* () {
			const result = yield* forgetIdentityWithRecovery({
				identityRef,
			});

			switch (result._tag) {
				case "ForgetIdentityRemovedSuccess":
					yield* Prompt.writeStdout(`forgot local identity ${result.handle}\n`);
					return;
				case "ForgetIdentityUnchangedSuccess":
					yield* Prompt.writeStdout(
						`identity not known locally: ${result.identityRef}\n`,
					);
			}
		}).pipe(
			Effect.catchIf(
				(error): error is ForgetIdentityAmbiguousIdentityError =>
					error instanceof ForgetIdentityAmbiguousIdentityError,
				(error) =>
					Effect.gen(function* () {
						const message = yield* renderAmbiguousMessage({
							candidates: error.candidates,
							identityRef: error.identityRef,
						});
						yield* Prompt.writeStderr(message);
						return yield* Effect.fail(new ForgetIdentityCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is ForgetIdentityForbiddenSelfError =>
					error instanceof ForgetIdentityForbiddenSelfError,
				(error) =>
					Effect.gen(function* () {
						yield* Prompt.writeStderr(`${error.message}\n`);
						return yield* Effect.fail(new ForgetIdentityCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is ForgetIdentityPersistenceError =>
					error instanceof ForgetIdentityPersistenceError,
				(error) =>
					Effect.gen(function* () {
						yield* Prompt.writeStderr(`${error.message}\n`);
						return yield* Effect.fail(new ForgetIdentityCommandFailedError());
					}),
			),
			Effect.catchIf(
				(error): error is GuidedFlowCancelledError =>
					error instanceof GuidedFlowCancelledError,
				() => Effect.void,
			),
		),
);
