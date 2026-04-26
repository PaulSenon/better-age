import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type NodeEditorResult =
	| { readonly kind: "saved"; readonly text: string }
	| {
			readonly kind: "failure";
			readonly code: "EDITOR_EXIT_NON_ZERO" | "EDITOR_UNAVAILABLE";
	  };

export type NodeEditorChoice = {
	readonly value: string;
	readonly label: string;
	readonly disabled: boolean;
};

export type NodeEditorRuntime = {
	readonly commandExists: (command: string) => Promise<boolean>;
	readonly confirm?: (label: string) => Promise<boolean>;
	readonly createTempFile: (initialText: string) => Promise<string>;
	readonly env: Partial<Record<"EDITOR" | "VISUAL", string | undefined>>;
	readonly getSavedEditorCommand: () => Promise<string | null>;
	readonly isInteractive: boolean;
	readonly readTempFile: (path: string) => Promise<string>;
	readonly removeTempFile: (path: string) => Promise<void>;
	readonly selectOne?: (
		label: string,
		choices: ReadonlyArray<NodeEditorChoice>,
	) => Promise<string>;
	readonly setSavedEditorCommand: (command: string) => Promise<void>;
	readonly spawnEditor: (
		command: string,
		args: ReadonlyArray<string>,
	) => Promise<{
		readonly exitCode: number | null;
		readonly signal?: string | null;
	}>;
};

const commonEditors = ["nano", "vi", "vim", "nvim"] as const;

export const parseEditorCommand = (
	editorCommand: string,
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
	const [command, ...args] = editorCommand.trim().split(/\s+/);

	if (command === undefined || command.length === 0) {
		return { command: "", args: [] };
	}

	return { command, args };
};

const editorCommandExists = async (
	runtime: NodeEditorRuntime,
	editorCommand: string,
) => {
	const parsed = parseEditorCommand(editorCommand);

	return (
		parsed.command.length > 0 && (await runtime.commandExists(parsed.command))
	);
};

const resolveEditorCommand = async (
	runtime: NodeEditorRuntime,
): Promise<string | null> => {
	const envEditor = runtime.env.VISUAL ?? runtime.env.EDITOR;

	if (envEditor !== undefined && envEditor.trim().length > 0) {
		return (await editorCommandExists(runtime, envEditor)) ? envEditor : null;
	}

	const savedEditor = await runtime.getSavedEditorCommand();

	if (
		savedEditor !== null &&
		savedEditor.trim().length > 0 &&
		(await editorCommandExists(runtime, savedEditor))
	) {
		return savedEditor;
	}

	if (!runtime.isInteractive || runtime.selectOne === undefined) {
		return null;
	}

	const choices = await Promise.all(
		commonEditors.map(async (editor) => ({
			value: editor,
			label: editor,
			disabled: !(await runtime.commandExists(editor)),
		})),
	);
	const selected = await runtime.selectOne("Editor", choices);

	if (!(await editorCommandExists(runtime, selected))) {
		return null;
	}

	if ((await runtime.confirm?.("Remember editor?")) === true) {
		await runtime.setSavedEditorCommand(selected);
	}

	return selected;
};

export const openNodeEditor = async (
	runtime: NodeEditorRuntime,
	initialText: string,
): Promise<NodeEditorResult> => {
	const editorCommand = await resolveEditorCommand(runtime);

	if (editorCommand === null) {
		return { kind: "failure", code: "EDITOR_UNAVAILABLE" };
	}

	const parsed = parseEditorCommand(editorCommand);
	const tempPath = await runtime.createTempFile(initialText);

	try {
		const exit = await runtime.spawnEditor(parsed.command, [
			...parsed.args,
			tempPath,
		]);

		if (exit.exitCode !== 0) {
			return { kind: "failure", code: "EDITOR_EXIT_NON_ZERO" };
		}

		return { kind: "saved", text: await runtime.readTempFile(tempPath) };
	} finally {
		await runtime.removeTempFile(tempPath).catch(() => undefined);
	}
};

const defaultCreateTempFile = async (initialText: string) => {
	const directory = await mkdtemp(join(tmpdir(), "better-age-edit-"));
	const path = join(directory, "payload.env");

	await writeFile(path, initialText, "utf8");

	return path;
};

export const createDefaultNodeEditorRuntime = (input: {
	readonly confirm?: NodeEditorRuntime["confirm"];
	readonly getSavedEditorCommand: () => Promise<string | null>;
	readonly isInteractive: boolean;
	readonly selectOne?: NodeEditorRuntime["selectOne"];
	readonly setSavedEditorCommand: (command: string) => Promise<void>;
}): NodeEditorRuntime => ({
	...(input.confirm === undefined ? {} : { confirm: input.confirm }),
	...(input.selectOne === undefined ? {} : { selectOne: input.selectOne }),
	commandExists: async (command) =>
		await new Promise<boolean>((resolve) => {
			const child = spawn(
				"sh",
				["-c", `command -v "$1" >/dev/null 2>&1`, "sh", command],
				{
					stdio: "ignore",
				},
			);
			child.on("error", () => resolve(false));
			child.on("exit", (code) => resolve(code === 0));
		}),
	createTempFile: defaultCreateTempFile,
	env: {
		EDITOR: process.env.EDITOR,
		VISUAL: process.env.VISUAL,
	},
	getSavedEditorCommand: input.getSavedEditorCommand,
	isInteractive: input.isInteractive,
	readTempFile: async (path) => await readFile(path, "utf8"),
	removeTempFile: async (path) => {
		await rm(path, { force: true });
		await rm(dirname(path), { force: true, recursive: true });
	},
	setSavedEditorCommand: input.setSavedEditorCommand,
	spawnEditor: async (command, args) =>
		await new Promise((resolve) => {
			const child = spawn(command, args, { stdio: "inherit" });
			child.on("error", () => resolve({ exitCode: 1 }));
			child.on("exit", (exitCode, signal) => resolve({ exitCode, signal }));
		}),
});
