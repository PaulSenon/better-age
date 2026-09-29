// The terminal boundary. Flows only talk to the user through this service, so
// the whole CLI runs against a scripted Ui in tests.
//
// Prompt semantics: Ctrl-C/EOF inside a prompt fails with an *abort*
// CANCELLED (exit 130) that ends the command or the whole interactive session;
// scopes still close, so the terminal is restored and temp files are removed.
// An explicit "Cancel" choice is a plain CANCELLED that returns to the menu.
import { Context, Effect } from "effect";
import {
	type CliFailure,
	codeOf,
	type Failure,
	messageOf,
} from "../failures.js";
import { error, ok, style, warning } from "../present.js";

export type Choice = {
	readonly value: string;
	readonly label: string;
	readonly disabled?: boolean;
};

export class Ui extends Context.Service<
	Ui,
	{
		/** stdin and stderr are TTYs: prompts, pickers, editor, and viewer are allowed. */
		readonly interactive: boolean;
		/** Human stderr lines may be colored (TTY and no NO_COLOR). */
		readonly color: boolean;
		readonly stdout: (text: string) => Effect.Effect<void>;
		readonly stderr: (text: string) => Effect.Effect<void>;
		readonly text: (
			label: string,
			options?: { readonly defaultValue?: string },
		) => Effect.Effect<string, CliFailure>;
		/** Hidden input; nothing is echoed. */
		readonly secret: (label: string) => Effect.Effect<string, CliFailure>;
		/** Keyboard picker; disabled rows are shown but not selectable. */
		readonly select: (
			label: string,
			choices: ReadonlyArray<Choice>,
		) => Effect.Effect<string, CliFailure>;
		readonly confirm: (label: string) => Effect.Effect<boolean, CliFailure>;
		readonly pause: (label: string) => Effect.Effect<void, CliFailure>;
		/** Read-only in-process viewer; plaintext never reaches stdout. */
		readonly view: (
			text: string,
			path: string,
		) => Effect.Effect<void, CliFailure>;
	}
>()("@better-age/cli/Ui") {}

/** Writes one human stderr line (`[OK]`, `[WARN]`, `[ERROR]`), styled if allowed. */
export const say = Effect.fnUntraced(function* (line: string) {
	const ui = yield* Ui;
	yield* ui.stderr(ui.color ? style(line) : line);
});

export const sayOk = (message: string) => say(ok(message));
export const sayWarning = (message: string) => say(warning(message));
export const sayFailure = (failure: Failure) =>
	say(error(codeOf(failure), messageOf(failure)));
