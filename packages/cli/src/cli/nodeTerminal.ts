import { stderr, stdin } from "node:process";
import { createInterface } from "node:readline/promises";
import type { CliTerminal } from "./runCli.js";
import { readHiddenSecret, type SecretPromptRuntime } from "./secretPrompt.js";

type NodeTerminalRuntime = SecretPromptRuntime;

const defaultRuntime: NodeTerminalRuntime = { stdin, stderr };

const question = async (
	runtime: NodeTerminalRuntime,
	label: string,
): Promise<string> => {
	const readline = createInterface(
		runtime.stdin as NodeJS.ReadStream,
		runtime.stderr as NodeJS.WriteStream,
	);

	try {
		return await readline.question(`${label}: `);
	} finally {
		readline.close();
	}
};

export const createNodeTerminal = (
	runtime: NodeTerminalRuntime = defaultRuntime,
): CliTerminal => {
	if (!runtime.stdin.isTTY || !runtime.stderr.isTTY) {
		return { mode: "headless" };
	}

	return {
		mode: "interactive",
		promptSecret: async (label) => await readHiddenSecret(runtime, label),
		promptText: async (label) => await question(runtime, label),
		selectOne: async (label, choices) => {
			const enabledChoices = choices.filter((choice) => !choice.disabled);

			runtime.stderr.write(`${label}\n`);

			for (const [index, choice] of choices.entries()) {
				const marker = choice.disabled ? " -" : `${index + 1}.`;
				runtime.stderr.write(`${marker} ${choice.label}\n`);
			}

			while (true) {
				const answer = await question(runtime, "Select");
				const selectedIndex = Number.parseInt(answer, 10) - 1;
				const selected = choices[selectedIndex];

				if (selected !== undefined && !selected.disabled) {
					return selected.value;
				}

				if (enabledChoices.length === 0) {
					return "";
				}

				runtime.stderr.write("Invalid selection\n");
			}
		},
	};
};
