const minimumViewportHeight = 1;
const reservedRows = 4;

const enterAlternateScreen = "\u001B[?1049h";
const exitAlternateScreen = "\u001B[?1049l";
const hideCursor = "\u001B[?25l";
const showCursor = "\u001B[?25h";

export class SecureViewerUnavailableError extends Error {
	readonly code = "VIEWER_UNAVAILABLE";
	readonly name = "SecureViewerUnavailableError";

	constructor() {
		super("Secure viewer requires an interactive TTY");
	}
}

export class SecureViewerDisplayError extends Error {
	readonly code = "VIEWER_DISPLAY_FAILED";
	readonly name = "SecureViewerDisplayError";

	constructor(cause: unknown) {
		super(`Secure viewer failed: ${String(cause)}`);
	}
}

export type ViewerAction =
	| "down"
	| "end"
	| "noop"
	| "page-down"
	| "page-up"
	| "quit"
	| "start"
	| "up";

export type ViewerState = {
	readonly lines: ReadonlyArray<string>;
	readonly path: string;
	readonly rows: number;
	readonly scrollTop: number;
};

export type ViewerKey = {
	readonly ctrl?: boolean;
	readonly name?: string;
	readonly sequence?: string;
};

export type ViewerStdin = {
	readonly isTTY?: boolean;
	readonly isRaw?: boolean;
	off(
		event: "keypress",
		listener: (input: string, key: ViewerKey) => void,
	): void;
	on(
		event: "keypress",
		listener: (input: string, key: ViewerKey) => void,
	): void;
	pause(): void;
	resume(): void;
	setRawMode(value: boolean): void;
};

export type ViewerStderr = {
	readonly isTTY?: boolean;
	readonly rows?: number;
	clearScreenDown(): void;
	cursorTo(x: number, y: number): void;
	off(event: "resize", listener: () => void): void;
	on(event: "resize", listener: () => void): void;
	write(chunk: string): void;
};

export type SecureViewerRuntime = {
	readonly emitKeypressEvents: (stream: ViewerStdin) => void;
	readonly stderr: ViewerStderr;
	readonly stdin: ViewerStdin;
};

const renderControlCharacter = (character: string) => {
	switch (character) {
		case "\t":
			return "\\t";
		case "\r":
			return "\\r";
		default:
			return `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`;
	}
};

export const sanitizeViewerText = (text: string) =>
	Array.from(text)
		.map((character) => {
			const code = character.charCodeAt(0);

			return code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)
				? renderControlCharacter(character)
				: character;
		})
		.join("");

export const createViewerState = (input: {
	readonly envText: string;
	readonly path: string;
	readonly rows: number;
}): ViewerState => ({
	lines:
		input.envText.length === 0
			? [""]
			: input.envText.split("\n").map(sanitizeViewerText),
	path: sanitizeViewerText(input.path),
	rows: input.rows,
	scrollTop: 0,
});

export const getViewportHeight = (rows: number) =>
	Math.max(minimumViewportHeight, rows - reservedRows);

const getMaxScrollTop = (state: ViewerState) =>
	Math.max(0, state.lines.length - getViewportHeight(state.rows));

const clampScrollTop = (state: ViewerState, nextScrollTop: number) =>
	Math.min(getMaxScrollTop(state), Math.max(0, nextScrollTop));

export const reduceViewerState = (
	state: ViewerState,
	action: ViewerAction,
): ViewerState => {
	switch (action) {
		case "up":
			return {
				...state,
				scrollTop: clampScrollTop(state, state.scrollTop - 1),
			};
		case "down":
			return {
				...state,
				scrollTop: clampScrollTop(state, state.scrollTop + 1),
			};
		case "page-up":
			return {
				...state,
				scrollTop: clampScrollTop(
					state,
					state.scrollTop - getViewportHeight(state.rows),
				),
			};
		case "page-down":
			return {
				...state,
				scrollTop: clampScrollTop(
					state,
					state.scrollTop + getViewportHeight(state.rows),
				),
			};
		case "start":
			return { ...state, scrollTop: 0 };
		case "end":
			return { ...state, scrollTop: getMaxScrollTop(state) };
		case "noop":
		case "quit":
			return state;
	}
};

export const renderViewerFrame = (state: ViewerState) => {
	const viewportHeight = getViewportHeight(state.rows);
	const viewportLines = state.lines.slice(
		state.scrollTop,
		state.scrollTop + viewportHeight,
	);
	const footer = `[q] quit  [j/k] move  [space/b] page  [g/G] top/bottom  ${Math.min(
		state.scrollTop + viewportHeight,
		state.lines.length,
	)}/${state.lines.length}`;

	return [
		`Viewing ${state.path}`,
		"",
		...viewportLines,
		...Array.from({
			length: Math.max(0, viewportHeight - viewportLines.length),
		}).map(() => ""),
		"",
		footer,
	].join("\n");
};

export const toViewerAction = (key: ViewerKey): ViewerAction => {
	if (key.ctrl && key.name === "c") {
		return "quit";
	}

	switch (key.name) {
		case "escape":
		case "q":
			return "quit";
		case "down":
		case "j":
			return "down";
		case "up":
		case "k":
			return "up";
		case "pageup":
			return "page-up";
		case "pagedown":
			return "page-down";
		case "g":
			return "start";
		case "G":
			return "end";
		case "space":
			return "page-down";
		case "b":
			return "page-up";
		default:
			return key.sequence === "G" ? "end" : "noop";
	}
};

const renderToScreen = (runtime: SecureViewerRuntime, frame: string) => {
	runtime.stderr.write(enterAlternateScreen);
	runtime.stderr.write(hideCursor);
	runtime.stderr.cursorTo(0, 0);
	runtime.stderr.clearScreenDown();
	runtime.stderr.write(frame);
};

const restoreScreen = (runtime: SecureViewerRuntime) => {
	runtime.stderr.write(showCursor);
	runtime.stderr.write(exitAlternateScreen);
};

export const openSecureViewer = (
	runtime: SecureViewerRuntime,
	input: {
		readonly envText: string;
		readonly path: string;
	},
): Promise<void> =>
	new Promise((resolve, reject) => {
		if (!runtime.stdin.isTTY || !runtime.stderr.isTTY) {
			reject(new SecureViewerUnavailableError());
			return;
		}

		const { stderr, stdin } = runtime;
		const previousRawMode = stdin.isRaw;
		let closed = false;
		let state = createViewerState({
			envText: input.envText,
			path: input.path,
			rows: stderr.rows ?? 24,
		});

		const cleanup = () => {
			if (closed) {
				return;
			}

			closed = true;
			stdin.off("keypress", onKeypress);
			stderr.off("resize", onResize);
			stdin.setRawMode(Boolean(previousRawMode));
			stdin.pause();
			restoreScreen(runtime);
		};

		const fail = (cause: unknown) => {
			cleanup();
			reject(new SecureViewerDisplayError(cause));
		};

		const render = () => {
			renderToScreen(runtime, renderViewerFrame(state));
		};

		const onResize = () => {
			state = { ...state, rows: stderr.rows ?? state.rows };
			try {
				render();
			} catch (cause) {
				fail(cause);
			}
		};

		const onKeypress = (_input: string, key: ViewerKey) => {
			const action = toViewerAction(key);

			if (action === "quit") {
				cleanup();
				resolve();
				return;
			}

			state = reduceViewerState(state, action);
			try {
				render();
			} catch (cause) {
				fail(cause);
			}
		};

		try {
			runtime.emitKeypressEvents(stdin);
			stdin.setRawMode(true);
			stdin.resume();
			stdin.on("keypress", onKeypress);
			stderr.on("resize", onResize);
			render();
		} catch (cause) {
			fail(cause);
		}
	});
