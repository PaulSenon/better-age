import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
	makeNodeEditor,
	parseEditorCommand,
	type SpawnLike,
} from "./nodeEditor.js";

const makeSpawn = (input?: {
	readonly exitCode?: number;
	readonly signal?: NodeJS.Signals | null;
}) => {
	const calls: Array<{
		readonly args: ReadonlyArray<string>;
		readonly command: string;
	}> = [];
	const closeListeners: Array<
		(code: number | null, signal: NodeJS.Signals | null) => void
	> = [];

	const spawn: SpawnLike = (command, args) => {
		calls.push({
			args,
			command,
		});
		const child = {
			once(
				event: "close" | "error",
				listener:
					| ((code: number | null, signal: NodeJS.Signals | null) => void)
					| ((error: Error) => void),
			) {
				if (event === "close") {
					closeListeners.push(
						listener as (
							code: number | null,
							signal: NodeJS.Signals | null,
						) => void,
					);
				}
				return child;
			},
			stderr: null,
			stdout: null,
		};
		queueMicrotask(() => {
			for (const listener of closeListeners) {
				listener(input?.exitCode ?? 0, input?.signal ?? null);
			}
		});

		return child;
	};

	return { calls, spawn };
};

describe("nodeEditor", () => {
	it("parses command and args", () => {
		expect(parseEditorCommand("vim -f")).toEqual({
			args: ["-f"],
			command: "vim",
		});
	});

	it("fails when configured command is blank", async () => {
		const editor = makeNodeEditor({
			spawn: makeSpawn().spawn,
		});

		const result = await Effect.runPromise(
			editor.editFile({ command: "", path: "/tmp/file" }).pipe(Effect.either),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("EditorLaunchError");
		}
	});

	it("launches editor with file path and waits for exit", async () => {
		const { calls, spawn } = makeSpawn();
		const editor = makeNodeEditor({
			spawn,
		});

		await Effect.runPromise(
			editor.editFile({ command: "vim", path: "/tmp/file.env" }),
		);

		expect(calls).toEqual([
			{
				args: ["/tmp/file.env"],
				command: "vim",
			},
		]);
	});

	it("fails when editor exits non-zero", async () => {
		const editor = makeNodeEditor({
			spawn: makeSpawn({ exitCode: 1 }).spawn,
		});

		const result = await Effect.runPromise(
			editor
				.editFile({ command: "vim", path: "/tmp/file" })
				.pipe(Effect.either),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("EditorExitError");
		}
	});
});
