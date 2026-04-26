import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createNodeTerminal } from "./nodeTerminal.js";

const makeRuntime = (inputIsTty: boolean, errorIsTty: boolean) => ({
	emitKeypressEvents: vi.fn(),
	env: {},
	stderr: {
		clearScreenDown: vi.fn(),
		cursorTo: vi.fn(),
		isTTY: errorIsTty,
		off: vi.fn(),
		on: vi.fn(),
		rows: 24,
		write: vi.fn(),
	},
	stdin: Object.assign(new EventEmitter(), {
		isRaw: false,
		isTTY: inputIsTty,
		pause: vi.fn(),
		resume: vi.fn(),
		setEncoding: vi.fn(),
		setRawMode: vi.fn(),
	}),
});

describe("node terminal", () => {
	it("does not expose prompts without an interactive stdin and stderr TTY", () => {
		const terminal = createNodeTerminal(makeRuntime(false, true));

		expect(terminal.mode).toBe("headless");
		expect(terminal.presentation).toEqual({ color: false });
		expect(terminal.promptSecret).toBeUndefined();
		expect(terminal.promptText).toBeUndefined();
	});

	it("exposes hidden secret input only for interactive TTYs", () => {
		const terminal = createNodeTerminal(makeRuntime(true, true));

		expect(terminal.mode).toBe("interactive");
		expect(terminal.presentation).toEqual({ color: true });
		expect(terminal.promptSecret).toBeTypeOf("function");
		expect(terminal.promptText).toBeTypeOf("function");
	});

	it("disables color when NO_COLOR is present", () => {
		const runtime = { ...makeRuntime(true, true), env: { NO_COLOR: "1" } };
		const terminal = createNodeTerminal(runtime);

		expect(terminal.presentation).toEqual({ color: false });
	});

	it("exposes secure viewer only for interactive TTYs", async () => {
		const runtime = makeRuntime(true, true);
		const terminal = createNodeTerminal(runtime);

		const opened = terminal.openViewer?.("A=1", "secrets.env.enc");

		runtime.stdin.emit("keypress", "", { name: "q" });

		await expect(opened).resolves.toBeUndefined();
		expect(runtime.stderr.write).toHaveBeenCalledWith(
			expect.stringContaining("Viewing secrets.env.enc"),
		);
	});
});
