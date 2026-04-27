import type { EventEmitter } from "node:events";

export class CliPromptCancelledError extends Error {
	readonly name = "CliPromptCancelledError";

	constructor() {
		super("Prompt cancelled");
	}
}

export type SecretPromptState = {
	readonly value: string;
	readonly done: boolean;
};

export type SecretPromptResult =
	| { readonly kind: "success"; readonly value: string }
	| { readonly kind: "cancel" };

export type SecretPromptTransition = {
	readonly state: SecretPromptState;
	readonly write: string;
	readonly result?: SecretPromptResult;
};

export type SecretPromptRuntime = {
	readonly stdin: SecretPromptStdin;
	readonly stderr: SecretPromptStderr;
};

type SecretPromptStdin = EventEmitter & {
	readonly isRaw?: boolean;
	readonly isTTY?: boolean;
	pause(): void;
	resume(): void;
	setEncoding(encoding: BufferEncoding): void;
	setRawMode(value: boolean): void;
};

type SecretPromptStderr = {
	readonly isTTY?: boolean;
	write(chunk: string): void;
};

export const createSecretPromptState = (
	label: string,
): { readonly state: SecretPromptState; readonly write: string } => ({
	state: { value: "", done: false },
	write: `${label}: `,
});

const complete = (
	state: SecretPromptState,
	result: SecretPromptResult,
): SecretPromptTransition => ({
	state: { ...state, done: true },
	write: "\n",
	result,
});

export const closeSecretPrompt = (
	state: SecretPromptState,
): SecretPromptTransition => complete(state, { kind: "cancel" });

export const reduceSecretPromptInput = (
	state: SecretPromptState,
	chunk: string,
): SecretPromptTransition => {
	let nextState = state;

	for (const character of chunk) {
		if (nextState.done) {
			return { state: nextState, write: "" };
		}

		if (character === "\u0003" || character === "\u0004") {
			return complete(nextState, { kind: "cancel" });
		}

		if (character === "\r" || character === "\n") {
			return complete(nextState, {
				kind: "success",
				value: nextState.value,
			});
		}

		if (character === "\u007f" || character === "\b") {
			nextState = { ...nextState, value: nextState.value.slice(0, -1) };
			continue;
		}

		nextState = { ...nextState, value: `${nextState.value}${character}` };
	}

	return { state: nextState, write: "" };
};

export const readHiddenSecret = (
	runtime: SecretPromptRuntime,
	label: string,
): Promise<string> =>
	new Promise((resolve, reject) => {
		const { stderr, stdin } = runtime;
		const previousRawMode = stdin.isRaw;
		let state = createSecretPromptState(label).state;

		const cleanup = () => {
			stdin.off("data", onData);
			stdin.off("end", onEnd);
			stdin.setRawMode(Boolean(previousRawMode));
			stdin.pause();
		};

		const finish = (transition: SecretPromptTransition) => {
			state = transition.state;
			if (transition.write.length > 0) {
				stderr.write(transition.write);
			}

			if (transition.result === undefined) {
				return;
			}

			cleanup();

			if (transition.result.kind === "cancel") {
				reject(new CliPromptCancelledError());
				return;
			}

			resolve(transition.result.value);
		};

		const onData = (chunk: string | Buffer) => {
			finish(reduceSecretPromptInput(state, String(chunk)));
		};

		const onEnd = () => {
			finish(closeSecretPrompt(state));
		};

		stderr.write(createSecretPromptState(label).write);
		stdin.setEncoding("utf8");
		stdin.resume();
		stdin.setRawMode(true);
		stdin.on("data", onData);
		stdin.on("end", onEnd);
	});
