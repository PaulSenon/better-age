import { Args, Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { presentParseFailure } from "./presenter.js";
import { type RunCliInput, type RunCliResult, runCli } from "./runCli.js";

type CommandSpec = {
	readonly path: readonly [string] | readonly [string, string];
	readonly aliases?: ReadonlyArray<string>;
	readonly usage: string;
	readonly purpose: string;
	readonly operands?: ReadonlyArray<string>;
	readonly flags?: ReadonlyArray<string>;
};

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

const identityCommand = Command.make("identity", {}, noOp).pipe(
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

export const releaseCommandGrammar = Command.make("bage", {}, noOp).pipe(
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

const commandSpecs: ReadonlyArray<CommandSpec> = [
	{
		path: ["create"],
		usage: "Usage: bage create [payload]",
		purpose: "Create an encrypted payload.",
		operands: ["[payload]"],
	},
	{
		path: ["edit"],
		usage: "Usage: bage edit [payload]",
		purpose: "Edit encrypted payload env text.",
		operands: ["[payload]"],
	},
	{
		path: ["grant"],
		usage: "Usage: bage grant [payload] [identity-ref]",
		purpose: "Grant payload access to an identity.",
		operands: ["[payload]", "[identity-ref]"],
	},
	{
		path: ["inspect"],
		usage: "Usage: bage inspect [payload]",
		purpose: "Inspect encrypted payload metadata.",
		operands: ["[payload]"],
	},
	{
		path: ["load"],
		usage: "Usage: bage load [payload] --protocol-version=1",
		purpose: "Decrypt payload for varlock.",
		operands: ["[payload]"],
		flags: ["--protocol-version=1"],
	},
	{
		path: ["revoke"],
		usage: "Usage: bage revoke [payload] [identity-ref]",
		purpose: "Revoke payload access from an identity.",
		operands: ["[payload]", "[identity-ref]"],
	},
	{
		path: ["update"],
		usage: "Usage: bage update [payload]",
		purpose: "Rewrite payload with current metadata.",
		operands: ["[payload]"],
	},
	{
		path: ["view"],
		usage: "Usage: bage view [payload]",
		purpose: "View encrypted payload env text safely.",
		operands: ["[payload]"],
	},
	{
		path: ["setup"],
		usage: "Usage: bage setup [--name <display-name>]",
		purpose: "Create the local identity.",
		flags: ["--name <display-name>"],
	},
	{
		path: ["interactive"],
		aliases: ["i"],
		usage: "Usage: bage interactive",
		purpose: "Open the interactive command picker.",
	},
	{
		path: ["identity", "export"],
		usage: "Usage: bage identity export",
		purpose: "Print current public identity string.",
	},
	{
		path: ["identity", "forget"],
		usage: "Usage: bage identity forget [identity-ref]",
		purpose: "Forget a known identity.",
		operands: ["[identity-ref]"],
	},
	{
		path: ["identity", "import"],
		usage: "Usage: bage identity import [identity-string] [--alias <alias>]",
		purpose: "Import a public identity string.",
		operands: ["[identity-string]"],
		flags: ["--alias <alias>"],
	},
	{
		path: ["identity", "list"],
		usage: "Usage: bage identity list",
		purpose: "List self, known identities, and retired keys.",
	},
	{
		path: ["identity", "passphrase"],
		aliases: ["pass", "pw"],
		usage: "Usage: bage identity passphrase",
		purpose: "Change the identity key passphrase.",
	},
	{
		path: ["identity", "rotate"],
		usage: "Usage: bage identity rotate",
		purpose: "Rotate the current public identity.",
	},
];

const rootCommands = [
	"create",
	"edit",
	"grant",
	"inspect",
	"load",
	"revoke",
	"update",
	"view",
	"identity",
	"setup",
	"interactive",
	"i",
] as const;

const identityCommands = [
	"export",
	"forget",
	"import",
	"list",
	"passphrase",
	"pass",
	"pw",
	"rotate",
] as const;

const renderList = (entries: ReadonlyArray<string>): string =>
	entries.map((entry) => `  ${entry}\n`).join("");

const rootHelp = (): RunCliResult => ({
	exitCode: 0,
	stdout: [
		"Usage: bage <command>\n",
		"\nCommands:\n",
		renderList(rootCommands),
	].join(""),
	stderr: "",
});

const identityHelp = (): RunCliResult => ({
	exitCode: 0,
	stdout: [
		"Usage: bage identity <command>\n",
		"\nCommands:\n",
		renderList(identityCommands),
	].join(""),
	stderr: "",
});

const commandHelp = (spec: CommandSpec): RunCliResult => {
	const lines = [spec.usage, "", spec.purpose];

	if (spec.aliases !== undefined && spec.aliases.length > 0) {
		lines.push("", `Aliases: ${spec.aliases.join(", ")}`);
	}

	if (spec.operands !== undefined && spec.operands.length > 0) {
		lines.push("", "Operands:", renderList(spec.operands).trimEnd());
	}

	if (spec.flags !== undefined && spec.flags.length > 0) {
		lines.push("", "Flags:", renderList(spec.flags).trimEnd());
	}

	return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
};

const firstNonOption = (argv: ReadonlyArray<string>) =>
	argv.find((token) => !token.startsWith("-"));

const hasHelpFlag = (argv: ReadonlyArray<string>) =>
	argv.includes("--help") || argv.includes("-h");

const findCommandSpec = (argv: ReadonlyArray<string>) =>
	commandSpecs.find((spec) =>
		spec.path.every((part, index) => argv[index] === part),
	);

const stripHelpFlags = (argv: ReadonlyArray<string>) =>
	argv.filter((token) => token !== "--help" && token !== "-h");

const validateCommandPath = (
	argv: ReadonlyArray<string>,
): RunCliResult | null => {
	const command = firstNonOption(argv);

	if (command === undefined) {
		return presentParseFailure("COMMAND_MISSING", "pass a command");
	}

	if (!rootCommands.includes(command as (typeof rootCommands)[number])) {
		return presentParseFailure(
			"COMMAND_UNKNOWN",
			`unknown command "${command}"`,
		);
	}

	if (command !== "identity") {
		return null;
	}

	const subcommand = argv[1];

	if (
		subcommand === undefined ||
		!identityCommands.includes(subcommand as (typeof identityCommands)[number])
	) {
		return presentParseFailure(
			"COMMAND_UNKNOWN",
			subcommand === undefined
				? 'unknown command "identity"'
				: `unknown command "identity ${subcommand}"`,
		);
	}

	return null;
};

export const runCliWithGrammar = async (
	input: RunCliInput,
): Promise<RunCliResult> => {
	if (hasHelpFlag(input.argv)) {
		const helpArgv = stripHelpFlags(input.argv);

		if (helpArgv.length === 0) {
			return rootHelp();
		}

		if (helpArgv[0] === "identity" && helpArgv.length === 1) {
			return identityHelp();
		}

		const spec = findCommandSpec(helpArgv);

		if (spec !== undefined) {
			return commandHelp(spec);
		}
	}

	const parseFailure = validateCommandPath(input.argv);

	if (parseFailure !== null) {
		return parseFailure;
	}

	return await runCli(input);
};
