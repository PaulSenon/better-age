import { Args, Command, Options } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { presentParseFailure, styleRunCliResult } from "./presenter.js";
import { type RunCliInput, type RunCliResult, runCli } from "./runCli.js";

const optionalPayload = Args.optional(Args.text({ name: "payload" }));
const optionalIdentityReference = Args.optional(
	Args.text({ name: "identity-ref" }),
);
const protocolVersion = Options.text("protocol-version");
const optionalAlias = Options.optional(Options.text("alias"));
const optionalName = Options.optional(Options.text("name"));

const noOp = () => Effect.void;

const payloadCommand = (
	name: string,
	purpose: string,
	extra: Record<string, unknown> = {},
) =>
	Command.make(name, { payload: optionalPayload, ...extra }, noOp).pipe(
		Command.withDescription(purpose),
	);

const grantCommand = Command.make(
	"grant",
	{ payload: optionalPayload, identityReference: optionalIdentityReference },
	noOp,
).pipe(Command.withDescription("Grant payload access to an identity."));

const revokeCommand = Command.make(
	"revoke",
	{ payload: optionalPayload, identityReference: optionalIdentityReference },
	noOp,
).pipe(Command.withDescription("Revoke payload access from an identity."));

const identityCommand = Command.make("identity").pipe(
	Command.withDescription("Manage local identities."),
	Command.withSubcommands([
		Command.make("export", {}, noOp).pipe(
			Command.withDescription("Print current public identity string."),
		),
		Command.make(
			"forget",
			{ identityReference: optionalIdentityReference },
			noOp,
		).pipe(Command.withDescription("Forget a known identity.")),
		Command.make(
			"import",
			{
				identityString: Args.optional(Args.text({ name: "identity-string" })),
				alias: optionalAlias,
			},
			noOp,
		).pipe(Command.withDescription("Import a public identity string.")),
		Command.make("list", {}, noOp).pipe(
			Command.withDescription("List self, known identities, and retired keys."),
		),
		Command.make("passphrase", {}, noOp).pipe(
			Command.withDescription("Change the identity key passphrase."),
		),
		Command.make("pass", {}, noOp).pipe(
			Command.withDescription("Alias for identity passphrase."),
		),
		Command.make("pw", {}, noOp).pipe(
			Command.withDescription("Alias for identity passphrase."),
		),
		Command.make("rotate", {}, noOp).pipe(
			Command.withDescription("Rotate the current public identity."),
		),
	]),
);

export const releaseCommandGrammar = Command.make("bage").pipe(
	Command.withDescription(
		"Small CLI wrapper around age-encrypted env payloads.",
	),
	Command.withSubcommands([
		payloadCommand("create", "Create an encrypted payload."),
		payloadCommand("edit", "Edit encrypted payload env text."),
		grantCommand,
		payloadCommand("inspect", "Inspect encrypted payload metadata."),
		payloadCommand("load", "Decrypt payload for varlock.", { protocolVersion }),
		revokeCommand,
		payloadCommand("update", "Rewrite payload with current metadata."),
		payloadCommand("view", "View encrypted payload env text safely."),
		identityCommand,
		Command.make("setup", { name: optionalName }, noOp).pipe(
			Command.withDescription("Create the local identity."),
		),
		Command.make("interactive", {}, noOp).pipe(
			Command.withDescription("Open the interactive command picker."),
		),
		Command.make("i", {}, noOp).pipe(
			Command.withDescription("Alias for interactive."),
		),
	]),
);

const styleResult = (input: RunCliInput, result: RunCliResult) =>
	styleRunCliResult(result, {
		color: input.terminal.presentation?.color ?? false,
	});

const toConsoleLine = (args: ReadonlyArray<unknown>) =>
	`${args.map(String).join(" ")}\n`;

const makeCaptureConsole = () => {
	let stdout = "";
	let stderr = "";
	const appendStdout = (...args: ReadonlyArray<unknown>) =>
		Effect.sync(() => {
			stdout += toConsoleLine(args);
		});
	const appendStderr = (...args: ReadonlyArray<unknown>) =>
		Effect.sync(() => {
			stderr += toConsoleLine(args);
		});
	const noop = () => Effect.void;
	const unsafeNoop = () => {};

	return {
		get stderr() {
			return stderr;
		},
		get stdout() {
			return stdout;
		},
		console: {
			[Console.TypeId]: Console.TypeId,
			assert: (condition: boolean, ...args: ReadonlyArray<unknown>) =>
				condition ? Effect.void : appendStderr(...args),
			clear: Effect.sync(() => {
				stdout = "";
				stderr = "";
			}),
			count: noop,
			countReset: noop,
			debug: appendStderr,
			dir: appendStdout,
			dirxml: appendStdout,
			error: appendStderr,
			group: noop,
			groupEnd: Effect.void,
			info: appendStdout,
			log: appendStdout,
			table: appendStdout,
			time: noop,
			timeEnd: noop,
			timeLog: appendStdout,
			trace: appendStderr,
			warn: appendStderr,
			unsafe: {
				assert: unsafeNoop,
				clear: unsafeNoop,
				count: unsafeNoop,
				countReset: unsafeNoop,
				debug: unsafeNoop,
				dir: unsafeNoop,
				dirxml: unsafeNoop,
				error: unsafeNoop,
				group: unsafeNoop,
				groupCollapsed: unsafeNoop,
				groupEnd: unsafeNoop,
				info: unsafeNoop,
				log: unsafeNoop,
				table: unsafeNoop,
				time: unsafeNoop,
				timeEnd: unsafeNoop,
				timeLog: unsafeNoop,
				trace: unsafeNoop,
				warn: unsafeNoop,
			},
		} satisfies Console.Console,
	};
};

const grammarRunner = Command.run(releaseCommandGrammar, {
	name: "bage",
	version: "0.0.1",
});

const runGrammar = async (
	argv: ReadonlyArray<string>,
): Promise<
	| {
			readonly kind: "accepted";
			readonly stdout: string;
			readonly stderr: string;
	  }
	| {
			readonly kind: "rejected";
			readonly stdout: string;
			readonly stderr: string;
	  }
> => {
	const capture = makeCaptureConsole();

	try {
		await Effect.runPromise(
			grammarRunner(["node", "bage", ...argv]).pipe(
				Console.withConsole(capture.console),
				Effect.provide(NodeContext.layer),
			),
		);
		return {
			kind: "accepted",
			stdout: capture.stdout,
			stderr: capture.stderr,
		};
	} catch {
		return {
			kind: "rejected",
			stdout: capture.stdout,
			stderr: capture.stderr,
		};
	}
};

export const runCliWithGrammar = async (
	input: RunCliInput,
): Promise<RunCliResult> => {
	const grammarResult = await runGrammar(input.argv);

	if (grammarResult.kind === "rejected") {
		const message =
			grammarResult.stderr.trim().replace(/\s+/g, " ") || "invalid command";
		return styleResult(input, presentParseFailure("COMMAND_PARSE", message));
	}

	if (grammarResult.stdout.length > 0 || grammarResult.stderr.length > 0) {
		return {
			exitCode: 0,
			stdout: grammarResult.stdout,
			stderr: grammarResult.stderr,
		};
	}

	return await runCli(input);
};
