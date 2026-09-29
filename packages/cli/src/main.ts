// Runs one `bage` invocation and returns its exit code. Keeps the stdout
// contract: only primary/machine output goes to stdout; help and version too.
// Parse errors are a single `[ERROR] COMMAND_PARSE: ...` line (exit 2).
import { Notices } from "@better-age/core/Notices";
import { Cause, Console, Effect, Exit, Layer } from "effect";
import {
	CliConfig,
	CliError,
	CliOutput,
	Command,
	GlobalFlag,
} from "effect/unstable/cli";
import { bage } from "./commands.js";
import { exitCodeOf, isFailure } from "./failures.js";
import { error } from "./present.js";
import { say, sayFailure, sayWarning, Ui } from "./ui/Ui.js";

/** Renders Core notices once per invocation as `[WARN]` lines. */
export const noticesLayer = Layer.effect(Notices)(
	Effect.gen(function* () {
		const ui = yield* Ui;
		const seen = new Set<string>();

		return {
			report: (notice) => {
				const message =
					notice.code === "LOCAL_PERMISSIONS_REPAIRED"
						? "Local file permissions repaired"
						: `Retired key ${notice.fingerprint} could not be unlocked`;

				if (seen.has(message)) return Effect.void;
				seen.add(message);
				return sayWarning(message).pipe(Effect.provideService(Ui, ui));
			},
		};
	}),
);

export const runBage = Effect.fnUntraced(function* (
	argv: ReadonlyArray<string>,
	version: string,
) {
	const ui = yield* Ui;
	// Built-in help/version/completions print through Console; buffer them so a
	// parse error never leaks the help text onto stdout.
	const framework: Array<string> = [];
	const bufferConsole: Console.Console = {
		...globalThis.console,
		log: (...args: ReadonlyArray<unknown>) => {
			framework.push(`${args.map(String).join(" ")}\n`);
		},
		error: (...args: ReadonlyArray<unknown>) => {
			framework.push(`${args.map(String).join(" ")}\n`);
		},
	};
	const formatter = CliOutput.defaultFormatter({ colors: false });

	const exit = yield* Command.runWith(bage, { version, renderErrors: false })(
		argv,
	).pipe(
		Effect.provideService(Console.Console, bufferConsole),
		Effect.provideService(CliOutput.Formatter, {
			...formatter,
			formatVersion: (_name, value) => value,
		}),
		Effect.provideService(CliConfig.CliConfig, {
			...CliConfig.defaults,
			builtIns: [GlobalFlag.Help, GlobalFlag.Version, GlobalFlag.Completions],
		}),
		Effect.exit,
	);
	const flushFramework = ui.stdout(framework.join(""));

	if (Exit.isSuccess(exit)) {
		yield* flushFramework;
		return 0;
	}

	const failure = Cause.squash(exit.cause);

	if (CliError.isCliError(failure)) {
		const errors = failure._tag === "ShowHelp" ? failure.errors : [failure];

		if (errors.length === 0) {
			yield* flushFramework;
			return 0;
		}

		yield* say(
			error(
				"COMMAND_PARSE",
				errors
					.map((item) => item.message)
					.join("; ")
					.replace(/\s+/g, " "),
			),
		);
		return 2;
	}

	if (isFailure(failure)) {
		yield* sayFailure(failure);
		return exitCodeOf(failure);
	}

	yield* say(
		error(
			"UNEXPECTED",
			failure instanceof Error ? failure.message : String(failure),
		),
	);
	return 1;
});
