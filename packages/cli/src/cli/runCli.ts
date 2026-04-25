import {
	presentFailure,
	presentIdentityList,
	presentIdentityString,
	presentSuccess,
} from "./presenter.js";

export type CliTerminalMode = "interactive" | "headless";

type CoreSuccess<TValue> = {
	readonly kind: "success";
	readonly code: string;
	readonly value: TValue;
};

type CoreFailure = {
	readonly kind: "failure";
	readonly code: string;
	readonly details: unknown;
};

type CoreResponse<TValue> = {
	readonly result: CoreSuccess<TValue> | CoreFailure;
	readonly notices: ReadonlyArray<unknown>;
};

type KnownIdentity = {
	readonly ownerId: string;
	readonly publicIdentity: {
		readonly displayName: string;
	};
	readonly handle: string;
	readonly fingerprint: string;
	readonly localAlias: string | null;
};

type SelfIdentity = {
	readonly ownerId: string;
	readonly publicIdentity: {
		readonly displayName: string;
	};
	readonly handle: string;
	readonly fingerprint: string;
	readonly keyMode: string;
	readonly rotationTtl: string;
};

type RetiredKey = {
	readonly fingerprint: string;
	readonly retiredAt: string;
};

export type CliCore = {
	readonly commands: {
		readonly createSelfIdentity: (input: {
			readonly displayName: string;
			readonly passphrase: string;
		}) => Promise<CoreResponse<{ readonly handle: string }>>;
		readonly importKnownIdentity: (input: {
			readonly identityString: string;
			readonly localAlias?: string | null;
		}) => Promise<
			CoreResponse<{
				readonly ownerId: string;
				readonly handle: string;
				readonly outcome: string;
			}>
		>;
		readonly forgetKnownIdentity: (input: {
			readonly ownerId: string;
		}) => Promise<CoreResponse<{ readonly ownerId: string }>>;
	};
	readonly queries: {
		readonly exportSelfIdentityString: () => Promise<
			CoreResponse<{ readonly identityString: string }>
		>;
		readonly getSelfIdentity: () => Promise<CoreResponse<SelfIdentity>>;
		readonly listKnownIdentities: () => Promise<
			CoreResponse<ReadonlyArray<KnownIdentity>>
		>;
		readonly listRetiredKeys: () => Promise<
			CoreResponse<ReadonlyArray<RetiredKey>>
		>;
	};
};

export type CliTerminal = {
	readonly mode: CliTerminalMode;
	readonly promptText?: (label: string) => Promise<string>;
	readonly promptSecret?: (label: string) => Promise<string>;
};

export type RunCliInput = {
	readonly argv: ReadonlyArray<string>;
	readonly core: CliCore;
	readonly terminal: CliTerminal;
};

export type RunCliResult = {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
};

type ParsedArgs = {
	readonly positionals: ReadonlyArray<string>;
	readonly options: Readonly<Record<string, string>>;
};

const parseArgs = (argv: ReadonlyArray<string>): ParsedArgs => {
	const positionals: Array<string> = [];
	const options: Record<string, string> = {};

	for (let index = 0; index < argv.length; index++) {
		const token = argv[index];

		if (token === undefined) {
			continue;
		}

		if (!token.startsWith("--")) {
			positionals.push(token);
			continue;
		}

		const option = token.slice(2);
		const separatorIndex = option.indexOf("=");

		if (separatorIndex !== -1) {
			options[option.slice(0, separatorIndex)] = option.slice(
				separatorIndex + 1,
			);
			continue;
		}

		const value = argv[index + 1];

		if (value !== undefined && !value.startsWith("--")) {
			options[option] = value;
			index++;
			continue;
		}

		options[option] = "true";
	}

	return { positionals, options };
};

const ensurePromptText = (terminal: CliTerminal) =>
	terminal.promptText ?? (async () => "");

const requirePromptSecret = (
	terminal: CliTerminal,
): ((label: string) => Promise<string>) | null =>
	terminal.mode === "headless" ? null : (terminal.promptSecret ?? null);

const acquireNewPassphrase = async (
	terminal: CliTerminal,
): Promise<
	{ readonly passphrase: string } | { readonly failure: RunCliResult }
> => {
	const promptSecret = requirePromptSecret(terminal);

	if (promptSecret === null) {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await promptSecret("Passphrase");
		const confirmation = await promptSecret("Confirm passphrase");

		if (passphrase === confirmation) {
			return { passphrase };
		}
	}

	return { failure: presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH") };
};

const resolveKnownIdentity = (
	identities: ReadonlyArray<KnownIdentity>,
	reference: string,
) =>
	identities.find(
		(identity) =>
			identity.ownerId === reference ||
			identity.localAlias === reference ||
			identity.handle === reference ||
			identity.publicIdentity.displayName === reference,
	);

const runSetup = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const promptText = ensurePromptText(input.terminal);
	const displayName =
		args.options.name ??
		(input.terminal.mode === "interactive"
			? await promptText("Display name")
			: undefined);

	if (displayName === undefined || displayName.length === 0) {
		return presentFailure("SETUP_NAME_MISSING", 2);
	}

	const passphrase = await acquireNewPassphrase(input.terminal);

	if ("failure" in passphrase) {
		return passphrase.failure;
	}

	const response = await input.core.commands.createSelfIdentity({
		displayName,
		passphrase: passphrase.passphrase,
	});

	if (response.result.kind === "failure") {
		return presentFailure(response.result.code);
	}

	return presentSuccess(`Identity created: ${response.result.value.handle}`);
};

const runIdentityExport = async (core: CliCore): Promise<RunCliResult> => {
	const response = await core.queries.exportSelfIdentityString();

	if (response.result.kind === "failure") {
		return presentFailure(response.result.code);
	}

	return presentIdentityString(response.result.value.identityString);
};

const runIdentityImport = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const identityString =
		args.positionals[2] ??
		(input.terminal.mode === "interactive"
			? await ensurePromptText(input.terminal)("Identity string")
			: undefined);

	if (identityString === undefined || identityString.length === 0) {
		return presentFailure("IDENTITY_STRING_MISSING", 2);
	}

	let stderr = "";
	const aliasFromOption = args.options.alias;
	const maxAttempts = input.terminal.mode === "interactive" ? 3 : 1;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const promptedAlias =
			aliasFromOption ??
			(input.terminal.mode === "interactive"
				? await ensurePromptText(input.terminal)("Local alias")
				: undefined);
		const localAlias =
			promptedAlias === undefined || promptedAlias.length === 0
				? undefined
				: promptedAlias;
		const response = await input.core.commands.importKnownIdentity({
			identityString,
			...(localAlias === undefined ? {} : { localAlias }),
		});

		if (response.result.kind === "success") {
			const result = presentSuccess(
				`Identity imported: ${response.result.value.handle}`,
			);

			return { ...result, stderr: `${stderr}${result.stderr}` };
		}

		if (
			input.terminal.mode === "interactive" &&
			aliasFromOption === undefined &&
			(response.result.code === "LOCAL_ALIAS_DUPLICATE" ||
				response.result.code === "LOCAL_ALIAS_INVALID")
		) {
			stderr += presentFailure(response.result.code).stderr;
			continue;
		}

		return {
			...presentFailure(response.result.code),
			stderr: `${stderr}${presentFailure(response.result.code).stderr}`,
		};
	}

	return presentFailure("LOCAL_ALIAS_INVALID");
};

const runIdentityList = async (core: CliCore): Promise<RunCliResult> => {
	const self = await core.queries.getSelfIdentity();

	if (self.result.kind === "failure") {
		return presentFailure(self.result.code);
	}

	const known = await core.queries.listKnownIdentities();

	if (known.result.kind === "failure") {
		return presentFailure(known.result.code);
	}

	const retired = await core.queries.listRetiredKeys();

	if (retired.result.kind === "failure") {
		return presentFailure(retired.result.code);
	}

	return presentIdentityList({
		self: self.result.value,
		known: known.result.value,
		retired: retired.result.value,
	});
};

const runIdentityForget = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const reference =
		args.positionals[2] ??
		(input.terminal.mode === "interactive"
			? await ensurePromptText(input.terminal)("Identity")
			: undefined);

	if (reference === undefined || reference.length === 0) {
		return presentFailure("IDENTITY_REFERENCE_MISSING", 2);
	}

	const listed = await input.core.queries.listKnownIdentities();

	if (listed.result.kind === "failure") {
		return presentFailure(listed.result.code);
	}

	const identity = resolveKnownIdentity(listed.result.value, reference);

	if (identity === undefined) {
		return presentFailure("IDENTITY_REFERENCE_NOT_FOUND");
	}

	const response = await input.core.commands.forgetKnownIdentity({
		ownerId: identity.ownerId,
	});

	if (response.result.kind === "failure") {
		return presentFailure(response.result.code);
	}

	return presentSuccess(`Identity forgotten: ${response.result.value.ownerId}`);
};

export const runCli = async (input: RunCliInput): Promise<RunCliResult> => {
	const args = parseArgs(input.argv);
	const [command, subcommand] = args.positionals;

	if (command === "setup") {
		return runSetup(args, input);
	}

	if (command === "identity" && subcommand === "export") {
		return runIdentityExport(input.core);
	}

	if (command === "identity" && subcommand === "import") {
		return runIdentityImport(args, input);
	}

	if (command === "identity" && subcommand === "list") {
		return runIdentityList(input.core);
	}

	if (command === "identity" && subcommand === "forget") {
		return runIdentityForget(args, input);
	}

	return presentFailure("COMMAND_UNKNOWN", 2);
};
