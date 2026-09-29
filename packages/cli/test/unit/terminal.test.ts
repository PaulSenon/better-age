import { EventEmitter } from "node:events";
import { Effect, Exit, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";
import { identityLabel, sanitize, style } from "../../src/present.js";
import { type ViewerTerminal, viewInTerminal } from "../../src/ui/nodeUi.js";
import {
	createViewerState,
	reduceViewerState,
	renderViewerFrame,
	toViewerAction,
} from "../../src/ui/secureViewer.js";

const makeTerminal = (isTTY = true) => {
	const writes: Array<string> = [];
	const stdin = Object.assign(new EventEmitter(), {
		isTTY,
		isRaw: false,
		setRawMode: vi.fn(function (this: { isRaw: boolean }, value: boolean) {
			stdin.isRaw = value;
			return stdin;
		}),
		resume: vi.fn(),
		pause: vi.fn(),
	});
	const stderr = Object.assign(new EventEmitter(), {
		isTTY,
		rows: 6,
		write: vi.fn((chunk: string) => writes.push(chunk) > 0),
		cursorTo: vi.fn(() => true),
		clearScreenDown: vi.fn(() => true),
	});
	const terminal = {
		stdin,
		stderr,
		emitKeypressEvents: vi.fn(),
	} as unknown as ViewerTerminal;

	return { terminal, stdin, writes };
};

describe("secure viewer model", () => {
	it("renders only the visible viewport, footer, and visible control chars", () => {
		const frame = renderViewerFrame(
			createViewerState({
				envText: "A=1\nB=\u001B]52;c;secret\u0007\nC=3\nD=4",
				path: "secrets.env.enc",
				rows: 6,
			}),
		);

		expect(frame).toContain("Viewing secrets.env.enc");
		expect(frame).toContain("A=1\nB=\\x1b]52;c;secret\\x07");
		expect(frame).not.toContain("\u001B]52");
		expect(frame).not.toContain("C=3");
		expect(frame).toContain("2/4");
	});

	it("scrolls, clamps, and maps keys", () => {
		const state = createViewerState({
			envText: "A\nB\nC\nD",
			path: "p",
			rows: 6,
		});
		const bottom = reduceViewerState(state, "end");

		expect(bottom.scrollTop).toBe(2);
		expect(reduceViewerState(bottom, "down").scrollTop).toBe(2);
		expect(reduceViewerState(bottom, "page-up").scrollTop).toBe(0);
		expect(toViewerAction({ name: "q" })).toBe("quit");
		expect(toViewerAction({ ctrl: true, name: "c" })).toBe("abort");
		expect(toViewerAction({ name: "space" })).toBe("page-down");
		expect(toViewerAction({ sequence: "G" })).toBe("end");
	});
});

describe("secure viewer runtime", () => {
	it("renders on stderr and restores the terminal on quit", async () => {
		const { terminal, stdin, writes } = makeTerminal();
		const done = Effect.runPromise(viewInTerminal(terminal)("A=1\n", "p"));

		stdin.emit("keypress", "j", { name: "j" });
		stdin.emit("keypress", "q", { name: "q" });
		await done;

		expect(writes.join("")).toContain("A=1");
		expect(writes.at(-1)).toBe("\u001B[?25h\u001B[?1049l");
		expect(stdin.isRaw).toBe(false);
		expect(stdin.listenerCount("keypress")).toBe(0);
	});

	it("aborts with CANCELLED on Ctrl-C and still restores the terminal", async () => {
		const { terminal, stdin, writes } = makeTerminal();
		const done = Effect.runPromiseExit(viewInTerminal(terminal)("A", "p"));

		stdin.emit("keypress", "\u0003", { ctrl: true, name: "c" });
		const exit = await done;

		expect(Exit.isFailure(exit)).toBe(true);
		expect(JSON.stringify(exit)).toContain('"abort":true');
		expect(writes.at(-1)).toBe("\u001B[?25h\u001B[?1049l");
		expect(stdin.isRaw).toBe(false);
	});

	it("restores the terminal when interrupted (e.g. SIGINT)", async () => {
		const { terminal, stdin, writes } = makeTerminal();
		const exit = await Effect.runPromise(
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					viewInTerminal(terminal)("A", "p"),
				);
				yield* Effect.yieldNow;
				yield* Fiber.interrupt(fiber);
				return yield* Fiber.await(fiber);
			}),
		);

		expect(Exit.hasInterrupts(exit)).toBe(true);
		expect(writes.at(-1)).toBe("\u001B[?25h\u001B[?1049l");
		expect(stdin.isRaw).toBe(false);
	});

	it("refuses to render without a TTY", async () => {
		const { terminal } = makeTerminal(false);
		const exit = await Effect.runPromiseExit(
			viewInTerminal(terminal)("A", "p"),
		);

		expect(exit).toMatchObject({
			_tag: "Failure",
			cause: expect.anything(),
		});
		expect(JSON.stringify(exit)).toContain("VIEWER_UNAVAILABLE");
	});
});

describe("presentation", () => {
	it("makes bidi overrides and zero-width characters visible", () => {
		expect(sanitize("evil\u202Egnp.exe\u200B")).toBe(
			"evil\\u{202e}gnp.exe\\u{200b}",
		);
	});

	it("neutralizes terminal control sequences in untrusted text", () => {
		expect(sanitize("Nora\u001b]0;x\u0007\r\t")).toBe(
			"Nora\\x1b]0;x\\x07\\r\\t",
		);
		expect(
			identityLabel({
				displayName: "A\u001b[2J",
				ownerId: "o",
				localAlias: null,
			}),
		).toBe("A\\x1b[2J o");
	});

	it("styles only the label of human stderr lines", () => {
		expect(style("[OK] done\n")).toBe("\u001B[32m[OK]\u001B[0m done\n");
		expect(style("[ERROR] CODE: msg\n")).toBe(
			"\u001B[31m[ERROR]\u001B[0m \u001B[1mCODE:\u001B[0m msg\n",
		);
	});
});
