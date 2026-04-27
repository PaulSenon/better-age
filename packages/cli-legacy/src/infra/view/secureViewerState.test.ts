import { describe, expect, it } from "@effect/vitest";
import {
	createViewerState,
	getViewportHeight,
	reduceViewerState,
	renderViewerFrame,
	toViewerAction,
} from "./secureViewerState.js";

describe("secureViewerState", () => {
	it("maps keyboard inputs to viewer actions", () => {
		expect(toViewerAction({ name: "j" })).toBe("down");
		expect(toViewerAction({ name: "k" })).toBe("up");
		expect(toViewerAction({ name: "space" })).toBe("page-down");
		expect(toViewerAction({ name: "b" })).toBe("page-up");
		expect(toViewerAction({ name: "g" })).toBe("start");
		expect(toViewerAction({ name: "G" })).toBe("end");
		expect(toViewerAction({ ctrl: true, name: "c" })).toBe("quit");
		expect(toViewerAction({ name: "escape" })).toBe("quit");
	});

	it("moves within scroll bounds", () => {
		const initialState = createViewerState({
			envText: Array.from({ length: 20 })
				.map((_, index) => `LINE_${index + 1}`)
				.join("\n"),
			path: "./.env.enc",
			rows: 10,
		});

		const pagedDownState = reduceViewerState(initialState, "page-down");
		const movedToEndState = reduceViewerState(initialState, "end");
		const movedUpPastTopState = reduceViewerState(initialState, "up");

		expect(getViewportHeight(initialState.rows)).toBe(6);
		expect(pagedDownState.scrollTop).toBe(6);
		expect(movedToEndState.scrollTop).toBe(14);
		expect(movedUpPastTopState.scrollTop).toBe(0);
	});

	it("renders header, viewport, and footer", () => {
		const state = createViewerState({
			envText: ["A=1", "B=2", "C=3", "D=4"].join("\n"),
			path: "./.env.enc",
			rows: 7,
		});

		expect(renderViewerFrame(state)).toBe(
			[
				"Viewing ./.env.enc",
				"",
				"A=1",
				"B=2",
				"C=3",
				"",
				"[q] quit  [j/k] move  [space/b] page  [g/G] top/bottom  3/4",
			].join("\n"),
		);
	});
});
