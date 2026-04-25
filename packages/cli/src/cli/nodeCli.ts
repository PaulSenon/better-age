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
import { type CliTerminal, runCli } from "./runCli.js";

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

	return {
		run: async (argv: ReadonlyArray<string>) =>
			await runCli({
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
				terminal: options.terminal,
			}),
	};
};
