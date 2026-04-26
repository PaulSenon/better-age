import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import type { NodePromptFunctions } from "./nodePromptAdapter.js";
import { createNodeTerminal } from "./nodeTerminal.js";
import { CliPromptCancelledError } from "./secretPrompt.js";

const makePromptFns = (
	overrides: Partial<NodePromptFunctions> = {},
): NodePromptFunctions => ({
	confirm: vi.fn(async () => true),
	input: vi.fn(async () => ""),
	password: vi.fn(async () => "secret"),
	select: vi.fn(async () => "beta"),
	...overrides,
});

const makeRuntime = (inputIsTty: boolean, errorIsTty: boolean) => ({
	emitKeypressEvents: vi.fn(),
	env: {},
	promptFns: makePromptFns(),
	stderr: {
		clearScreenDown: vi.fn(),
		cursorTo: vi.fn(),
		isTTY: errorIsTty,
		off: vi.fn(),
		on: vi.fn(),
		rows: 24,
		write: vi.fn(),
	},
	stdout: {
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

	it("routes text, password, and pause prompts through Inquirer", async () => {
		const runtime = makeRuntime(true, true);
		runtime.promptFns = makePromptFns({
			input: vi.fn(async () => "typed"),
			password: vi.fn(async () => "hidden"),
		});
		const terminal = createNodeTerminal(runtime);

		await expect(terminal.promptText?.("Name")).resolves.toBe("typed");
		await expect(terminal.promptSecret?.("Passphrase")).resolves.toBe("hidden");
		await expect(
			terminal.waitForEnter?.("Press Enter"),
		).resolves.toBeUndefined();

		expect(runtime.promptFns.input).toHaveBeenNthCalledWith(
			1,
			{ message: "Name" },
			expect.objectContaining({
				input: runtime.stdin,
				output: runtime.stderr,
			}),
		);
		expect(runtime.promptFns.password).toHaveBeenCalledWith(
			{ mask: "*", message: "Passphrase" },
			expect.objectContaining({
				input: runtime.stdin,
				output: runtime.stderr,
			}),
		);
		expect(runtime.promptFns.input).toHaveBeenNthCalledWith(
			2,
			{ default: "", message: "Press Enter" },
			expect.objectContaining({
				input: runtime.stdin,
				output: runtime.stderr,
			}),
		);
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

	it("selects choices through the Inquirer prompt adapter", async () => {
		const runtime = makeRuntime(true, true);
		const terminal = createNodeTerminal(runtime);

		await expect(
			terminal.selectOne?.("Pick", [
				{ value: "alpha", label: "Alpha", disabled: false },
				{ value: "beta", label: "Beta", disabled: false },
			]),
		).resolves.toBe("beta");
		expect(runtime.promptFns.select).toHaveBeenCalledWith(
			{
				choices: [
					{ value: "alpha", name: "Alpha" },
					{ value: "beta", name: "Beta" },
				],
				default: "alpha",
				message: "Pick",
			},
			expect.objectContaining({
				input: runtime.stdin,
				output: runtime.stderr,
			}),
		);
		expect(runtime.emitKeypressEvents).not.toHaveBeenCalled();
		expect(runtime.stdin.setRawMode).not.toHaveBeenCalled();
	});

	it("normalizes Inquirer selection cancellation", async () => {
		const runtime = makeRuntime(true, true);
		runtime.promptFns = makePromptFns({
			select: vi.fn(async () => {
				const error = new Error("User force closed the prompt");
				error.name = "ExitPromptError";
				throw error;
			}),
		});
		const terminal = createNodeTerminal(runtime);

		await expect(
			terminal.selectOne?.("Pick", [
				{ value: "alpha", label: "Alpha", disabled: false },
			]),
		).rejects.toBeInstanceOf(CliPromptCancelledError);
	});

	it("writes interactive command results directly to stdout and stderr", async () => {
		const runtime = makeRuntime(true, true);
		const terminal = createNodeTerminal(runtime);

		await terminal.writeResult?.({
			exitCode: 0,
			stdout: "bage-id-v1:abc123\n",
			stderr: "[OK] done\n",
		});

		expect(runtime.stdout.write).toHaveBeenCalledWith("bage-id-v1:abc123\n");
		expect(runtime.stderr.write).toHaveBeenCalledWith("[OK] done\n");
	});
});
