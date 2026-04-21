import { emitKeypressEvents } from "node:readline";
import { Effect, Layer } from "effect";
import { SecureViewer } from "../../port/SecureViewer.js";
import {
	SecureViewerDisplayError,
	SecureViewerUnavailableError,
} from "../../port/SecureViewerError.js";
import {
	createViewerState,
	reduceViewerState,
	renderViewerFrame,
	toViewerAction,
	type ViewerKey,
} from "./secureViewerState.js";

const enterAlternateScreen = "\u001B[?1049h";
const exitAlternateScreen = "\u001B[?1049l";
const hideCursor = "\u001B[?25l";
const showCursor = "\u001B[?25h";

type ViewerStdin = {
	readonly isRaw?: boolean;
	readonly isTTY?: boolean;
	off: (
		event: "keypress",
		listener: (_input: string, key: ViewerKey) => void,
	) => void;
	on: (
		event: "keypress",
		listener: (_input: string, key: ViewerKey) => void,
	) => void;
	pause: () => void;
	resume: () => void;
	setRawMode: (value: boolean) => void;
};

type ViewerStderr = {
	readonly isTTY?: boolean;
	readonly rows?: number;
	clearScreenDown: () => void;
	cursorTo: (x: number, y: number) => void;
	off: (event: "resize", listener: () => void) => void;
	on: (event: "resize", listener: () => void) => void;
	write: (chunk: string) => void;
};

type SecureViewerRuntime = {
	readonly emitKeypressEvents: (stream: ViewerStdin) => void;
	readonly stderr: ViewerStderr;
	readonly stdin: ViewerStdin;
};

const defaultRuntime: SecureViewerRuntime = {
	emitKeypressEvents: (stream) => {
		emitKeypressEvents(stream as NodeJS.ReadStream);
	},
	stderr: process.stderr,
	stdin: process.stdin,
};

const ensureViewerTty = (runtime: SecureViewerRuntime) =>
	Effect.sync(() => {
		if (!runtime.stdin.isTTY || !runtime.stderr.isTTY) {
			throw new SecureViewerUnavailableError({
				message:
					"Secure viewer is unavailable in this environment. Use an interactive TTY.",
			});
		}
	});

const renderToScreen = (runtime: SecureViewerRuntime, frame: string) =>
	Effect.try({
		try: () => {
			runtime.stderr.write(enterAlternateScreen);
			runtime.stderr.write(hideCursor);
			runtime.stderr.cursorTo(0, 0);
			runtime.stderr.clearScreenDown();
			runtime.stderr.write(frame);
		},
		catch: (cause) =>
			new SecureViewerDisplayError({
				message: `Failed to render secure viewer: ${String(cause)}`,
			}),
	});

const restoreScreen = (runtime: SecureViewerRuntime) =>
	Effect.sync(() => {
		runtime.stderr.write(showCursor);
		runtime.stderr.write(exitAlternateScreen);
	});

export const makeNodeSecureViewer = (
	runtime: SecureViewerRuntime = defaultRuntime,
) =>
	SecureViewer.make({
		view: (input) =>
			ensureViewerTty(runtime).pipe(
				Effect.flatMap(() =>
					Effect.async<void, SecureViewerDisplayError>((resume) => {
						const { stderr, stdin } = runtime;
						const previousRawMode = stdin.isRaw;
						let state = createViewerState({
							envText: input.envText,
							path: input.path,
							rows: stderr.rows ?? 24,
						});

						const cleanup = () => {
							stdin.off("keypress", onKeypress);
							stderr.off("resize", onResize);
							if (stdin.isTTY) {
								stdin.setRawMode(Boolean(previousRawMode));
								stdin.pause();
							}
							restoreScreen(runtime).pipe(Effect.runSync);
						};

						const onResize = () => {
							state = {
								...state,
								rows: stderr.rows ?? state.rows,
							};
							const result = renderToScreen(
								runtime,
								renderViewerFrame(state),
							).pipe(Effect.either);
							const rendered = Effect.runSync(result);

							if (rendered._tag === "Left") {
								cleanup();
								resume(Effect.fail(rendered.left));
							}
						};

						const onKeypress = (_input: string, key: ViewerKey) => {
							const action = toViewerAction(key);

							if (action === "quit") {
								cleanup();
								resume(Effect.void);
								return;
							}

							state = reduceViewerState(state, action);
							const result = renderToScreen(
								runtime,
								renderViewerFrame(state),
							).pipe(Effect.either);
							const rendered = Effect.runSync(result);

							if (rendered._tag === "Left") {
								cleanup();
								resume(Effect.fail(rendered.left));
							}
						};

						try {
							runtime.emitKeypressEvents(stdin);
							stdin.setRawMode(true);
							stdin.resume();
							stdin.on("keypress", onKeypress);
							stderr.on("resize", onResize);
							Effect.runSync(renderToScreen(runtime, renderViewerFrame(state)));
						} catch (cause) {
							cleanup();
							resume(
								Effect.fail(
									new SecureViewerDisplayError({
										message: `Failed to launch secure viewer: ${String(cause)}`,
									}),
								),
							);
						}

						return Effect.sync(cleanup);
					}),
				),
			),
	});

export const NodeSecureViewerLive = Layer.succeed(
	SecureViewer,
	makeNodeSecureViewer(),
);
