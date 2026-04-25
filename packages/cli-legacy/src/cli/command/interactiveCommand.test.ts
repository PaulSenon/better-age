import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { ChangePassphrase } from "../../app/change-passphrase/ChangePassphrase.js";
import { ChangePassphraseSuccess } from "../../app/change-passphrase/ChangePassphraseError.js";
import { CreatePayload } from "../../app/create-payload/CreatePayload.js";
import { CreatePayloadSuccess } from "../../app/create-payload/CreatePayloadError.js";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import { CreateUserIdentitySuccess } from "../../app/create-user-identity/CreateUserIdentityError.js";
import { EditPayload } from "../../app/edit-payload/EditPayload.js";
import { ExportIdentityString } from "../../app/export-identity-string/ExportIdentityString.js";
import { ForgetIdentity } from "../../app/forget-identity/ForgetIdentity.js";
import { ForgetIdentityRemovedSuccess } from "../../app/forget-identity/ForgetIdentityError.js";
import { GrantPayloadRecipient } from "../../app/grant-payload-recipient/GrantPayloadRecipient.js";
import { ImportIdentityString } from "../../app/import-identity-string/ImportIdentityString.js";
import { ImportIdentityStringSuccess } from "../../app/import-identity-string/ImportIdentityStringError.js";
import { InspectHomeIdentities } from "../../app/inspect-home-identities/InspectHomeIdentities.js";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import { InspectPayloadSuccess } from "../../app/inspect-payload/InspectPayloadError.js";
import { RevokePayloadRecipient } from "../../app/revoke-payload-recipient/RevokePayloadRecipient.js";
import { RotateUserIdentity } from "../../app/rotate-user-identity/RotateUserIdentity.js";
import { RotateUserIdentitySuccess } from "../../app/rotate-user-identity/RotateUserIdentityError.js";
import { ResolveEditorCommand } from "../../app/shared/ResolveEditorCommand.js";
import { ResolveNewPayloadTarget } from "../../app/shared/ResolveNewPayloadTarget.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { UpdatePayload } from "../../app/update-payload/UpdatePayload.js";
import { UpdatePayloadUpdatedSuccess } from "../../app/update-payload/UpdatePayloadError.js";
import { ViewPayload } from "../../app/view-payload/ViewPayload.js";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { Editor } from "../../port/Editor.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import type { InteractiveChoice } from "../../port/InteractivePrompt.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { PathAccess } from "../../port/PathAccess.js";
import { Prompt } from "../../port/Prompt.js";
import { TempFile } from "../../port/TempFile.js";
import { InteractiveSession } from "../flow/InteractiveSession.js";
import { interactiveCommand } from "./interactiveCommand.js";

const makePrompt = (input?: {
	readonly inputSecretAnswers?: ReadonlyArray<string>;
	readonly inputTextAnswers?: ReadonlyArray<string>;
}) => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];
	const inputSecretCalls: Array<{ message: string }> = [];
	const inputTextCalls: Array<{ defaultValue?: string; message: string }> = [];
	let inputSecretIndex = 0;
	let inputTextIndex = 0;

	return Object.assign(
		Prompt.make({
			inputSecret: (promptInput) =>
				Effect.sync(() => {
					inputSecretCalls.push(promptInput);
					const answer = input?.inputSecretAnswers?.[inputSecretIndex];

					if (answer === undefined) {
						throw new Error(
							`Missing test answer for secret prompt: ${promptInput.message}`,
						);
					}

					inputSecretIndex += 1;
					return answer;
				}),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: (promptInput) =>
				Effect.sync(() => {
					inputTextCalls.push(promptInput);
					const answer = input?.inputTextAnswers?.[inputTextIndex];

					if (answer === undefined) {
						throw new Error(
							`Missing test answer for text prompt: ${promptInput.message}`,
						);
					}

					inputTextIndex += 1;
					return answer;
				}),
			writeStderr: (text) =>
				Effect.sync(() => {
					stderr.push(text);
				}),
			writeStdout: (text) =>
				Effect.sync(() => {
					stdout.push(text);
				}),
		}),
		{ inputSecretCalls, inputTextCalls, stderr, stdout },
	);
};

const knownPaulDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const knownPaulHandle = Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa");
const rotatedFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_3333333333333333",
);
const currentFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_1111111111111111",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");

const makeInteractivePrompt = (answers: ReadonlyArray<string>) => {
	const calls: Array<{
		choices: ReadonlyArray<{ disabled?: boolean; title: string }>;
		message: string;
	}> = [];
	let index = 0;

	return Object.assign(
		InteractivePrompt.make({
			select: <A>(input: {
				readonly choices: ReadonlyArray<InteractiveChoice<A>>;
				readonly maxPerPage?: number;
				readonly message: string;
			}) =>
				Effect.sync(() => {
					calls.push({
						choices: input.choices.map((choice) =>
							choice.disabled === undefined
								? { title: choice.title }
								: {
										disabled: choice.disabled,
										title: choice.title,
									},
						),
						message: input.message,
					});

					const answer = answers[index];

					if (answer === undefined) {
						throw new Error(
							`Missing test answer for select prompt: ${input.message}`,
						);
					}

					index += 1;
					return answer as A;
				}),
		}),
		{ calls },
	);
};

const makeConfiguredHomeRepository = () =>
	HomeRepository.make({
		deletePrivateKey: (_privateKeyPath) => Effect.void,
		getActiveKey: Effect.die("unused"),
		getLocation: Effect.succeed({
			keysDirectory: "/tmp/keys",
			rootDirectory: "/tmp/home",
			stateFile: "/tmp/home/state.json",
		}),
		loadState: Effect.succeed({
			...emptyHomeState(),
			knownIdentities: [
				{
					displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
					identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
						"2026-04-14T10:00:00.000Z",
					),
					ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
					publicKey: Schema.decodeUnknownSync(PublicKey)("age1paul"),
				},
			],
			self: Option.some({
				createdAt: "2026-04-14T10:00:00.000Z",
				keyMode: "pq-hybrid",
				privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
					"keys/active.key.age",
				),
				publicIdentity: {
					displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
					identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
						"2026-04-14T10:00:00.000Z",
					),
					ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
					publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
				},
			}),
		}),
		readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
		saveState: (_state) => Effect.void,
		writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
		writePrivateKeyAtPath: (_input) => Effect.die("unused"),
	});

const makeUnconfiguredHomeRepository = () =>
	HomeRepository.make({
		deletePrivateKey: (_privateKeyPath) => Effect.void,
		getActiveKey: Effect.die("unused"),
		getLocation: Effect.succeed({
			keysDirectory: "/tmp/keys",
			rootDirectory: "/tmp/home",
			stateFile: "/tmp/home/state.json",
		}),
		loadState: Effect.succeed(emptyHomeState()),
		readPrivateKey: (_privateKeyPath) => Effect.die("unused"),
		saveState: (_state) => Effect.void,
		writePrivateKey: (_fingerprint, _contents) => Effect.die("unused"),
		writePrivateKeyAtPath: (_input) => Effect.die("unused"),
	});

const makeViewPayload = () => {
	const calls: Array<{ path: Option.Option<string> }> = [];

	return Object.assign(
		ViewPayload.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
				}),
		}),
		{ calls },
	);
};

const makeInspectHomeIdentities = () =>
	InspectHomeIdentities.make({
		execute: Effect.succeed({
			knownIdentities: [
				{
					displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
					fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
						"bs1_aaaaaaaaaaaaaaaa",
					),
					handle: Schema.decodeUnknownSync(Handle)("paul#aaaaaaaa"),
					identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
						"2026-04-14T10:00:00.000Z",
					),
					localAlias: Option.none(),
				},
			],
			me: Option.some({
				displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
				fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
					"bs1_1111111111111111",
				),
				handle: Schema.decodeUnknownSync(Handle)("isaac#069f7576"),
				identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
					"2026-04-14T10:00:00.000Z",
				),
				ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
				rotationStatus: {
					dueAt: "2026-07-14T10:00:00.000Z",
					isOverdue: false,
				},
				rotationTtl: "3m" as const,
				status: "active" as const,
			}),
			retiredKeyCount: 1,
			retiredKeys: [
				{
					fingerprint: Schema.decodeUnknownSync(KeyFingerprint)(
						"bs1_2222222222222222",
					),
					retiredAt: "2026-01-01T10:00:00.000Z",
				},
			],
			rotationTtl: "3m" as const,
		}),
	});

const makeExportIdentityString = () =>
	ExportIdentityString.make({
		execute: Effect.succeed(
			"better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ" as never,
		),
	});

const makeImportIdentityString = () => {
	const calls: Array<{ identityString: string }> = [];

	return Object.assign(
		ImportIdentityString.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
					return new ImportIdentityStringSuccess({
						displayName: knownPaulDisplayName,
						handle: knownPaulHandle,
						outcome: "added",
					});
				}),
		}),
		{ calls },
	);
};

const makeForgetIdentity = () => {
	const calls: Array<{ identityRef: string }> = [];

	return Object.assign(
		ForgetIdentity.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
					return new ForgetIdentityRemovedSuccess({
						handle: knownPaulHandle,
					});
				}),
		}),
		{ calls },
	);
};

const makeRotateUserIdentity = () => {
	const calls: Array<{ passphrase: string }> = [];

	return Object.assign(
		RotateUserIdentity.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
					return new RotateUserIdentitySuccess({
						newFingerprint: rotatedFingerprint,
						oldFingerprint: currentFingerprint,
						ownerId: selfOwnerId,
					});
				}),
		}),
		{ calls },
	);
};

const makeChangePassphrase = () => {
	const calls: Array<{
		currentPassphrase: string;
		nextPassphrase: string;
	}> = [];

	return Object.assign(
		ChangePassphrase.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
					return new ChangePassphraseSuccess({});
				}),
		}),
		{ calls },
	);
};

const makeCreatePayload = () => {
	const calls: Array<{ path: string }> = [];

	return Object.assign(
		CreatePayload.make({
			execute: ({ path }) =>
				Effect.sync(() => {
					calls.push({ path });
					return new CreatePayloadSuccess({
						path,
						payloadId: "bspld_0123456789abcdef" as never,
					});
				}),
		}),
		{ calls },
	);
};

const makeInspectPayload = () => {
	const calls: Array<{ passphrase: string; path: string }> = [];

	return Object.assign(
		InspectPayload.make({
			execute: ({ passphrase, path }) =>
				Effect.sync(() => {
					calls.push({ passphrase, path });
					return new InspectPayloadSuccess({
						createdAt: "2026-04-14T10:00:00.000Z",
						envKeys: ["API_TOKEN"],
						lastRewrittenAt: "2026-04-14T10:00:00.000Z",
						needsUpdate: {
							isRequired: false,
							reason: Option.none(),
						},
						path,
						payloadId: "bspld_0123456789abcdef" as never,
						recipientCount: 1,
						recipients: [
							{
								displayName: "isaac",
								fingerprint: "bs1_1111111111111111",
								handle: "isaac#069f7576",
								isMe: true,
								isStaleSelf: false,
								localAlias: Option.none(),
							},
						],
						secretCount: 1,
						version: 2,
					});
				}),
		}),
		{ calls },
	);
};

const makeUpdatePayload = () => {
	const calls: Array<{ passphrase: string; path: string }> = [];

	return Object.assign(
		UpdatePayload.make({
			execute: ({ passphrase, path }) =>
				Effect.sync(() => {
					calls.push({ passphrase, path });
					return new UpdatePayloadUpdatedSuccess({
						path,
						payloadId: "bspld_0123456789abcdef",
						reasons: ["self key is stale"],
					});
				}),
		}),
		{ calls },
	);
};

const makeResolvePayloadTarget = (resolvedPath = "./.env.enc") =>
	ResolvePayloadTarget.make({
		resolveExistingPath: (_path) => Effect.succeed(resolvedPath),
	});

const makePathAccess = () =>
	PathAccess.make({
		exists: () => Effect.succeed(false),
	});

const makeUnusedInteractiveFileFlowLayers = () =>
	[
		Layer.succeed(
			EditPayload,
			EditPayload.make({
				open: () => Effect.die("unused"),
				save: () => Effect.die("unused"),
			}),
		),
		Layer.succeed(
			GrantPayloadRecipient,
			GrantPayloadRecipient.make({
				execute: () => Effect.die("unused"),
			}),
		),
		Layer.succeed(
			RevokePayloadRecipient,
			RevokePayloadRecipient.make({
				execute: () => Effect.die("unused"),
			}),
		),
		Layer.succeed(
			ResolveEditorCommand,
			ResolveEditorCommand.make({
				resolve: () => Effect.die("unused"),
			}),
		),
		Layer.succeed(
			Editor,
			Editor.make({
				editFile: () => Effect.die("unused"),
			}),
		),
		Layer.succeed(
			TempFile,
			TempFile.make({
				create: () => Effect.die("unused"),
				delete: () => Effect.die("unused"),
				read: () => Effect.die("unused"),
			}),
		),
	] as const;

const makeUnusedInteractiveGuidedFileLayers = (input: {
	readonly interactivePrompt: InteractivePrompt;
	readonly pathAccess: PathAccess;
	readonly prompt: Prompt;
}) =>
	[
		Layer.succeed(CreatePayload, makeCreatePayload()),
		Layer.succeed(InspectPayload, makeInspectPayload()),
		Layer.succeed(UpdatePayload, makeUpdatePayload()),
		Layer.succeed(PathAccess, input.pathAccess),
		Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
		Layer.provide(ResolveNewPayloadTarget.Default, [
			Layer.succeed(Prompt, input.prompt),
			Layer.succeed(InteractivePrompt, input.interactivePrompt),
			Layer.succeed(PathAccess, input.pathAccess),
		]),
	] as const;

const makeCreateUserIdentity = () => {
	const calls: Array<{ displayName: string; passphrase: string }> = [];
	const handle = Schema.decodeUnknownSync(Handle)("isaac#069f7576");
	const privateKeyPath = Schema.decodeUnknownSync(PrivateKeyRelativePath)(
		"keys/active.key.age",
	);
	const publicKey = Schema.decodeUnknownSync(PublicKey)("age1isaac");

	return Object.assign(
		CreateUserIdentity.make({
			execute: (input) => {
				const displayName = Schema.decodeUnknownSync(DisplayName)(
					input.displayName,
				);

				return Effect.sync(() => {
					calls.push(input);
					return new CreateUserIdentitySuccess({
						displayName,
						fingerprint: currentFingerprint,
						handle,
						ownerId: selfOwnerId,
						privateKeyPath,
						publicKey,
					});
				});
			},
		}),
		{ calls },
	);
};

describe("interactiveCommand", () => {
	const setupGatePrompt = makePrompt();
	const setupGateInteractivePrompt = makeInteractivePrompt(["Cancel"]);
	const setupGateCreateUserIdentity = makeCreateUserIdentity();
	const setupGateViewPayload = makeViewPayload();
	const setupGateInspectHomeIdentities = makeInspectHomeIdentities();
	const setupGateExportIdentityString = makeExportIdentityString();
	const setupGateImportIdentityString = makeImportIdentityString();
	const setupGateForgetIdentity = makeForgetIdentity();
	const setupGateRotateUserIdentity = makeRotateUserIdentity();
	const setupGateChangePassphrase = makeChangePassphrase();
	const setupGatePathAccess = makePathAccess();

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.provide(InteractiveSession.Default, [
				Layer.succeed(HomeRepository, makeUnconfiguredHomeRepository()),
				Layer.succeed(Prompt, setupGatePrompt),
				Layer.succeed(InteractivePrompt, setupGateInteractivePrompt),
				Layer.succeed(CreateUserIdentity, setupGateCreateUserIdentity),
				Layer.succeed(InspectHomeIdentities, setupGateInspectHomeIdentities),
				Layer.succeed(ExportIdentityString, setupGateExportIdentityString),
				Layer.succeed(ImportIdentityString, setupGateImportIdentityString),
				Layer.succeed(ForgetIdentity, setupGateForgetIdentity),
				Layer.succeed(RotateUserIdentity, setupGateRotateUserIdentity),
				Layer.succeed(ChangePassphrase, setupGateChangePassphrase),
				Layer.succeed(ViewPayload, setupGateViewPayload),
				...makeUnusedInteractiveFileFlowLayers(),
				...makeUnusedInteractiveGuidedFileLayers({
					interactivePrompt: setupGateInteractivePrompt,
					pathAccess: setupGatePathAccess,
					prompt: setupGatePrompt,
				}),
			]),
			Layer.succeed(HomeRepository, makeUnconfiguredHomeRepository()),
			Layer.succeed(Prompt, setupGatePrompt),
			Layer.succeed(InteractivePrompt, setupGateInteractivePrompt),
			Layer.succeed(CreateUserIdentity, setupGateCreateUserIdentity),
			Layer.succeed(InspectHomeIdentities, setupGateInspectHomeIdentities),
			Layer.succeed(ExportIdentityString, setupGateExportIdentityString),
			Layer.succeed(ImportIdentityString, setupGateImportIdentityString),
			Layer.succeed(ForgetIdentity, setupGateForgetIdentity),
			Layer.succeed(RotateUserIdentity, setupGateRotateUserIdentity),
			Layer.succeed(ChangePassphrase, setupGateChangePassphrase),
			Layer.succeed(ViewPayload, setupGateViewPayload),
			...makeUnusedInteractiveFileFlowLayers(),
			...makeUnusedInteractiveGuidedFileLayers({
				interactivePrompt: setupGateInteractivePrompt,
				pathAccess: setupGatePathAccess,
				prompt: setupGatePrompt,
			}),
		),
	)("setup gate", (it) => {
		it.effect(
			"routes unconfigured users into setup gating before normal menu use",
			() =>
				Effect.gen(function* () {
					const interactivePrompt = yield* InteractivePrompt;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([interactiveCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "interactive"]);

					expect(
						(
							interactivePrompt as typeof interactivePrompt & {
								calls: Array<{
									choices: ReadonlyArray<{ title: string }>;
									message: string;
								}>;
							}
						).calls,
					).toEqual([
						{
							choices: [
								{ title: "Setup now" },
								{ title: "Back" },
								{ title: "Cancel" },
							],
							message: "Setup required",
						},
					]);
				}),
		);
	});

	const configuredPrompt = makePrompt();
	const configuredInteractivePrompt = makeInteractivePrompt([
		"files",
		"view",
		"back",
		"quit",
	]);
	const configuredCreateUserIdentity = makeCreateUserIdentity();
	const configuredViewPayload = makeViewPayload();
	const configuredInspectHomeIdentities = makeInspectHomeIdentities();
	const configuredExportIdentityString = makeExportIdentityString();
	const configuredImportIdentityString = makeImportIdentityString();
	const configuredForgetIdentity = makeForgetIdentity();
	const configuredRotateUserIdentity = makeRotateUserIdentity();
	const configuredChangePassphrase = makeChangePassphrase();
	const configuredPathAccess = makePathAccess();

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.provide(InteractiveSession.Default, [
				Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
				Layer.succeed(Prompt, configuredPrompt),
				Layer.succeed(InteractivePrompt, configuredInteractivePrompt),
				Layer.succeed(CreateUserIdentity, configuredCreateUserIdentity),
				Layer.succeed(InspectHomeIdentities, configuredInspectHomeIdentities),
				Layer.succeed(ExportIdentityString, configuredExportIdentityString),
				Layer.succeed(ImportIdentityString, configuredImportIdentityString),
				Layer.succeed(ForgetIdentity, configuredForgetIdentity),
				Layer.succeed(RotateUserIdentity, configuredRotateUserIdentity),
				Layer.succeed(ChangePassphrase, configuredChangePassphrase),
				Layer.succeed(ViewPayload, configuredViewPayload),
				...makeUnusedInteractiveFileFlowLayers(),
				...makeUnusedInteractiveGuidedFileLayers({
					interactivePrompt: configuredInteractivePrompt,
					pathAccess: configuredPathAccess,
					prompt: configuredPrompt,
				}),
			]),
			Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
			Layer.succeed(Prompt, configuredPrompt),
			Layer.succeed(InteractivePrompt, configuredInteractivePrompt),
			Layer.succeed(CreateUserIdentity, configuredCreateUserIdentity),
			Layer.succeed(InspectHomeIdentities, configuredInspectHomeIdentities),
			Layer.succeed(ExportIdentityString, configuredExportIdentityString),
			Layer.succeed(ImportIdentityString, configuredImportIdentityString),
			Layer.succeed(ForgetIdentity, configuredForgetIdentity),
			Layer.succeed(RotateUserIdentity, configuredRotateUserIdentity),
			Layer.succeed(ChangePassphrase, configuredChangePassphrase),
			Layer.succeed(ViewPayload, configuredViewPayload),
			...makeUnusedInteractiveFileFlowLayers(),
			...makeUnusedInteractiveGuidedFileLayers({
				interactivePrompt: configuredInteractivePrompt,
				pathAccess: configuredPathAccess,
				prompt: configuredPrompt,
			}),
		),
	)("configured shell", (it) => {
		it.effect(
			"routes files scope into secure view and keeps stale commands hidden",
			() =>
				Effect.gen(function* () {
					const interactivePrompt = yield* InteractivePrompt;
					const viewPayload = yield* ViewPayload;
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([interactiveCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "interactive"]);

					expect(
						(
							interactivePrompt as typeof interactivePrompt & {
								calls: Array<{
									choices: ReadonlyArray<{ title: string }>;
									message: string;
								}>;
							}
						).calls,
					).toEqual([
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
					]);

					expect(
						(
							interactivePrompt as typeof interactivePrompt & {
								calls: Array<{
									choices: ReadonlyArray<{ title: string }>;
									message: string;
								}>;
							}
						).calls[0]?.choices.map((choice) => choice.title),
					).not.toContain("Load");

					expect(
						(
							interactivePrompt as typeof interactivePrompt & {
								calls: Array<{
									choices: ReadonlyArray<{ title: string }>;
									message: string;
								}>;
							}
						).calls[0]?.choices.map((choice) => choice.title),
					).not.toContain("Read");

					expect(
						(
							viewPayload as typeof viewPayload & {
								calls: Array<{ path: Option.Option<string> }>;
							}
						).calls,
					).toEqual([{ path: Option.none() }]);
				}),
		);

		it.effect(
			"runs guided create inspect and update flows then returns to the files menu",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt({
						inputSecretAnswers: ["test-passphrase", "test-passphrase"],
						inputTextAnswers: ["./.env.enc"],
					});
					const interactivePrompt = makeInteractivePrompt([
						"files",
						"create",
						"inspect",
						"continue",
						"update",
						"back",
						"quit",
					]);
					const createPayload = makeCreatePayload();
					const inspectPayload = makeInspectPayload();
					const updatePayload = makeUpdatePayload();
					const pathAccess = makePathAccess();
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([interactiveCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "interactive"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.provide(InteractiveSession.Default, [
									Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
									Layer.succeed(Prompt, prompt),
									Layer.succeed(InteractivePrompt, interactivePrompt),
									Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
									Layer.succeed(CreatePayload, createPayload),
									Layer.succeed(InspectPayload, inspectPayload),
									Layer.succeed(UpdatePayload, updatePayload),
									Layer.succeed(PathAccess, pathAccess),
									Layer.succeed(
										ResolvePayloadTarget,
										makeResolvePayloadTarget(),
									),
									Layer.succeed(
										InspectHomeIdentities,
										makeInspectHomeIdentities(),
									),
									Layer.succeed(
										ExportIdentityString,
										makeExportIdentityString(),
									),
									Layer.succeed(
										ImportIdentityString,
										makeImportIdentityString(),
									),
									Layer.succeed(ForgetIdentity, makeForgetIdentity()),
									Layer.succeed(RotateUserIdentity, makeRotateUserIdentity()),
									Layer.succeed(ChangePassphrase, makeChangePassphrase()),
									Layer.succeed(ViewPayload, makeViewPayload()),
									...makeUnusedInteractiveFileFlowLayers(),
									Layer.provide(ResolveNewPayloadTarget.Default, [
										Layer.succeed(Prompt, prompt),
										Layer.succeed(InteractivePrompt, interactivePrompt),
										Layer.succeed(PathAccess, pathAccess),
									]),
								]),
								Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
								Layer.succeed(CreatePayload, createPayload),
								Layer.succeed(InspectPayload, inspectPayload),
								Layer.succeed(UpdatePayload, updatePayload),
								Layer.succeed(PathAccess, pathAccess),
								Layer.succeed(ResolvePayloadTarget, makeResolvePayloadTarget()),
								Layer.succeed(
									InspectHomeIdentities,
									makeInspectHomeIdentities(),
								),
								Layer.succeed(ExportIdentityString, makeExportIdentityString()),
								Layer.succeed(ImportIdentityString, makeImportIdentityString()),
								Layer.succeed(ForgetIdentity, makeForgetIdentity()),
								Layer.succeed(RotateUserIdentity, makeRotateUserIdentity()),
								Layer.succeed(ChangePassphrase, makeChangePassphrase()),
								Layer.succeed(ViewPayload, makeViewPayload()),
								...makeUnusedInteractiveFileFlowLayers(),
								Layer.provide(ResolveNewPayloadTarget.Default, [
									Layer.succeed(Prompt, prompt),
									Layer.succeed(InteractivePrompt, interactivePrompt),
									Layer.succeed(PathAccess, pathAccess),
								]),
							),
						),
					);

					expect(createPayload.calls).toEqual([{ path: "./.env.enc" }]);
					expect(inspectPayload.calls).toEqual([
						{ passphrase: "test-passphrase", path: "./.env.enc" },
					]);
					expect(updatePayload.calls).toEqual([
						{ passphrase: "test-passphrase", path: "./.env.enc" },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [{ title: "Continue" }],
							message: "Press Enter to continue",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [
								{ title: "Create payload" },
								{ title: "Inspect payload" },
								{ title: "View secrets" },
								{ title: "Edit secrets" },
								{ title: "Grant access" },
								{ title: "Revoke access" },
								{ title: "Update payload" },
								{ title: "Back" },
							],
							message: "Files",
						},
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
					]);
					expect(prompt.stdout).toEqual([
						"Created encrypted payload at ./.env.enc\n",
						[
							"Payload",
							"path: ./.env.enc",
							"version: 2",
							"payload id: bspld_0123456789abcdef",
							"created at: 2026-04-14T10:00:00.000Z",
							"last rewritten at: 2026-04-14T10:00:00.000Z",
							"secret count: 1",
							"recipient count: 1",
							"needs update: no",
							"",
							"Recipients",
							"isaac (isaac#069f7576) [you] bs1_11111111",
							"",
							"Env keys",
							"API_TOKEN",
							"",
							"",
						].join("\n"),
						"updated ./.env.enc (self key is stale)\n",
					]);
				}),
		);

		it.effect(
			"shows guided identity actions and returns to the identity menu after show/share flows",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt();
					const interactivePrompt = makeInteractivePrompt([
						"identity",
						"show",
						"continue",
						"share",
						"continue",
						"back",
						"quit",
					]);
					const pathAccess = makePathAccess();
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([interactiveCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "interactive"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.provide(InteractiveSession.Default, [
									Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
									Layer.succeed(Prompt, prompt),
									Layer.succeed(InteractivePrompt, interactivePrompt),
									Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
									Layer.succeed(
										InspectHomeIdentities,
										makeInspectHomeIdentities(),
									),
									Layer.succeed(
										ExportIdentityString,
										makeExportIdentityString(),
									),
									Layer.succeed(
										ImportIdentityString,
										makeImportIdentityString(),
									),
									Layer.succeed(ForgetIdentity, makeForgetIdentity()),
									Layer.succeed(RotateUserIdentity, makeRotateUserIdentity()),
									Layer.succeed(ChangePassphrase, makeChangePassphrase()),
									Layer.succeed(ViewPayload, makeViewPayload()),
									...makeUnusedInteractiveFileFlowLayers(),
									...makeUnusedInteractiveGuidedFileLayers({
										interactivePrompt,
										pathAccess,
										prompt,
									}),
								]),
								Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
								Layer.succeed(
									InspectHomeIdentities,
									makeInspectHomeIdentities(),
								),
								Layer.succeed(ExportIdentityString, makeExportIdentityString()),
								Layer.succeed(ImportIdentityString, makeImportIdentityString()),
								Layer.succeed(ForgetIdentity, makeForgetIdentity()),
								Layer.succeed(RotateUserIdentity, makeRotateUserIdentity()),
								Layer.succeed(ChangePassphrase, makeChangePassphrase()),
								Layer.succeed(ViewPayload, makeViewPayload()),
								...makeUnusedInteractiveFileFlowLayers(),
								...makeUnusedInteractiveGuidedFileLayers({
									interactivePrompt,
									pathAccess,
									prompt,
								}),
							),
						),
					);

					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [{ title: "Continue" }],
							message: "Press Enter to continue",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [{ title: "Continue" }],
							message: "Press Enter to continue",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
					]);

					expect(prompt.stdout).toEqual([
						[
							[
								"Me",
								"display name: isaac",
								"handle: isaac#069f7576",
								"owner id: bsid1_069f7576",
								"fingerprint: bs1_11111111",
								"identity updated at: 2026-04-14T10:00:00.000Z",
								"status: active",
								"rotation ttl: 3m",
								"rotation due: 2026-07-14T10:00:00.000Z",
								"retired keys: 1",
							].join("\n"),
							[
								"Known identities",
								"paul (paul#aaaaaaaa) bs1_aaaaaaaa 2026-04-14T10:00:00.000Z",
							].join("\n"),
							[
								"Retired local keys",
								"bs1_22222222 2026-01-01T10:00:00.000Z",
							].join("\n"),
							"",
						].join("\n\n"),
						"better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ\n",
					]);
				}),
		);

		it.effect(
			"runs guided import forget rotate and passphrase flows then returns to menus",
			() =>
				Effect.gen(function* () {
					const prompt = makePrompt({
						inputSecretAnswers: ["test-passphrase", "current", "next", "next"],
						inputTextAnswers: [
							"better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ",
						],
					});
					const interactivePrompt = makeInteractivePrompt([
						"identity",
						"import",
						"forget",
						"paul#aaaaaaaa",
						"rotate",
						"change-passphrase",
						"back",
						"quit",
					]);
					const importIdentityString = makeImportIdentityString();
					const forgetIdentity = makeForgetIdentity();
					const rotateUserIdentity = makeRotateUserIdentity();
					const changePassphrase = makeChangePassphrase();
					const pathAccess = makePathAccess();
					const cli = Command.run(
						Command.make("bage").pipe(
							Command.withSubcommands([interactiveCommand]),
						),
						{ name: "bage", version: "0.0.1" },
					);

					yield* cli(["node", "bage", "interactive"]).pipe(
						Effect.provide(
							Layer.mergeAll(
								NodeContext.layer,
								Layer.provide(InteractiveSession.Default, [
									Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
									Layer.succeed(Prompt, prompt),
									Layer.succeed(InteractivePrompt, interactivePrompt),
									Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
									Layer.succeed(
										InspectHomeIdentities,
										makeInspectHomeIdentities(),
									),
									Layer.succeed(
										ExportIdentityString,
										makeExportIdentityString(),
									),
									Layer.succeed(ImportIdentityString, importIdentityString),
									Layer.succeed(ForgetIdentity, forgetIdentity),
									Layer.succeed(RotateUserIdentity, rotateUserIdentity),
									Layer.succeed(ChangePassphrase, changePassphrase),
									Layer.succeed(ViewPayload, makeViewPayload()),
									...makeUnusedInteractiveFileFlowLayers(),
									...makeUnusedInteractiveGuidedFileLayers({
										interactivePrompt,
										pathAccess,
										prompt,
									}),
								]),
								Layer.succeed(HomeRepository, makeConfiguredHomeRepository()),
								Layer.succeed(Prompt, prompt),
								Layer.succeed(InteractivePrompt, interactivePrompt),
								Layer.succeed(CreateUserIdentity, makeCreateUserIdentity()),
								Layer.succeed(
									InspectHomeIdentities,
									makeInspectHomeIdentities(),
								),
								Layer.succeed(ExportIdentityString, makeExportIdentityString()),
								Layer.succeed(ImportIdentityString, importIdentityString),
								Layer.succeed(ForgetIdentity, forgetIdentity),
								Layer.succeed(RotateUserIdentity, rotateUserIdentity),
								Layer.succeed(ChangePassphrase, changePassphrase),
								Layer.succeed(ViewPayload, makeViewPayload()),
								...makeUnusedInteractiveFileFlowLayers(),
								...makeUnusedInteractiveGuidedFileLayers({
									interactivePrompt,
									pathAccess,
									prompt,
								}),
							),
						),
					);

					expect(importIdentityString.calls).toEqual([
						{
							identityString: "better-age://identity/v1/eyJ2ZXJzaW9uIjoidjEifQ",
						},
					]);
					expect(forgetIdentity.calls).toEqual([
						{ identityRef: "paul#aaaaaaaa" },
					]);
					expect(rotateUserIdentity.calls).toEqual([
						{ passphrase: "test-passphrase" },
					]);
					expect(changePassphrase.calls).toEqual([
						{ currentPassphrase: "current", nextPassphrase: "next" },
					]);
					expect(prompt.inputTextCalls).toEqual([
						{ message: "Identity string" },
					]);
					expect(prompt.inputSecretCalls).toEqual([
						{ message: "Passphrase: " },
						{ message: "Current passphrase: " },
						{ message: "New passphrase: " },
						{ message: "Confirm new passphrase: " },
					]);
					expect(interactivePrompt.calls).toEqual([
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [{ title: "paul (paul#aaaaaaaa)" }],
							message: "Forget identity",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [
								{ title: "Show identity" },
								{ title: "Share identity string" },
								{ title: "Import identity" },
								{ title: "Forget known identity" },
								{ title: "Rotate identity" },
								{ title: "Change passphrase" },
								{ title: "Back" },
							],
							message: "My identity",
						},
						{
							choices: [
								{ title: "Files" },
								{ title: "My identity" },
								{ title: "Quit" },
							],
							message: "Better Secrets",
						},
					]);
					expect(prompt.stdout).toEqual([
						"added paul (paul#aaaaaaaa)\n",
						"forgot local identity paul#aaaaaaaa\n",
						[
							"rotated identity bs1_1111111111111111 -> bs1_3333333333333333",
							"Share updated identity: bage me",
							"",
						].join("\n"),
						"updated passphrase for all local keys\n",
					]);
				}),
		);
	});
});
