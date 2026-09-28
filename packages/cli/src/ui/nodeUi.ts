// Node implementation of `Ui`. Prompts use @inquirer/prompts on stdin/stderr
// (never stdout, so `bage load` output stays pure). Effect v4's own `Prompt`
// is not used because NodeTerminal renders prompts on stdout.
import { emitKeypressEvents } from "node:readline";
import { confirm, input, password, select } from "@inquirer/prompts";
import { Effect, Layer } from "effect";
import { aborted, CliFailure } from "../failures.js";
import {
	createViewerState,
	enterAlternateScreen,
	exitAlternateScreen,
	hideCursor,
	reduceViewerState,
	renderViewerFrame,
	showCursor,
	toViewerAction,
	type ViewerKey,
} from "./secureViewer.js";
import { Ui } from "./Ui.js";

const isPromptExit = (cause: unknown) =>
	cause instanceof Error &&
	(cause.name === "ExitPromptError" || cause.name === "AbortPromptError");

/** Runs an inquirer prompt; interruption aborts it, Ctrl-C becomes an abort failure. */
const prompt = <A>(
	run: (context: {
		readonly input: NodeJS.ReadableStream;
		readonly output: NodeJS.WritableStream;
		readonly clearPromptOnDone: boolean;
		readonly signal: AbortSignal;
	}) => Promise<A>,
) =>
	Effect.tryPromise({
		try: (signal) =>
			run({
				input: process.stdin,
				output: process.stderr,
				clearPromptOnDone: false,
				signal,
			}),
		catch: (cause) =>
			isPromptExit(cause)
				? aborted()
				: new CliFailure({
						code: "UNEXPECTED",
						detail: cause instanceof Error ? cause.message : String(cause),
					}),
	});

export type ViewerTerminal = {
	readonly stdin: Pick<
		NodeJS.ReadStream,
		"isTTY" | "isRaw" | "setRawMode" | "resume" | "pause" | "on" | "off"
	>;
	readonly stderr: Pick<
		NodeJS.WriteStream,
		"isTTY" | "rows" | "write" | "cursorTo" | "clearScreenDown" | "on" | "off"
	>;
	readonly emitKeypressEvents: (stream: ViewerTerminal["stdin"]) => void;
};

const processTerminal: ViewerTerminal = {
	stdin: process.stdin,
	stderr: process.stderr,
	emitKeypressEvents: (stream) =>
		emitKeypressEvents(stream as NodeJS.ReadStream),
};

/**
 * In-process viewer in the alternate screen of stderr. Quitting or fiber
 * interruption both restore raw mode, cursor, and the previous screen.
 */
export const viewInTerminal =
	(terminal: ViewerTerminal = processTerminal) =>
	(text: string, path: string) =>
		Effect.callback<void, CliFailure>((resume) => {
			const { stdin, stderr } = terminal;

			if (!stdin.isTTY || !stderr.isTTY) {
				resume(Effect.fail(new CliFailure({ code: "VIEWER_UNAVAILABLE" })));
				return;
			}

			const previousRawMode = stdin.isRaw;
			let state = createViewerState({
				envText: text,
				path,
				rows: stderr.rows ?? 24,
			});
			let closed = false;
			const render = () => {
				stderr.write(enterAlternateScreen + hideCursor);
				stderr.cursorTo(0, 0);
				stderr.clearScreenDown();
				stderr.write(renderViewerFrame(state));
			};
			const cleanup = () => {
				if (closed) return;
				closed = true;
				stdin.off("keypress", onKeypress);
				stderr.off("resize", onResize);
				stdin.setRawMode(Boolean(previousRawMode));
				stdin.pause();
				stderr.write(showCursor + exitAlternateScreen);
			};
			const onResize = () => {
				state = { ...state, rows: stderr.rows ?? state.rows };
				render();
			};
			const onKeypress = (_input: string, key: ViewerKey | undefined) => {
				const action = toViewerAction(key ?? {});

				if (action === "quit") {
					cleanup();
					resume(Effect.void);
					return;
				}

				state = reduceViewerState(state, action);
				render();
			};

			terminal.emitKeypressEvents(stdin);
			stdin.setRawMode(true);
			stdin.resume();
			stdin.on("keypress", onKeypress);
			stderr.on("resize", onResize);
			render();

			return Effect.sync(cleanup);
		});

export const nodeUiLayer = Layer.sync(Ui)(() => {
	const interactive = Boolean(process.stdin.isTTY && process.stderr.isTTY);
	const write = (stream: NodeJS.WriteStream) => (text: string) =>
		Effect.sync(() => {
			if (text.length > 0) stream.write(text);
		});

	return Ui.of({
		interactive,
		color: interactive && process.env.NO_COLOR === undefined,
		stdout: write(process.stdout),
		stderr: write(process.stderr),
		text: (label, options) =>
			prompt((context) =>
				input(
					{
						message: label,
						...(options?.defaultValue === undefined
							? {}
							: { default: options.defaultValue }),
					},
					context,
				),
			),
		secret: (label) =>
			prompt((context) => password({ message: label, mask: false }, context)),
		select: (label, choices) =>
			prompt((context) =>
				select(
					{
						message: label,
						choices: choices.map((choice) => ({
							value: choice.value,
							name: choice.label,
							disabled: choice.disabled === true,
						})),
						default: choices.find((choice) => choice.disabled !== true)?.value,
					},
					context,
				),
			),
		confirm: (label) =>
			prompt((context) => confirm({ message: label }, context)),
		pause: (label) =>
			prompt((context) => input({ message: label, default: "" }, context)).pipe(
				Effect.asVoid,
			),
		view: viewInTerminal(),
	});
});
