import { describe, expect, it, vi } from "vitest";
import {
	type NodeEditorRuntime,
	openNodeEditor,
	parseEditorCommand,
} from "./nodeEditor.js";

const makeRuntime = (
	overrides: Partial<NodeEditorRuntime> = {},
): NodeEditorRuntime & {
	readonly cleanupCalls: Array<string>;
	readonly savedCommands: Array<string>;
	readonly spawned: Array<{
		readonly command: string;
		readonly args: ReadonlyArray<string>;
	}>;
} => {
	let tempText = "API_KEY=old\n";
	const cleanupCalls: Array<string> = [];
	const savedCommands: Array<string> = [];
	const spawned: Array<{
		readonly command: string;
		readonly args: ReadonlyArray<string>;
	}> = [];
	const runtime: NodeEditorRuntime & {
		readonly cleanupCalls: Array<string>;
		readonly savedCommands: Array<string>;
		readonly spawned: Array<{
			readonly command: string;
			readonly args: ReadonlyArray<string>;
		}>;
	} = {
		cleanupCalls,
		commandExists: async (command) =>
			["code", "nano", "nvim", "vi", "vim"].includes(command),
		createTempFile: async (initialText) => {
			tempText = initialText;
			return "/tmp/bage-edit.env";
		},
		env: {},
		isInteractive: true,
		readTempFile: async () => tempText,
		removeTempFile: async (path) => {
			cleanupCalls.push(path);
		},
		savedCommands,
		selectOne: async (_label, choices) =>
			choices.find((choice) => !choice.disabled)?.value ?? "",
		setSavedEditorCommand: async (command) => {
			savedCommands.push(command);
		},
		getSavedEditorCommand: async () => null,
		spawnEditor: async (command, args) => {
			spawned.push({ command, args });
			tempText = "API_KEY=new\n";
			return { exitCode: 0 };
		},
		spawned,
		...overrides,
	};

	return runtime;
};

describe("node editor", () => {
	it("parses editor command strings", () => {
		expect(parseEditorCommand("code --wait")).toEqual({
			command: "code",
			args: ["--wait"],
		});
	});

	it("uses VISUAL before saved preference and never writes plaintext to stdout", async () => {
		const runtime = makeRuntime({
			env: { EDITOR: "vim", VISUAL: "code --wait" },
			getSavedEditorCommand: async () => "nvim",
		});

		await expect(openNodeEditor(runtime, "API_KEY=old\n")).resolves.toEqual({
			kind: "saved",
			text: "API_KEY=new\n",
		});
		expect(runtime.spawned).toEqual([
			{ command: "code", args: ["--wait", "/tmp/bage-edit.env"] },
		]);
		expect(runtime.savedCommands).toEqual([]);
		expect(runtime.cleanupCalls).toEqual(["/tmp/bage-edit.env"]);
	});

	it("uses saved preference when available", async () => {
		const runtime = makeRuntime({
			getSavedEditorCommand: async () => "nvim",
		});

		await openNodeEditor(runtime, "API_KEY=old\n");

		expect(runtime.spawned).toEqual([
			{ command: "nvim", args: ["/tmp/bage-edit.env"] },
		]);
	});

	it("falls back from missing saved editor to picker and persists remember choice", async () => {
		const runtime = makeRuntime({
			commandExists: async (command) => command === "vim",
			getSavedEditorCommand: async () => "missing-editor",
			selectOne: vi
				.fn()
				.mockResolvedValueOnce("vim")
				.mockResolvedValueOnce("remember"),
		});

		await openNodeEditor(runtime, "API_KEY=old\n");

		expect(runtime.spawned).toEqual([
			{ command: "vim", args: ["/tmp/bage-edit.env"] },
		]);
		expect(runtime.savedCommands).toEqual(["vim"]);
		expect(runtime.selectOne).toHaveBeenCalledWith(
			"Editor",
			expect.arrayContaining([
				{ disabled: true, label: "nano", value: "nano" },
				{ disabled: false, label: "vim", value: "vim" },
			]),
		);
	});

	it("does not persist one-time picker choice", async () => {
		const runtime = makeRuntime({
			commandExists: async (command) => command === "vi",
			selectOne: vi
				.fn()
				.mockResolvedValueOnce("vi")
				.mockResolvedValueOnce("once"),
		});

		await openNodeEditor(runtime, "API_KEY=old\n");

		expect(runtime.savedCommands).toEqual([]);
	});

	it("fails explicitly and still cleans up when editor exits non-zero", async () => {
		const runtime = makeRuntime({
			env: { EDITOR: "vim" },
			spawnEditor: async () => ({ exitCode: 1 }),
		});

		await expect(openNodeEditor(runtime, "API_KEY=old\n")).resolves.toEqual({
			code: "EDITOR_EXIT_NON_ZERO",
			kind: "failure",
		});
		expect(runtime.cleanupCalls).toEqual(["/tmp/bage-edit.env"]);
	});
});
