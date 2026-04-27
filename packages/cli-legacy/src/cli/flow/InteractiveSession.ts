import { Effect, Option } from "effect";
import { ForgetIdentity } from "../../app/forget-identity/ForgetIdentity.js";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import { ViewPayload } from "../../app/view-payload/ViewPayload.js";
import { materializeKnownIdentities } from "../../domain/identity/Identity.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { runChangePassphrase as runChangePassphraseCommand } from "../command/changePassphraseCommand.js";
import { runCreatePayload } from "../command/createPayloadCommand.js";
import { runEditPayload } from "../command/editPayloadCommand.js";
import { runGrantPayload } from "../command/grantPayloadCommand.js";
import { runIdentities } from "../command/identitiesCommand.js";
import { runInspectPayload } from "../command/inspectPayloadCommand.js";
import { runMe } from "../command/meCommand.js";
import { runRevokePayload } from "../command/revokePayloadCommand.js";
import { runRotateUserIdentity as runRotateUserIdentityCommand } from "../command/rotateUserIdentity.js";
import { runUpdatePayload } from "../command/updatePayloadCommand.js";
import { runSetupGate } from "../shared/setupFlow.js";

type RootAction = "files" | "identity" | "quit";
type FilesAction =
	| "back"
	| "create"
	| "edit"
	| "grant"
	| "inspect"
	| "revoke"
	| "update"
	| "view";
type IdentityAction =
	| "back"
	| "change-passphrase"
	| "forget"
	| "import"
	| "rotate"
	| "share"
	| "show";

const topLevelChoices = [
	{ title: "Files", value: "files" },
	{ title: "My identity", value: "identity" },
	{ title: "Quit", value: "quit" },
] as const;

const fileChoices = [
	{ title: "Create payload", value: "create" },
	{ title: "Inspect payload", value: "inspect" },
	{ title: "View secrets", value: "view" },
	{ title: "Edit secrets", value: "edit" },
	{ title: "Grant access", value: "grant" },
	{ title: "Revoke access", value: "revoke" },
	{ title: "Update payload", value: "update" },
	{ title: "Back", value: "back" },
] as const;

const identityChoices = [
	{ title: "Show identity", value: "show" },
	{ title: "Share identity string", value: "share" },
	{ title: "Import identity", value: "import" },
	{ title: "Forget known identity", value: "forget" },
	{ title: "Rotate identity", value: "rotate" },
	{ title: "Change passphrase", value: "change-passphrase" },
	{ title: "Back", value: "back" },
] as const;

const renderKnownIdentityLabel = (input: {
	readonly displayName: string;
	readonly handle: string;
	readonly localAlias: Option.Option<string>;
}) => {
	const prefix = Option.match(input.localAlias, {
		onNone: () => "",
		onSome: (localAlias) => `${localAlias}: `,
	});

	return `${prefix}${input.displayName} (${input.handle})`;
};

export class InteractiveSession extends Effect.Service<InteractiveSession>()(
	"InteractiveSession",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const homeRepository = yield* HomeRepository;
			const interactivePrompt = yield* InteractivePrompt;
			const prompt = yield* Prompt;
			const importIdentityString = yield* ImportIdentityString;
			const forgetIdentity = yield* ForgetIdentity;
			const viewPayload = yield* ViewPayload;

			const runIdentityAction = Effect.fn(
				"InteractiveSession.runIdentityAction",
			)(
				<A, E extends { readonly message: string }, R>(
					effect: Effect.Effect<A, E, R>,
				) =>
					effect.pipe(
						Effect.catchAll((error) =>
							error instanceof PromptReadAbortedError
								? Effect.void
								: prompt.writeStderr(`${error.message}\n`).pipe(Effect.asVoid),
						),
					),
			);

			const runCommandIdentityAction = Effect.fn(
				"InteractiveSession.runCommandIdentityAction",
			)(<A, E, R>(effect: Effect.Effect<A, E, R>) =>
				effect.pipe(Effect.catchAll(() => Effect.void)),
			);

			const acknowledgeText = Effect.fn("InteractiveSession.acknowledgeText")(
				function* () {
					yield* interactivePrompt.select({
						choices: [{ title: "Continue", value: "continue" as const }],
						message: "Press Enter to continue",
					});
				},
			);

			const runReadIdentityAction = Effect.fn(
				"InteractiveSession.runReadIdentityAction",
			)(<E extends Error, R>(effect: Effect.Effect<void, E, R>) =>
				effect.pipe(
					Effect.either,
					Effect.flatMap((result) =>
						result._tag === "Left" ? Effect.void : acknowledgeText(),
					),
					Effect.catchAll((error) =>
						error instanceof PromptReadAbortedError
							? Effect.void
							: error instanceof PromptUnavailableError
								? prompt.writeStderr(`${error.message}\n`)
								: Effect.die(error),
					),
				),
			);

			const runImportIdentity = Effect.fn(
				"InteractiveSession.runImportIdentity",
			)(function* () {
				const identityString = yield* prompt.inputText({
					message: "Identity string",
				});
				const result = yield* importIdentityString.execute({
					identityString,
				});

				yield* prompt.writeStdout(
					`${result.outcome} ${result.displayName} (${result.handle})\n`,
				);
			});

			const runForgetIdentity = Effect.fn(
				"InteractiveSession.runForgetIdentity",
			)(function* () {
				const state = yield* homeRepository.loadState;

				if (state.knownIdentities.length === 0) {
					yield* prompt.writeStdout("No known identities\n");
					return;
				}

				const knownIdentities = materializeKnownIdentities({
					identities: state.knownIdentities,
					localAliases: state.localAliases,
				});
				const identityRef = yield* interactivePrompt.select<string>({
					choices: knownIdentities.map((identity) => ({
						title: renderKnownIdentityLabel({
							displayName: identity.displayName,
							handle: identity.handle,
							localAlias: identity.localAlias,
						}),
						value: identity.handle,
					})),
					message: "Forget identity",
				});
				const result = yield* forgetIdentity.execute({
					identityRef,
				});

				switch (result._tag) {
					case "ForgetIdentityRemovedSuccess":
						yield* prompt.writeStdout(
							`forgot local identity ${result.handle}\n`,
						);
						return;
					case "ForgetIdentityUnchangedSuccess":
						yield* prompt.writeStdout(
							`identity not known locally: ${identityRef}\n`,
						);
				}
			});

			const runRotateIdentity = Effect.fn(
				"InteractiveSession.runRotateIdentity",
			)(() => runRotateUserIdentityCommand());

			const runChangePassphrase = Effect.fn(
				"InteractiveSession.runChangePassphrase",
			)(() => runChangePassphraseCommand());

			const runFilesScope = Effect.fn("InteractiveSession.runFilesScope")(
				function* () {
					const runFileAction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
						effect.pipe(Effect.catchAll(() => Effect.void));

					while (true) {
						const action = yield* interactivePrompt.select<FilesAction>({
							choices: fileChoices,
							message: "Files",
						});

						switch (action) {
							case "create":
								yield* runFileAction(
									runCreatePayload({
										path: Option.none(),
									}),
								);
								break;
							case "inspect":
								yield* runInspectPayload({
									path: Option.none(),
								}).pipe(
									Effect.flatMap((result) =>
										result === "completed" ? acknowledgeText() : Effect.void,
									),
									Effect.catchAll(() => Effect.void),
								);
								break;
							case "view":
								yield* runFileAction(
									viewPayload.execute({
										path: Option.none(),
									}),
								);
								break;
							case "edit":
								yield* runFileAction(
									runEditPayload({
										path: Option.none(),
									}),
								);
								break;
							case "grant":
								yield* runFileAction(
									runGrantPayload({
										identityRef: Option.none(),
										path: Option.none(),
									}),
								);
								break;
							case "revoke":
								yield* runFileAction(
									runRevokePayload({
										identityRef: Option.none(),
										path: Option.none(),
									}),
								);
								break;
							case "update":
								yield* runFileAction(
									runUpdatePayload({
										path: Option.none(),
									}),
								);
								break;
							case "back":
								return;
						}
					}
				},
			);

			const runIdentityScope = Effect.fn("InteractiveSession.runIdentityScope")(
				function* () {
					while (true) {
						const action = yield* interactivePrompt.select<IdentityAction>({
							choices: identityChoices,
							message: "My identity",
						});

						switch (action) {
							case "show":
								yield* runReadIdentityAction(runIdentities());
								break;
							case "share":
								yield* runReadIdentityAction(runMe());
								break;
							case "import":
								yield* runIdentityAction(runImportIdentity());
								break;
							case "forget":
								yield* runIdentityAction(runForgetIdentity());
								break;
							case "rotate":
								yield* runCommandIdentityAction(runRotateIdentity());
								break;
							case "change-passphrase":
								yield* runCommandIdentityAction(runChangePassphrase());
								break;
							case "back":
								return;
						}
					}
				},
			);

			const runRootLoop = Effect.fn("InteractiveSession.runRootLoop")(
				function* () {
					while (true) {
						const action = yield* interactivePrompt.select<RootAction>({
							choices: topLevelChoices,
							message: "Better Secrets",
						});

						switch (action) {
							case "files":
								yield* runFilesScope();
								break;
							case "identity":
								yield* runIdentityScope();
								break;
							case "quit":
								return;
						}
					}
				},
			);

			const run = Effect.fn("InteractiveSession.run")(function* () {
				const state = yield* homeRepository.loadState;

				if (Option.isNone(state.self)) {
					const setupResult = yield* runSetupGate().pipe(Effect.either);

					if (setupResult._tag === "Left") {
						return;
					}

					return yield* runRootLoop();
				}

				return yield* runRootLoop();
			});

			return { run };
		}),
	},
) {}
