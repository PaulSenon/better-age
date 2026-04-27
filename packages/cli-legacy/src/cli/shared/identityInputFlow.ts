import { Effect, Option } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import type { PromptUnavailableError } from "../../port/PromptError.js";
import { PromptUnavailableError as PromptUnavailableTaggedError } from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { ResolveIdentityInputError } from "./resolveIdentityInputError.js";

const enterRefValue = "__better_secrets_enter_ref__";
const backValue = "__better_secrets_back__";
const cancelValue = "__better_secrets_cancel__";
const chooseCandidateValue = "__better_secrets_choose_candidate__";
const editInputValue = "__better_secrets_edit_input__";

const renderMissingIdentityRefMessage = () =>
	["Missing required identity ref", "Pass an identity ref explicitly"].join(
		"\n",
	);

type IdentityChoice = {
	readonly disabled?: boolean;
	readonly title: string;
	readonly value: string;
};

export type ResolvedIdentityInput = {
	readonly identityRef: string;
	readonly source: "explicit" | "selected" | "typed";
};

export type IdentityErrorAction =
	| { readonly _tag: "candidate"; readonly identityRef: string }
	| { readonly _tag: "edit-input" };

const promptForEnteredValue = (message: string) =>
	Prompt.inputText({ message }).pipe(
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableTaggedError,
			() =>
				Effect.fail(
					new ResolveIdentityInputError({
						message: renderMissingIdentityRefMessage(),
					}),
				),
		),
	);

const selectChoice = (input: {
	readonly choices: ReadonlyArray<IdentityChoice>;
	readonly message: string;
}) =>
	InteractivePrompt.pipe(
		Effect.flatMap((interactivePrompt) =>
			interactivePrompt.select({
				choices: input.choices,
				message: input.message,
			}),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableTaggedError,
			() =>
				Effect.fail(
					new ResolveIdentityInputError({
						message: renderMissingIdentityRefMessage(),
					}),
				),
		),
	);

const resolveFromMenu = (input: {
	readonly choices: ReadonlyArray<IdentityChoice>;
	readonly message: string;
	readonly promptMessage: string;
	readonly supportsTypedEntry: boolean;
	readonly typedEntryTitle?: string;
}) =>
	Effect.gen(function* () {
		const selection = yield* selectChoice({
			choices: [
				...input.choices,
				...(input.supportsTypedEntry
					? [
							{
								title: input.typedEntryTitle ?? "Enter ref",
								value: enterRefValue,
							} satisfies IdentityChoice,
						]
					: []),
				{ title: "Back", value: backValue },
				{ title: "Cancel", value: cancelValue },
			],
			message: input.message,
		});

		switch (selection) {
			case enterRefValue:
				return {
					identityRef: yield* promptForEnteredValue(input.promptMessage),
					source: "typed" as const,
				};
			case backValue:
			case cancelValue:
				return yield* Effect.fail(new GuidedFlowCancelledError());
			default:
				return {
					identityRef: selection,
					source: "selected" as const,
				};
		}
	});

export const resolveGrantIdentityInput = (input: {
	readonly identityRef: Option.Option<string>;
	readonly choices: ReadonlyArray<IdentityChoice>;
}) =>
	Option.match(input.identityRef, {
		onNone: () =>
			resolveFromMenu({
				choices: input.choices,
				message: "Choose identity",
				promptMessage: "Identity",
				supportsTypedEntry: true,
				typedEntryTitle: "Enter identity",
			}),
		onSome: (identityRef) =>
			Effect.succeed({
				identityRef,
				source: "explicit" as const,
			}),
	});

export const resolveRevokeIdentityInput = (input: {
	readonly identityRef: Option.Option<string>;
	readonly choices: ReadonlyArray<IdentityChoice>;
}) =>
	Option.match(input.identityRef, {
		onNone: () =>
			resolveFromMenu({
				choices: input.choices,
				message: "Choose recipient",
				promptMessage: "Identity ref",
				supportsTypedEntry: true,
				typedEntryTitle: "Enter ref",
			}),
		onSome: (identityRef) =>
			Effect.succeed({
				identityRef,
				source: "explicit" as const,
			}),
	});

export const resolveForgetIdentityInput = (input: {
	readonly identityRef: Option.Option<string>;
	readonly choices: ReadonlyArray<IdentityChoice>;
}) =>
	Option.match(input.identityRef, {
		onNone: () =>
			resolveFromMenu({
				choices: input.choices,
				message: "Forget identity",
				promptMessage: "Identity ref",
				supportsTypedEntry: true,
				typedEntryTitle: "Enter ref",
			}),
		onSome: (identityRef) =>
			Effect.succeed({
				identityRef,
				source: "explicit" as const,
			}),
	});

export const resolveIdentityStringInput = (
	identityString: Option.Option<string>,
) =>
	Option.match(identityString, {
		onNone: () =>
			promptForEnteredValue("Identity string").pipe(
				Effect.map((value) => ({
					identityRef: value,
					source: "typed" as const,
				})),
			),
		onSome: (value) =>
			Effect.succeed({
				identityRef: value,
				source: "explicit" as const,
			}),
	});

export const promptForIdentityErrorAction = (input: {
	readonly candidates?: ReadonlyArray<IdentityChoice>;
	readonly kind:
		| "ambiguous"
		| "invalid-identity-string"
		| "not-found"
		| "self-forbidden";
}) =>
	Effect.gen(function* () {
		const selection = yield* InteractivePrompt.pipe(
			Effect.flatMap((interactivePrompt) =>
				interactivePrompt.select({
					choices: [
						...(input.kind === "ambiguous"
							? [
									{
										title: "Choose candidate",
										value: chooseCandidateValue,
									} satisfies IdentityChoice,
								]
							: []),
						{ title: "Edit input", value: editInputValue },
						{ title: "Back", value: backValue },
						{ title: "Cancel", value: cancelValue },
					],
					message:
						input.kind === "ambiguous"
							? "Identity ref is ambiguous"
							: "Identity input error",
				}),
			),
		);

		switch (selection) {
			case chooseCandidateValue: {
				const candidates = input.candidates ?? [];
				const chosenCandidate = yield* InteractivePrompt.pipe(
					Effect.flatMap((interactivePrompt) =>
						interactivePrompt.select({
							choices: candidates,
							message: "Choose candidate",
						}),
					),
				);

				return {
					_tag: "candidate" as const,
					identityRef: chosenCandidate,
				};
			}
			case editInputValue:
				return { _tag: "edit-input" as const };
			case backValue:
			case cancelValue:
				return yield* Effect.fail(new GuidedFlowCancelledError());
			default:
				return yield* Effect.dieMessage(
					`Unexpected identity error action: ${selection}`,
				);
		}
	});
