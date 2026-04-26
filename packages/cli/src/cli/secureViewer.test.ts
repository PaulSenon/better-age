import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
	createViewerState,
	openSecureViewer,
	reduceViewerState,
	renderViewerFrame,
	type SecureViewerRuntime,
	toViewerAction,
} from "./secureViewer.js";

const makeRuntime = (
	inputIsTty = true,
	errorIsTty = true,
): SecureViewerRuntime & {
	readonly stderrWrites: Array<string>;
	readonly stdin: SecureViewerRuntime["stdin"] &
		EventEmitter & {
			readonly isTTY: boolean;
			isRaw: boolean;
			readonly pause: ReturnType<typeof vi.fn>;
			readonly resume: ReturnType<typeof vi.fn>;
			readonly setRawMode: ReturnType<typeof vi.fn>;
		};
} => {
	const stderrWrites: Array<string> = [];
	const fakeStdin = Object.assign(new EventEmitter(), {
		isRaw: false,
		isTTY: inputIsTty,
		pause: vi.fn(),
		resume: vi.fn(),
		setRawMode: vi.fn((value: boolean) => {
			fakeStdin.isRaw = value;
		}),
	});
	const runtime = {
		emitKeypressEvents: vi.fn(),
		stderr: Object.assign(new EventEmitter(), {
			clearScreenDown: vi.fn(),
			cursorTo: vi.fn(),
			isTTY: errorIsTty,
			rows: 6,
			write: vi.fn((chunk: string) => {
				stderrWrites.push(chunk);
			}),
		}),
		stderrWrites,
		stdin: fakeStdin,
	};

	return runtime;
};

describe("secure viewer state", () => {
	it("renders only the visible plaintext viewport and footer", () => {
		const state = createViewerState({
			envText: "A=1\nB=2\nC=3\nD=4",
			path: "secrets.env.enc",
			rows: 6,
		});

		const frame = renderViewerFrame(state);

		expect(frame).toContain("Viewing secrets.env.enc");
		expect(frame).toContain("A=1\nB=2");
		expect(frame).not.toContain("C=3");
		expect(frame).toContain("[q] quit");
		expect(frame).toContain("2/4");
	});

	it("scrolls and clamps long payloads", () => {
		const state = createViewerState({
			envText: "A\nB\nC\nD",
			path: "secrets.env.enc",
			rows: 6,
		});

		const bottom = reduceViewerState(state, "end");
		const pastBottom = reduceViewerState(bottom, "down");
		const top = reduceViewerState(bottom, "page-up");

		expect(bottom.scrollTop).toBe(2);
		expect(pastBottom.scrollTop).toBe(2);
		expect(top.scrollTop).toBe(0);
	});

	it("maps terminal keys to viewer actions", () => {
		expect(toViewerAction({ name: "q" })).toBe("quit");
		expect(toViewerAction({ ctrl: true, name: "c" })).toBe("quit");
		expect(toViewerAction({ name: "down" })).toBe("down");
		expect(toViewerAction({ name: "space" })).toBe("page-down");
		expect(toViewerAction({ sequence: "G" })).toBe("end");
	});
});

describe("secure viewer runtime", () => {
	it("opens on stderr, scrolls, and quits cleanly", async () => {
		const runtime = makeRuntime();

		const opened = openSecureViewer(runtime, {
			envText: "A=1\nB=2\nC=3",
			path: "secrets.env.enc",
		});

		runtime.stdin.emit("keypress", "", { name: "j" });
		runtime.stdin.emit("keypress", "", { name: "q" });

		await expect(opened).resolves.toBeUndefined();
		expect(runtime.emitKeypressEvents).toHaveBeenCalledWith(runtime.stdin);
		expect(runtime.stdin.resume).toHaveBeenCalledOnce();
		expect(runtime.stdin.setRawMode).toHaveBeenNthCalledWith(1, true);
		expect(runtime.stdin.setRawMode).toHaveBeenLastCalledWith(false);
		expect(runtime.stdin.pause).toHaveBeenCalledOnce();
		expect(runtime.stderrWrites.join("")).toContain("A=1");
		expect(runtime.stderrWrites.join("")).toContain("C=3");
		expect(runtime.stderrWrites.join("")).toContain("\u001B[?1049h");
		expect(runtime.stderrWrites.join("")).toContain("\u001B[?1049l");
	});

	it("fails explicitly when no interactive TTY is available", async () => {
		const runtime = makeRuntime(false, true);

		await expect(
			openSecureViewer(runtime, {
				envText: "A=1",
				path: "secrets.env.enc",
			}),
		).rejects.toMatchObject({ code: "VIEWER_UNAVAILABLE" });
	});
});
