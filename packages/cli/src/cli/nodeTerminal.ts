import { stderr, stdin } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import type { CliTerminal } from "./runCli.js";
import { readHiddenSecret, type SecretPromptRuntime } from "./secretPrompt.js";
import { openSecureViewer, type SecureViewerRuntime } from "./secureViewer.js";

type NodeTerminalRuntime = SecretPromptRuntime &
	Partial<Pick<SecureViewerRuntime, "emitKeypressEvents">> & {
		readonly env?: Readonly<Record<string, string | undefined>>;
		readonly stderr: SecretPromptRuntime["stderr"] &
			Partial<SecureViewerRuntime["stderr"]>;
		readonly stdin: SecretPromptRuntime["stdin"] &
			Partial<SecureViewerRuntime["stdin"]>;
	};

const defaultRuntime: NodeTerminalRuntime = {
	emitKeypressEvents: (stream) => {
		emitKeypressEvents(stream as NodeJS.ReadStream);
	},
	env: process.env,
	stderr,
	stdin,
};

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

const hasSecureViewerRuntime = (
	runtime: NodeTerminalRuntime,
): runtime is NodeTerminalRuntime & SecureViewerRuntime =>
	runtime.emitKeypressEvents !== undefined &&
	typeof runtime.stdin.off === "function" &&
	typeof runtime.stdin.on === "function" &&
	typeof runtime.stdin.pause === "function" &&
	typeof runtime.stdin.resume === "function" &&
	typeof runtime.stdin.setRawMode === "function" &&
	typeof runtime.stderr.clearScreenDown === "function" &&
	typeof runtime.stderr.cursorTo === "function" &&
	typeof runtime.stderr.off === "function" &&
	typeof runtime.stderr.on === "function";

export const createNodeTerminal = (
	runtime: NodeTerminalRuntime = defaultRuntime,
): CliTerminal => {
	if (!runtime.stdin.isTTY || !runtime.stderr.isTTY) {
		return { mode: "headless", presentation: { color: false } };
	}

	return {
		mode: "interactive",
		presentation: { color: runtime.env?.NO_COLOR === undefined },
		...(hasSecureViewerRuntime(runtime)
			? {
					openViewer: async (envText, path) => {
						await openSecureViewer(runtime, { envText, path });
					},
				}
			: {}),
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
