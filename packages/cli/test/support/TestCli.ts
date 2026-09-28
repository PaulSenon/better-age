// Runs real `bage` invocations (grammar + flows + Core) against an in-memory
// home, fake age crypto, a scripted terminal, and a fake editor process.
// A home persists across `run` calls of the same TestCli.
import { makeTestCore } from "@better-age/core/test-support/TestCore";
import {
	ConfigProvider,
	Effect,
	Layer,
	Sink,
	Stdio,
	Stream,
	Terminal,
} from "effect";
import {
	type ChildProcess,
	ChildProcessSpawner,
} from "effect/unstable/process";
import { aborted, CliFailure } from "../../src/failures.js";
import { noticesLayer, runBage } from "../../src/main.js";
import { type Choice, Ui } from "../../src/ui/Ui.js";

/** Return from a scripted prompt to simulate Ctrl-C. */
export const CTRL_C = Symbol("ctrl-c");
type Answer<A> = A | typeof CTRL_C;

export type ScriptedTerminal = {
	readonly interactive?: boolean;
	readonly color?: boolean;
	readonly text?: (label: string) => Answer<string>;
	readonly secret?: (label: string) => Answer<string>;
	readonly select?: (
		label: string,
		choices: ReadonlyArray<Choice>,
	) => Answer<string>;
	readonly confirm?: (label: string) => Answer<boolean>;
	readonly view?: (text: string, path: string) => void;
	/** Fake editor: returns saved text, or an exit code to simulate failure. */
	readonly editor?: (text: string) => string | { readonly exitCode: number };
	/** Environment (e.g. VISUAL/EDITOR). Defaults to VISUAL=fake-editor. */
	readonly env?: Record<string, string>;
	/** Commands `command -v` finds. Defaults to fake-editor, nano, vim. */
	readonly installed?: ReadonlyArray<string>;
};

export type PromptEvent =
	| {
			readonly kind: "text" | "secret" | "confirm" | "pause";
			readonly label: string;
	  }
	| {
			readonly kind: "select";
			readonly label: string;
			readonly choices: ReadonlyArray<Choice>;
	  }
	| { readonly kind: "view"; readonly label: string }
	| { readonly kind: "editor"; readonly label: string };

export type RunResult = {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	readonly prompts: ReadonlyArray<PromptEvent>;
};

const answer = <A>(value: Answer<A> | undefined, label: string) =>
	value === CTRL_C
		? Effect.fail(aborted())
		: value === undefined
			? Effect.die(new Error(`Unscripted prompt: ${label}`))
			: Effect.succeed(value);

const fakeSpawner = (
	terminal: ScriptedTerminal,
	fs: ReturnType<typeof makeTestCore>["fs"],
	prompts: Array<PromptEvent>,
) =>
	ChildProcessSpawner.make((command) => {
		const standard = command as ChildProcess.StandardCommand;
		const run = (): number => {
			if (standard.command === "sh") {
				const name = standard.args.at(-1) ?? "";
				const installed = terminal.installed ?? ["fake-editor", "nano", "vim"];
				return installed.includes(name) ? 0 : 1;
			}

			const file = standard.args.at(-1) ?? "";
			const current = fs.file(file) ?? "";
			prompts.push({ kind: "editor", label: `${standard.command} ${file}` });
			const result = terminal.editor?.(current) ?? current;

			if (typeof result !== "string") {
				return result.exitCode;
			}

			fs.entries.set(file, { type: "File", contents: result, mode: 0o600 });
			return 0;
		};

		return Effect.sync(() =>
			ChildProcessSpawner.makeHandle({
				pid: ChildProcessSpawner.ProcessId(1),
				exitCode: Effect.sync(() => ChildProcessSpawner.ExitCode(run())),
				isRunning: Effect.succeed(false),
				kill: () => Effect.void,
				stdin: Sink.drain,
				stdout: Stream.empty,
				stderr: Stream.empty,
				all: Stream.empty,
				getInputFd: () => Sink.drain,
				getOutputFd: () => Stream.empty,
				unref: Effect.succeed(Effect.void),
			}),
		);
	});

export const makeTestCli = (
	options: { readonly files?: Record<string, string> } = {},
) => {
	const core = makeTestCore(options);

	const run = async (
		argv: ReadonlyArray<string>,
		terminal: ScriptedTerminal = {},
	): Promise<RunResult> => {
		let stdout = "";
		let stderr = "";
		const prompts: Array<PromptEvent> = [];
		const ui = Ui.of({
			interactive: terminal.interactive ?? true,
			color: terminal.color ?? false,
			stdout: (text) =>
				Effect.sync(() => {
					stdout += text;
				}),
			stderr: (text) =>
				Effect.sync(() => {
					stderr += text;
				}),
			text: (label) =>
				Effect.suspend(() => {
					prompts.push({ kind: "text", label });
					return answer(terminal.text?.(label), label);
				}),
			secret: (label) =>
				Effect.suspend(() => {
					prompts.push({ kind: "secret", label });
					return answer(terminal.secret?.(label), label);
				}),
			select: (label, choices) =>
				Effect.suspend(() => {
					prompts.push({ kind: "select", label, choices });
					return answer(terminal.select?.(label, choices), label);
				}),
			confirm: (label) =>
				Effect.suspend(() => {
					prompts.push({ kind: "confirm", label });
					return answer(terminal.confirm?.(label), label);
				}),
			pause: (label) =>
				Effect.sync(() => void prompts.push({ kind: "pause", label })),
			view: (text, path) =>
				terminal.view === undefined
					? Effect.fail(new CliFailure({ code: "VIEWER_UNAVAILABLE" }))
					: Effect.sync(() => {
							prompts.push({ kind: "view", label: path });
							terminal.view?.(text, path);
						}),
		});
		const layer = Layer.mergeAll(core.layer, noticesLayer).pipe(
			Layer.provideMerge(
				Layer.mergeAll(
					Layer.succeed(Ui)(ui),
					Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
						fakeSpawner(terminal, core.fs, prompts),
					),
					// Required by the CLI framework; bage never reads them directly.
					Stdio.layerTest({}),
					Layer.succeed(Terminal.Terminal)(
						Terminal.make({
							columns: Effect.succeed(80),
							rows: Effect.succeed(24),
							readInput: Effect.die("unused"),
							readLine: Effect.die("unused"),
							display: () => Effect.void,
						}),
					),
					ConfigProvider.layer(
						ConfigProvider.fromEnv({
							env: terminal.env ?? { VISUAL: "fake-editor" },
						}),
					),
				),
			),
		);
		const exitCode = await Effect.runPromise(
			runBage(argv, "1.2.3").pipe(Effect.provide(layer)),
		);

		return { exitCode, stdout, stderr, prompts };
	};

	return { core, run };
};

/** Answers secrets with a fixed passphrase (setup/confirmation included). */
export const passphrase = "correct horse";

/** Scripted interactive terminal that creates a home via `bage setup`. */
export const setupHome = async (
	cli: ReturnType<typeof makeTestCli>,
	name = "Isaac",
) => {
	const result = await cli.run(["setup", "--name", name], {
		secret: () => passphrase,
	});

	if (result.exitCode !== 0) {
		throw new Error(`setup failed: ${result.stderr}`);
	}
};

/** Identity string of a separate home, for import/grant scenarios. */
export const otherIdentityString = async (name: string) => {
	const other = makeTestCli();
	await setupHome(other, name);
	return (await other.run(["identity", "export"])).stdout.trim();
};
