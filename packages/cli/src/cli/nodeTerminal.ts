import { stderr, stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";
import {
	createNodePromptAdapter,
	type NodePromptFunctions,
} from "./nodePromptAdapter.js";
import type { CliTerminal } from "./runCli.js";
import { openSecureViewer, type SecureViewerRuntime } from "./secureViewer.js";

type NodeTerminalStdin = Partial<SecureViewerRuntime["stdin"]> & {
	readonly isTTY?: boolean;
};

type NodeTerminalStderr = Partial<SecureViewerRuntime["stderr"]> & {
	readonly isTTY?: boolean;
	write(chunk: string): void;
};

type NodeTerminalRuntime = Partial<
	Pick<SecureViewerRuntime, "emitKeypressEvents">
> & {
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly promptFns?: NodePromptFunctions;
	readonly stderr: NodeTerminalStderr;
	readonly stdin: NodeTerminalStdin;
	readonly stdout?: Pick<typeof stdout, "write">;
};

const defaultRuntime: NodeTerminalRuntime = {
	emitKeypressEvents: (stream) => {
		emitKeypressEvents(stream as NodeJS.ReadStream);
	},
	env: process.env,
	stderr,
	stdin,
	stdout,
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

	const promptAdapter = createNodePromptAdapter({
		...(runtime.promptFns === undefined
			? {}
			: { promptFns: runtime.promptFns }),
		stderr: runtime.stderr as NodeJS.WritableStream,
		stdin: runtime.stdin as unknown as NodeJS.ReadableStream,
	});

	return {
		mode: "interactive",
		confirm: promptAdapter.confirm,
		presentation: { color: runtime.env?.NO_COLOR === undefined },
		...(hasSecureViewerRuntime(runtime)
			? {
					openViewer: async (envText, path) => {
						await openSecureViewer(runtime, { envText, path });
					},
				}
			: {}),
		waitForEnter: promptAdapter.waitForEnter,
		writeResult: (result) => {
			runtime.stdout?.write(result.stdout);
			runtime.stderr.write(result.stderr);
		},
		promptSecret: promptAdapter.promptSecret,
		promptText: promptAdapter.promptText,
		selectOne: promptAdapter.selectOne,
	};
};
