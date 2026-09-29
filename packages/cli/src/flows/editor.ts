// External editor for payload plaintext. Resolution order: $VISUAL, $EDITOR,
// remembered preference, then (interactive) a picker whose choice can be
// remembered. Editor commands may carry args (e.g. `code --wait`).
//
// Plaintext lives in a private temp dir (0700, file 0600, random name) that is
// removed when the scope closes — including on Ctrl-C/interruption. Editor
// swap files/backups remain outside Better Age's control (documented risk).
import * as Home from "@better-age/core/Home";
import { Config, Crypto, Effect, FileSystem, Option, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { CliFailure } from "../failures.js";
import { Ui } from "../ui/Ui.js";

const commonEditors = ["nano", "vi", "vim", "nvim"] as const;

export const parseEditorCommand = (editorCommand: string) => {
	const [command = "", ...args] = editorCommand.trim().split(/\s+/);
	return { command, args };
};

const commandExists = Effect.fnUntraced(function* (editorCommand: string) {
	const { command } = parseEditorCommand(editorCommand);

	if (command.length === 0) {
		return false;
	}

	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const exitCode = yield* spawner
		.exitCode(
			ChildProcess.make(
				"sh",
				["-c", 'command -v "$1" >/dev/null 2>&1', "sh", command],
				{ stdin: "ignore", stdout: "ignore", stderr: "ignore" },
			),
		)
		.pipe(Effect.orElseSucceed(() => 1));

	return exitCode === 0;
});

const envEditor = Config.String("VISUAL").pipe(
	Config.orElse(() => Config.String("EDITOR")),
	Config.option,
);

const resolveEditorCommand = Effect.gen(function* () {
	const fromEnv = yield* Effect.orDie(envEditor);

	if (Option.isSome(fromEnv) && fromEnv.value.trim().length > 0) {
		return (yield* commandExists(fromEnv.value))
			? Option.some(fromEnv.value)
			: Option.none();
	}

	const saved = yield* Home.editorPreference;

	if (saved !== null && (yield* commandExists(saved))) {
		return Option.some(saved);
	}

	const ui = yield* Ui;

	if (!ui.interactive) {
		return Option.none();
	}

	const choices = yield* Effect.forEach(commonEditors, (editor) =>
		Effect.map(commandExists(editor), (exists) => ({
			value: editor,
			label: editor,
			disabled: !exists,
		})),
	);
	const selected = yield* ui.select("Editor", choices);

	if (!(yield* commandExists(selected))) {
		return Option.none();
	}

	if (yield* ui.confirm("Remember editor?")) {
		yield* Home.setEditorPreference(selected);
	}

	return Option.some(selected);
});

/** Opens `initialText` in the user's editor and returns the saved text. */
export const editText = Effect.fn("editText")(function* (initialText: string) {
	const editorCommand = yield* resolveEditorCommand;

	if (Option.isNone(editorCommand)) {
		return yield* new CliFailure({ code: "EDITOR_UNAVAILABLE" });
	}

	const { command, args } = parseEditorCommand(editorCommand.value);
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const uuid = yield* (yield* Crypto.Crypto).randomUUIDv4.pipe(Effect.orDie);

	return yield* Effect.scoped(
		Effect.gen(function* () {
			const dir = yield* fs.makeTempDirectoryScoped({
				prefix: "better-age-edit-",
			});
			yield* fs.chmod(dir, 0o700);
			const file = path.join(dir, `payload-${uuid}.env`);
			yield* fs.writeFileString(file, initialText, { mode: 0o600 });
			yield* fs.chmod(file, 0o600);

			// Not detached: the editor must stay in the terminal's foreground
			// process group (resize, job control, /dev/tty). Spawn failures and
			// signal deaths count as a failed editor run, like a non-zero exit.
			const exitCode = yield* spawner
				.exitCode(
					ChildProcess.make(command, [...args, file], {
						detached: false,
						stdin: "inherit",
						stdout: "inherit",
						stderr: "inherit",
					}),
				)
				.pipe(Effect.orElseSucceed(() => 1));

			if (exitCode !== 0) {
				return yield* new CliFailure({ code: "EDITOR_EXIT_NON_ZERO" });
			}

			return yield* fs.readFileString(file);
		}),
	).pipe(
		Effect.catchTag("PlatformError", () =>
			Effect.fail(new CliFailure({ code: "EDITOR_UNAVAILABLE" })),
		),
	);
});
