import { stderr, stdin } from "node:process";
import { createInterface } from "node:readline/promises";
import type { CliTerminal } from "./runCli.js";

const question = async (label: string): Promise<string> => {
	const readline = createInterface({ input: stdin, output: stderr });

	try {
		return await readline.question(`${label}: `);
	} finally {
		readline.close();
	}
};

export const createNodeTerminal = (): CliTerminal => ({
	mode: stdin.isTTY && stderr.isTTY ? "interactive" : "headless",
	promptSecret: question,
	promptText: question,
	selectOne: async (label, choices) => {
		const enabledChoices = choices.filter((choice) => !choice.disabled);

		stderr.write(`${label}\n`);

		for (const [index, choice] of choices.entries()) {
			const marker = choice.disabled ? " -" : `${index + 1}.`;
			stderr.write(`${marker} ${choice.label}\n`);
		}

		while (true) {
			const answer = await question("Select");
			const selectedIndex = Number.parseInt(answer, 10) - 1;
			const selected = choices[selectedIndex];

			if (selected !== undefined && !selected.disabled) {
				return selected.value;
			}

			if (enabledChoices.length === 0) {
				return "";
			}

			stderr.write("Invalid selection\n");
		}
	},
});
