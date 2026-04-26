import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createNodeTerminal } from "./nodeTerminal.js";

const makeRuntime = (inputIsTty: boolean, errorIsTty: boolean) => ({
	stderr: {
		isTTY: errorIsTty,
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
		expect(terminal.promptSecret).toBeUndefined();
		expect(terminal.promptText).toBeUndefined();
	});

	it("exposes hidden secret input only for interactive TTYs", () => {
		const terminal = createNodeTerminal(makeRuntime(true, true));

		expect(terminal.mode).toBe("interactive");
		expect(terminal.promptSecret).toBeTypeOf("function");
		expect(terminal.promptText).toBeTypeOf("function");
	});
});
