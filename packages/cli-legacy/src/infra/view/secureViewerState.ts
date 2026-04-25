const minimumViewportHeight = 1;
const reservedRows = 4;

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

export const createViewerState = (input: {
	readonly envText: string;
	readonly path: string;
	readonly rows: number;
}): ViewerState => ({
	lines: input.envText.length === 0 ? [""] : input.envText.split("\n"),
	path: input.path,
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
			return {
				...state,
				scrollTop: 0,
			};
		case "end":
			return {
				...state,
				scrollTop: getMaxScrollTop(state),
			};
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
