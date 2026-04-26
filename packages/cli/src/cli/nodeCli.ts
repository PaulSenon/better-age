import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	createAgeIdentityCrypto,
	createAgePayloadCrypto,
	createBetterAgeCore,
	createNodeHomeRepository,
	createNodePayloadRepository,
} from "@better-age/core";
import { runCliWithGrammar } from "./commandGrammar.js";
import {
	createDefaultNodeEditorRuntime,
	openNodeEditor,
} from "./nodeEditor.js";
import type { CliTerminal } from "./runCli.js";

export type NodeCliOptions = {
	readonly homeDir?: string;
	readonly terminal: CliTerminal;
};

export const createNodeCli = (options: NodeCliOptions) => {
	const homeDir = options.homeDir ?? join(homedir(), ".better-age");
	const payloadRepository = createNodePayloadRepository();
	const core = createBetterAgeCore({
		clock: { now: async () => new Date().toISOString() },
		homeRepository: createNodeHomeRepository({ homeDir }),
		identityCrypto: createAgeIdentityCrypto(),
		payloadRepository,
		payloadCrypto: createAgePayloadCrypto(),
		randomIds: {
			nextOwnerId: async () => `owner_${randomUUID()}`,
			nextPayloadId: async () => `payload_${randomUUID()}`,
		},
	});
	const terminal: CliTerminal =
		options.terminal.mode === "interactive" &&
		options.terminal.openEditor === undefined
			? {
					...options.terminal,
					openEditor: async (initialText) =>
						await openNodeEditor(
							createDefaultNodeEditorRuntime({
								getSavedEditorCommand: async () => {
									const response = await core.queries.getEditorPreference();

									return response.result.kind === "success"
										? response.result.value.editorCommand
										: null;
								},
								isInteractive: true,
								selectOne: options.terminal.selectOne,
								setSavedEditorCommand: async (editorCommand) => {
									const response = await core.commands.setEditorPreference({
										editorCommand,
									});

									if (response.result.kind === "failure") {
										throw new Error(response.result.code);
									}
								},
							}),
							initialText,
						),
				}
			: options.terminal;

	return {
		run: async (argv: ReadonlyArray<string>) =>
			await runCliWithGrammar({
				argv,
				core,
				parseIdentityString: async (identityString) => {
					const response = await core.queries.parseIdentityString({
						identityString,
					});

					return response.result.kind === "success"
						? response.result.value
						: null;
				},
				payloadPathExists: payloadRepository.payloadExists,
				terminal,
			}),
	};
};
