import {
	type PresentationStyle,
	presentFailure,
	presentIdentityList,
	presentIdentityString,
	presentPayloadInspect,
	presentSuccess,
	presentWarning,
	sanitizeTerminalText,
	styleRunCliResult,
} from "./presenter.js";
import { CliPromptCancelledError } from "./secretPrompt.js";

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
	readonly notices: ReadonlyArray<CoreNotice>;
};

type CoreNotice = {
	readonly level: "warning";
	readonly code: string;
};

type KnownIdentity = {
	readonly ownerId: string;
	readonly publicIdentity: PublicIdentity;
	readonly handle: string;
	readonly fingerprint: string;
	readonly localAlias: string | null;
};

type SelfIdentity = {
	readonly ownerId: string;
	readonly publicIdentity: {
		readonly ownerId?: string;
		readonly displayName: string;
		readonly publicKey?: string;
		readonly identityUpdatedAt?: string;
	};
	readonly handle: string;
	readonly fingerprint: string;
	readonly keyMode: string;
	readonly rotationTtl: string;
};

type HomeStatus =
	| { readonly status: "not-setup" }
	| { readonly status: "setup"; readonly self: SelfIdentity };

type RetiredKey = {
	readonly fingerprint: string;
	readonly retiredAt: string;
};

type PayloadRecipient = {
	readonly ownerId: string;
	readonly displayName: string;
	readonly publicKey: string;
	readonly identityUpdatedAt: string;
	readonly handle: string;
	readonly fingerprint: string;
	readonly localAlias: string | null;
	readonly isSelf: boolean;
	readonly isStaleSelf: boolean;
};

type PublicIdentity = {
	readonly ownerId: string;
	readonly displayName: string;
	readonly publicKey: string;
	readonly identityUpdatedAt: string;
};

type DecryptedPayload = {
	readonly path: string;
	readonly payloadId: string;
	readonly createdAt: string;
	readonly lastRewrittenAt: string;
	readonly schemaVersion: number;
	readonly compatibility: "up-to-date" | "readable-but-outdated";
	readonly envText: string;
	readonly envKeys: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<PayloadRecipient>;
};

export type CliCore = {
	readonly commands: {
		readonly createSelfIdentity: (input: {
			readonly displayName: string;
			readonly passphrase: string;
		}) => Promise<CoreResponse<{ readonly handle: string }>>;
		readonly createPayload: (input: {
			readonly path: string;
			readonly passphrase: string;
			readonly overwrite?: boolean;
		}) => Promise<
			CoreResponse<{
				readonly path: string;
				readonly payloadId: string;
			}>
		>;
		readonly editPayload: (input: {
			readonly path: string;
			readonly passphrase: string;
			readonly editedEnvText: string;
		}) => Promise<
			CoreResponse<{
				readonly path: string;
				readonly payloadId: string;
				readonly outcome: string;
			}>
		>;
		readonly grantPayloadRecipient: (input: {
			readonly path: string;
			readonly passphrase: string;
			readonly recipient: PublicIdentity;
		}) => Promise<
			CoreResponse<{
				readonly path: string;
				readonly payloadId: string;
				readonly recipient: PublicIdentity;
				readonly outcome: string;
			}>
		>;
		readonly importKnownIdentity: (input: {
			readonly identityString: string;
			readonly localAlias?: string | null;
			readonly trustKeyUpdate?: boolean;
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
		readonly revokePayloadRecipient: (input: {
			readonly path: string;
			readonly passphrase: string;
			readonly recipientOwnerId: string;
		}) => Promise<
			CoreResponse<{
				readonly path: string;
				readonly payloadId: string;
				readonly recipientOwnerId: string;
				readonly outcome: string;
			}>
		>;
		readonly updatePayload: (input: {
			readonly path: string;
			readonly passphrase: string;
		}) => Promise<
			CoreResponse<{
				readonly path: string;
				readonly payloadId: string;
				readonly outcome: string;
				readonly rewriteReasons: ReadonlyArray<string>;
			}>
		>;
		readonly rotateSelfIdentity: (input: {
			readonly passphrase: string;
		}) => Promise<
			CoreResponse<{
				readonly ownerId: string;
				readonly nextFingerprint: string;
			}>
		>;
		readonly changeIdentityPassphrase: (input: {
			readonly currentPassphrase: string;
			readonly nextPassphrase: string;
		}) => Promise<CoreResponse<{ readonly ownerId: string }>>;
		readonly setEditorPreference: (input: {
			readonly editorCommand: string | null;
		}) => Promise<CoreResponse<{ readonly editorCommand: string | null }>>;
	};
	readonly queries: {
		readonly getEditorPreference: () => Promise<
			CoreResponse<{ readonly editorCommand: string | null }>
		>;
		readonly exportSelfIdentityString: () => Promise<
			CoreResponse<{ readonly identityString: string }>
		>;
		readonly decryptPayload: (input: {
			readonly path: string;
			readonly passphrase: string;
		}) => Promise<CoreResponse<DecryptedPayload>>;
		readonly verifySelfIdentityPassphrase: (input: {
			readonly passphrase: string;
		}) => Promise<CoreResponse<{ readonly ownerId: string }>>;
		readonly getHomeStatus: () => Promise<CoreResponse<HomeStatus>>;
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
	readonly confirm?: (label: string) => Promise<boolean>;
	readonly openEditor?: (initialText: string) => Promise<
		| { readonly kind: "cancel" }
		| {
				readonly kind: "failure";
				readonly code: "EDITOR_EXIT_NON_ZERO" | "EDITOR_UNAVAILABLE";
		  }
		| { readonly kind: "saved"; readonly text: string }
	>;
	readonly openViewer?: (envText: string, path: string) => Promise<void>;
	readonly presentation?: PresentationStyle;
	readonly promptText?: (label: string) => Promise<string>;
	readonly promptSecret?: (label: string) => Promise<string>;
	readonly selectOne?: (
		label: string,
		choices: ReadonlyArray<{
			readonly value: string;
			readonly label: string;
			readonly disabled: boolean;
		}>,
	) => Promise<string>;
	readonly waitForEnter?: (label: string) => Promise<void>;
	readonly writeResult?: (result: RunCliResult) => Promise<void> | void;
};

export type RunCliInput = {
	readonly argv: ReadonlyArray<string>;
	readonly core: CliCore;
	readonly parseIdentityString?: (
		identityString: string,
	) => Promise<PublicIdentity | null>;
	readonly discoverPayloadPaths?: () => Promise<ReadonlyArray<string>>;
	readonly payloadPathExists?: (path: string) => Promise<boolean>;
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

const ensureConfirm = (terminal: CliTerminal) =>
	terminal.confirm ?? (async () => false);

const requirePromptSecret = (
	terminal: CliTerminal,
): ((label: string) => Promise<string>) | null =>
	terminal.mode === "headless" ? null : (terminal.promptSecret ?? null);

const isPromptCancelledError = (
	cause: unknown,
): cause is CliPromptCancelledError =>
	cause instanceof CliPromptCancelledError ||
	(cause instanceof Error && cause.name === "CliPromptCancelledError");

const readSecretPrompt = async (
	promptSecret: (label: string) => Promise<string>,
	label: string,
): Promise<
	{ readonly secret: string } | { readonly failure: RunCliResult }
> => {
	try {
		return { secret: await promptSecret(label) };
	} catch (cause) {
		if (isPromptCancelledError(cause)) {
			return { failure: presentFailure("CANCELLED", 130) };
		}

		throw cause;
	}
};

const acquirePassphrase = async (
	terminal: CliTerminal,
): Promise<
	{ readonly passphrase: string } | { readonly failure: RunCliResult }
> => {
	const promptSecret = requirePromptSecret(terminal);

	if (promptSecret === null) {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	const prompted = await readSecretPrompt(promptSecret, "Passphrase");

	if ("failure" in prompted) {
		return prompted;
	}

	return { passphrase: prompted.secret };
};

const renderNotices = (notices: ReadonlyArray<CoreNotice>): string =>
	notices
		.map((notice) =>
			notice.code === "PAYLOAD_UPDATE_RECOMMENDED"
				? presentWarning("Payload update recommended: run bage update")
				: notice.code === "LOCAL_PERMISSIONS_REPAIRED"
					? presentWarning("Local file permissions repaired")
					: presentWarning(notice.code),
		)
		.join("");

const emitInteractiveFeedback = async (
	input: RunCliInput,
	result: RunCliResult,
): Promise<string> => {
	if (
		input.terminal.mode !== "interactive" ||
		input.terminal.writeResult === undefined
	) {
		return result.stderr;
	}

	await input.terminal.writeResult(
		styleRunCliResult(result, {
			color: input.terminal.presentation?.color ?? false,
		}),
	);

	return "";
};

const identityKeyUpdateLabel = (details: unknown) => {
	if (
		typeof details === "object" &&
		details !== null &&
		"oldFingerprint" in details &&
		"newFingerprint" in details &&
		typeof details.oldFingerprint === "string" &&
		typeof details.newFingerprint === "string"
	) {
		return `Trust identity key update ${details.oldFingerprint} -> ${details.newFingerprint}?`;
	}

	return "Trust identity key update?";
};

const importKnownIdentityWithTrustGate = async (input: {
	readonly cli: RunCliInput;
	readonly identityString: string;
	readonly localAlias?: string;
	readonly trustKeyUpdate?: boolean;
}) => {
	const importInput = {
		identityString: input.identityString,
		...(input.localAlias === undefined ? {} : { localAlias: input.localAlias }),
		...(input.trustKeyUpdate === true ? { trustKeyUpdate: true } : {}),
	};
	const response =
		await input.cli.core.commands.importKnownIdentity(importInput);

	if (
		response.result.kind !== "failure" ||
		response.result.code !== "IDENTITY_KEY_UPDATE_REQUIRES_TRUST" ||
		input.trustKeyUpdate === true ||
		input.cli.terminal.mode !== "interactive"
	) {
		return response;
	}

	const trusted = await ensureConfirm(input.cli.terminal)(
		identityKeyUpdateLabel(response.result.details),
	);

	if (!trusted) {
		return {
			result: {
				kind: "failure" as const,
				code: "CANCELLED",
				details: undefined,
			},
			notices: [],
		};
	}

	return await input.cli.core.commands.importKnownIdentity({
		...importInput,
		trustKeyUpdate: true,
	});
};

const isValidEnvText = (envText: string): boolean =>
	envText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.every(
			(line) =>
				line.length === 0 ||
				line.startsWith("#") ||
				/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(line),
		);

const isValidNewPassphrase = (passphrase: string): boolean =>
	passphrase.length >= 8;

const acquireNewPassphrase = async (
	input: RunCliInput,
): Promise<
	| { readonly passphrase: string; readonly stderr: string }
	| { readonly failure: RunCliResult }
> => {
	const promptSecret = requirePromptSecret(input.terminal);

	if (promptSecret === null) {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	let stderr = "";
	let lastFailureCode = "PASSPHRASE_CONFIRMATION_MISMATCH";

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await readSecretPrompt(promptSecret, "Passphrase");

		if ("failure" in passphrase) {
			return passphrase;
		}

		if (!isValidNewPassphrase(passphrase.secret)) {
			lastFailureCode = "PASSPHRASE_TOO_SHORT";
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure("PASSPHRASE_TOO_SHORT"),
			);
			continue;
		}

		const confirmation = await readSecretPrompt(
			promptSecret,
			"Confirm passphrase",
		);

		if ("failure" in confirmation) {
			return confirmation;
		}

		if (passphrase.secret === confirmation.secret) {
			return { passphrase: passphrase.secret, stderr };
		}

		lastFailureCode = "PASSPHRASE_CONFIRMATION_MISMATCH";
	}

	const failure = presentFailure(lastFailureCode);

	return {
		failure: {
			...failure,
			stderr: `${stderr}${failure.stderr}`,
		},
	};
};

const acquireConfirmedPassphrase = async (
	input: RunCliInput,
): Promise<
	| { readonly passphrase: string; readonly stderr: string }
	| { readonly failure: RunCliResult }
> => {
	const promptSecret = requirePromptSecret(input.terminal);

	if (promptSecret === null) {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	let stderr = "";
	let lastFailureCode = "PASSPHRASE_CONFIRMATION_MISMATCH";

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await readSecretPrompt(promptSecret, "New passphrase");

		if ("failure" in passphrase) {
			return passphrase;
		}

		if (!isValidNewPassphrase(passphrase.secret)) {
			lastFailureCode = "PASSPHRASE_TOO_SHORT";
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure("PASSPHRASE_TOO_SHORT"),
			);
			continue;
		}

		const confirmation = await readSecretPrompt(
			promptSecret,
			"Confirm passphrase",
		);

		if ("failure" in confirmation) {
			return confirmation;
		}

		if (passphrase.secret === confirmation.secret) {
			return { passphrase: passphrase.secret, stderr };
		}

		lastFailureCode = "PASSPHRASE_CONFIRMATION_MISMATCH";

		if (attempt < 2) {
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH"),
			);
		}
	}

	const failure = presentFailure(lastFailureCode);

	return {
		failure: {
			...failure,
			stderr: `${stderr}${failure.stderr}`,
		},
	};
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

const matchesRecipientReference = (
	recipient: PayloadRecipient,
	reference: string,
) =>
	recipient.ownerId === reference ||
	recipient.localAlias === reference ||
	recipient.handle === reference ||
	recipient.displayName === reference;

const recipientToPublicIdentity = (
	recipient: PayloadRecipient,
): PublicIdentity => ({
	ownerId: recipient.ownerId,
	displayName: recipient.displayName,
	publicKey: recipient.publicKey,
	identityUpdatedAt: recipient.identityUpdatedAt,
});

const renderIdentityRow = (input: {
	readonly displayName: string;
	readonly ownerId: string;
	readonly localAlias: string | null;
	readonly tag?: string;
}) => {
	const displayName = sanitizeTerminalText(input.displayName);
	const localAlias =
		input.localAlias === null ? null : sanitizeTerminalText(input.localAlias);
	const ownerId = sanitizeTerminalText(input.ownerId);
	const tag =
		input.tag === undefined ? "" : ` ${sanitizeTerminalText(input.tag)}`;
	const name =
		localAlias === null ? displayName : `${localAlias} (${displayName})`;

	return `${name} ${ownerId}${tag}`;
};

const exactCommandHasAllOperands = (args: ParsedArgs) =>
	args.positionals[1] !== undefined && args.positionals[2] !== undefined;

const DEFAULT_PAYLOAD_PATH = ".env.enc";
const ENTER_PATH_CHOICE = "enter-path";
const CANCEL_CHOICE = "cancel";

const promptSelectOne = async (
	terminal: CliTerminal,
	label: string,
	choices: ReadonlyArray<{
		readonly value: string;
		readonly label: string;
		readonly disabled: boolean;
	}>,
) => {
	const selectOne = terminal.selectOne;

	if (selectOne === undefined) {
		return null;
	}

	return await selectOne(
		sanitizeTerminalText(label),
		choices.map((choice) => ({
			...choice,
			label: sanitizeTerminalText(choice.label),
		})),
	);
};

const promptPayloadPath = async (
	input: RunCliInput,
	label: string,
	defaultPath?: string,
) => {
	const rawPath = await ensurePromptText(input.terminal)(label);

	return rawPath.length === 0 && defaultPath !== undefined
		? defaultPath
		: rawPath;
};

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

	const passphrase = await acquireNewPassphrase(input);

	if ("failure" in passphrase) {
		return passphrase.failure;
	}

	const response = await input.core.commands.createSelfIdentity({
		displayName,
		passphrase: passphrase.passphrase,
	});

	if (response.result.kind === "failure") {
		const failure = presentFailure(response.result.code);

		return { ...failure, stderr: `${passphrase.stderr}${failure.stderr}` };
	}

	const success = presentSuccess(
		`Identity created: ${response.result.value.handle}`,
	);

	return { ...success, stderr: `${passphrase.stderr}${success.stderr}` };
};

const resolveExistingPayloadPath = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<string | null> => {
	const exactPath = args.positionals[1];

	if (exactPath !== undefined) {
		return exactPath;
	}

	if (input.terminal.mode !== "interactive") {
		return null;
	}

	const candidates = [...((await input.discoverPayloadPaths?.()) ?? [])].sort();

	if (candidates.length === 0) {
		return await promptPayloadPath(input, "Payload path");
	}

	const selected = await promptSelectOne(input.terminal, "Payload", [
		...candidates.map((path) => ({
			value: path,
			label: path,
			disabled: false,
		})),
		{ value: ENTER_PATH_CHOICE, label: "Enter Path", disabled: false },
		{ value: CANCEL_CHOICE, label: "Cancel", disabled: false },
	]);

	if (selected === CANCEL_CHOICE) {
		throw new CliPromptCancelledError();
	}

	if (selected === ENTER_PATH_CHOICE || selected === null) {
		return await promptPayloadPath(input, "Payload path");
	}

	return selected;
};

const resolveNewPayloadPath = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<
	| { readonly path: string; readonly overwrite: boolean }
	| { readonly failure: RunCliResult }
> => {
	let path =
		args.positionals[1] ??
		(input.terminal.mode === "interactive"
			? await promptPayloadPath(
					input,
					`Payload path (${DEFAULT_PAYLOAD_PATH})`,
					DEFAULT_PAYLOAD_PATH,
				)
			: null);

	if (path === null || path.length === 0) {
		return { failure: presentFailure("PAYLOAD_PATH_MISSING", 2) };
	}

	while ((await input.payloadPathExists?.(path)) === true) {
		if (input.terminal.mode !== "interactive") {
			return { failure: presentFailure("PAYLOAD_ALREADY_EXISTS") };
		}

		const selected = await promptSelectOne(
			input.terminal,
			"Payload already exists",
			[
				{ value: "override", label: "Override", disabled: false },
				{ value: "change-name", label: "Change Name", disabled: false },
				{ value: CANCEL_CHOICE, label: "Cancel", disabled: false },
			],
		);

		if (selected === CANCEL_CHOICE) {
			throw new CliPromptCancelledError();
		}

		if (selected === "override") {
			return { path, overwrite: true };
		}

		if (selected !== "change-name") {
			return { failure: presentFailure("PAYLOAD_ALREADY_EXISTS") };
		}

		path = await promptPayloadPath(
			input,
			`Payload path (${DEFAULT_PAYLOAD_PATH})`,
			DEFAULT_PAYLOAD_PATH,
		);

		if (path.length === 0) {
			return { failure: presentFailure("PAYLOAD_PATH_MISSING", 2) };
		}
	}

	return { path, overwrite: false };
};

const runCreatePayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const target = await resolveNewPayloadPath(args, input);

	if ("failure" in target) {
		return target.failure;
	}

	const passphrase = await acquirePassphrase(input.terminal);

	if ("failure" in passphrase) {
		return passphrase.failure;
	}

	const response = await input.core.commands.createPayload({
		path: target.path,
		passphrase: passphrase.passphrase,
		overwrite: target.overwrite,
	});

	if (response.result.kind === "failure") {
		return presentFailure(response.result.code);
	}

	return presentSuccess(`Payload created: ${response.result.value.path}`);
};

const openPayloadContext = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<
	| {
			readonly payload: DecryptedPayload;
			readonly passphrase: string;
			readonly stderr: string;
	  }
	| { readonly failure: RunCliResult }
> => {
	const path = await resolveExistingPayloadPath(args, input);

	if (path === null || path.length === 0) {
		return { failure: presentFailure("PAYLOAD_PATH_MISSING", 2) };
	}

	if ((await input.payloadPathExists?.(path)) === false) {
		return { failure: presentFailure("PAYLOAD_NOT_FOUND") };
	}

	if (input.terminal.mode === "headless") {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	let stderr = "";

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await acquirePassphrase(input.terminal);

		if ("failure" in passphrase) {
			return passphrase;
		}

		const response = await input.core.queries.decryptPayload({
			path,
			passphrase: passphrase.passphrase,
		});

		if (response.result.kind === "success") {
			return {
				payload: response.result.value,
				passphrase: passphrase.passphrase,
				stderr: `${stderr}${renderNotices(response.notices)}`,
			};
		}

		if (response.result.code !== "PASSPHRASE_INCORRECT") {
			return {
				failure: {
					...presentFailure(response.result.code),
					stderr: `${stderr}${presentFailure(response.result.code).stderr}`,
				},
			};
		}

		if (attempt < 2) {
			stderr += await emitInteractiveFeedback(input, {
				exitCode: 1,
				stdout: "",
				stderr: "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n",
			});
		}
	}

	return {
		failure: {
			...presentFailure("PASSPHRASE_INCORRECT"),
			stderr: `${stderr}${presentFailure("PASSPHRASE_INCORRECT").stderr}`,
		},
	};
};

const runInspectPayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	const result = presentPayloadInspect(opened.payload);

	return { ...result, stderr: `${opened.stderr}${result.stderr}` };
};

const runLoadPayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const protocolVersion = args.options["protocol-version"];

	if (protocolVersion === undefined) {
		return presentFailure("LOAD_PROTOCOL_REQUIRED", 2);
	}

	if (protocolVersion !== "1") {
		return presentFailure("LOAD_PROTOCOL_UNSUPPORTED", 2);
	}

	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	return {
		exitCode: 0,
		stdout: opened.payload.envText,
		stderr: opened.stderr,
	};
};

const runViewPayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	if (input.terminal.openViewer === undefined) {
		return presentFailure("VIEWER_UNAVAILABLE");
	}

	await input.terminal.openViewer(opened.payload.envText, opened.payload.path);

	return {
		...presentSuccess("Viewer closed"),
		stderr: `${opened.stderr}${presentSuccess("Viewer closed").stderr}`,
	};
};

const runEditPayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	if (
		opened.payload.compatibility !== "up-to-date" &&
		args.positionals[1] !== undefined
	) {
		return presentFailure("PAYLOAD_UPDATE_REQUIRED");
	}

	const gate = await runUpdateGateIfNeeded(
		input,
		opened,
		args.positionals[1] !== undefined,
	);

	if ("failure" in gate) {
		return gate.failure;
	}

	if (input.terminal.openEditor === undefined) {
		return presentFailure("EDITOR_UNAVAILABLE");
	}

	let stderr = gate.stderr;
	let editorText = opened.payload.envText;

	for (let attempt = 0; attempt < 5; attempt++) {
		const edited = await input.terminal.openEditor(editorText);

		if (edited.kind === "failure") {
			return {
				...presentFailure(edited.code),
				stderr: `${stderr}${presentFailure(edited.code).stderr}`,
			};
		}

		if (edited.kind === "cancel") {
			return {
				...presentFailure("CANCELLED", 130),
				stderr: `${stderr}${presentFailure("CANCELLED", 130).stderr}`,
			};
		}

		editorText = edited.text;

		if (editorText === opened.payload.envText) {
			return {
				...presentSuccess(`Payload unchanged: ${opened.payload.path}`),
				stderr: `${stderr}${presentSuccess(`Payload unchanged: ${opened.payload.path}`).stderr}`,
			};
		}

		if (!isValidEnvText(editorText)) {
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure("PAYLOAD_ENV_INVALID"),
			);
			const selected = await promptSelectOne(
				input.terminal,
				"Invalid .env content",
				[
					{ value: "reopen-editor", label: "Reopen editor", disabled: false },
					{ value: CANCEL_CHOICE, label: "Cancel", disabled: false },
				],
			);

			if (selected === CANCEL_CHOICE) {
				return {
					...presentFailure("CANCELLED", 130),
					stderr: `${stderr}${presentFailure("CANCELLED", 130).stderr}`,
				};
			}

			if (selected === "reopen-editor" || selected === null) {
				continue;
			}

			return {
				...presentFailure("CANCELLED", 130),
				stderr: `${stderr}${presentFailure("CANCELLED", 130).stderr}`,
			};
		}

		const response = await input.core.commands.editPayload({
			path: opened.payload.path,
			passphrase: opened.passphrase,
			editedEnvText: editorText,
		});

		if (response.result.kind === "failure") {
			return {
				...presentFailure(response.result.code),
				stderr: `${stderr}${presentFailure(response.result.code).stderr}`,
			};
		}

		const outcome =
			response.result.value.outcome === "unchanged" ? "unchanged" : "edited";

		return {
			...presentSuccess(`Payload ${outcome}: ${response.result.value.path}`),
			stderr: `${stderr}${presentSuccess(`Payload ${outcome}: ${response.result.value.path}`).stderr}`,
		};
	}

	return presentFailure("PAYLOAD_ENV_INVALID");
};

const resolveGrantRecipient = async (
	input: RunCliInput,
	payload: DecryptedPayload,
	reference: string,
): Promise<PublicIdentity | null> => {
	const payloadRecipient = payload.recipients.find((recipient) =>
		matchesRecipientReference(recipient, reference),
	);

	if (payloadRecipient !== undefined) {
		return recipientToPublicIdentity(payloadRecipient);
	}

	const known = await input.core.queries.listKnownIdentities();

	if (known.result.kind === "success") {
		const knownIdentity = resolveKnownIdentity(known.result.value, reference);

		if (knownIdentity !== undefined) {
			return knownIdentity.publicIdentity as PublicIdentity;
		}
	}

	return (await input.parseIdentityString?.(reference)) ?? null;
};

const grantPickerChoices = async (
	input: RunCliInput,
	payload: DecryptedPayload,
) => {
	const known = await input.core.queries.listKnownIdentities();
	const knownIdentities =
		known.result.kind === "success" ? known.result.value : [];
	const payloadOwnerIds = new Set(
		payload.recipients.map((recipient) => recipient.ownerId),
	);
	const choices = payload.recipients.map((recipient) => ({
		value: recipient.ownerId,
		label: renderIdentityRow({
			displayName: recipient.displayName,
			ownerId: recipient.ownerId,
			localAlias: recipient.localAlias,
			tag: recipient.isSelf ? "[you]" : "[granted]",
		}),
		disabled: true,
	}));

	for (const identity of knownIdentities) {
		if (!payloadOwnerIds.has(identity.ownerId)) {
			choices.push({
				value: identity.ownerId,
				label: renderIdentityRow({
					displayName: identity.publicIdentity.displayName,
					ownerId: identity.ownerId,
					localAlias: identity.localAlias,
				}),
				disabled: false,
			});
		}
	}

	choices.push({
		value: "__custom_identity_string__",
		label: "Enter identity string",
		disabled: false,
	});

	return choices;
};

const promptCustomGrantIdentity = async (
	input: RunCliInput,
): Promise<
	| { readonly recipient: PublicIdentity; readonly stderr: string }
	| { readonly failure: RunCliResult }
> => {
	let stderr = "";

	for (let attempt = 0; attempt < 3; attempt++) {
		const identityString = await ensurePromptText(input.terminal)(
			"Identity string",
		);
		const recipient = await input.parseIdentityString?.(identityString);

		if (recipient !== null && recipient !== undefined) {
			const response = await importKnownIdentityWithTrustGate({
				cli: input,
				identityString,
			});

			if (response.result.kind === "failure") {
				return {
					failure: {
						...presentFailure(response.result.code),
						stderr: `${stderr}${presentFailure(response.result.code).stderr}`,
					},
				};
			}

			return { recipient, stderr };
		}

		if (attempt < 2) {
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure("IDENTITY_STRING_INVALID"),
			);
		}
	}

	return {
		failure: {
			...presentFailure("IDENTITY_STRING_INVALID"),
			stderr: `${stderr}${presentFailure("IDENTITY_STRING_INVALID").stderr}`,
		},
	};
};

const runUpdateGateIfNeeded = async (
	input: RunCliInput,
	opened: {
		readonly payload: DecryptedPayload;
		readonly passphrase: string;
		readonly stderr: string;
	},
	isExact: boolean,
): Promise<
	{ readonly stderr: string } | { readonly failure: RunCliResult }
> => {
	if (opened.payload.compatibility === "up-to-date") {
		return { stderr: opened.stderr };
	}

	if (isExact) {
		return { failure: presentFailure("PAYLOAD_UPDATE_REQUIRED") };
	}

	const selected = await promptSelectOne(
		input.terminal,
		"Payload update required",
		[
			{ value: "update-now", label: "Update now", disabled: false },
			{ value: "back", label: "Back", disabled: false },
			{ value: "cancel", label: "Cancel", disabled: false },
		],
	);

	if (selected !== "update-now") {
		return { failure: presentFailure("CANCELLED", 130) };
	}

	const response = await input.core.commands.updatePayload({
		path: opened.payload.path,
		passphrase: opened.passphrase,
	});

	if (response.result.kind === "failure") {
		return { failure: presentFailure(response.result.code) };
	}

	return {
		stderr: `${opened.stderr}${presentSuccess(`Payload ${response.result.value.outcome}: ${response.result.value.path}`).stderr}`,
	};
};

const runGrantPayloadRecipient = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	const isExact = exactCommandHasAllOperands(args);
	const gate = await runUpdateGateIfNeeded(input, opened, isExact);

	if ("failure" in gate) {
		return gate.failure;
	}

	const reference =
		args.positionals[2] ??
		(await promptSelectOne(
			input.terminal,
			"Grant recipient",
			await grantPickerChoices(input, opened.payload),
		));

	if (reference === null || reference === undefined) {
		return presentFailure("RECIPIENT_REFERENCE_NOT_FOUND", 2);
	}

	const resolved =
		reference === "__custom_identity_string__"
			? await promptCustomGrantIdentity(input)
			: {
					recipient: await resolveGrantRecipient(
						input,
						opened.payload,
						reference,
					),
					stderr: "",
				};

	if ("failure" in resolved) {
		return {
			...resolved.failure,
			stderr: `${gate.stderr}${resolved.failure.stderr}`,
		};
	}

	const recipient = resolved.recipient;

	if (recipient === null) {
		return presentFailure("RECIPIENT_REFERENCE_NOT_FOUND");
	}

	if (
		opened.payload.recipients.some(
			(item) => item.isSelf && item.ownerId === recipient.ownerId,
		)
	) {
		return presentFailure("CANNOT_GRANT_SELF");
	}

	const response = await input.core.commands.grantPayloadRecipient({
		path: opened.payload.path,
		passphrase: opened.passphrase,
		recipient,
	});

	if (response.result.kind === "failure") {
		return {
			...presentFailure(response.result.code),
			stderr: `${gate.stderr}${resolved.stderr}${presentFailure(response.result.code).stderr}`,
		};
	}

	const outcomeLabel =
		response.result.value.outcome === "added"
			? "granted"
			: response.result.value.outcome;
	const successResult = presentSuccess(
		`Recipient ${outcomeLabel}: ${recipient.displayName}#${recipient.publicKey}`,
	);

	return {
		...successResult,
		stderr: `${gate.stderr}${resolved.stderr}${successResult.stderr}`,
	};
};

const resolvePayloadRecipient = (
	payload: DecryptedPayload,
	reference: string,
) =>
	payload.recipients.find((recipient) =>
		matchesRecipientReference(recipient, reference),
	);

const revokePickerChoices = (payload: DecryptedPayload) =>
	payload.recipients.map((recipient) => ({
		value: recipient.ownerId,
		label: renderIdentityRow({
			displayName: recipient.displayName,
			ownerId: recipient.ownerId,
			localAlias: recipient.localAlias,
			...(recipient.isSelf ? { tag: "[you]" } : {}),
		}),
		disabled: recipient.isSelf,
	}));

const runRevokePayloadRecipient = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	const isExact = exactCommandHasAllOperands(args);
	const gate = await runUpdateGateIfNeeded(input, opened, isExact);

	if ("failure" in gate) {
		return gate.failure;
	}

	const reference =
		args.positionals[2] ??
		(await promptSelectOne(
			input.terminal,
			"Revoke recipient",
			revokePickerChoices(opened.payload),
		));

	if (reference === null || reference === undefined) {
		return presentFailure("RECIPIENT_REFERENCE_NOT_FOUND", 2);
	}

	const recipient = resolvePayloadRecipient(opened.payload, reference);

	if (recipient === undefined) {
		return presentFailure("RECIPIENT_REFERENCE_NOT_FOUND");
	}

	if (recipient.isSelf) {
		return presentFailure("CANNOT_REVOKE_SELF");
	}

	const response = await input.core.commands.revokePayloadRecipient({
		path: opened.payload.path,
		passphrase: opened.passphrase,
		recipientOwnerId: recipient.ownerId,
	});

	if (response.result.kind === "failure") {
		return {
			...presentFailure(response.result.code),
			stderr: `${gate.stderr}${presentFailure(response.result.code).stderr}`,
		};
	}

	const outcomeLabel =
		response.result.value.outcome === "removed"
			? "revoked"
			: response.result.value.outcome;
	const successResult = presentSuccess(
		`Recipient ${outcomeLabel}: ${response.result.value.recipientOwnerId}`,
	);

	return {
		...successResult,
		stderr: `${gate.stderr}${successResult.stderr}`,
	};
};

const runUpdatePayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const opened = await openPayloadContext(args, input);

	if ("failure" in opened) {
		return opened.failure;
	}

	const response = await input.core.commands.updatePayload({
		path: opened.payload.path,
		passphrase: opened.passphrase,
	});

	if (response.result.kind === "failure") {
		return presentFailure(response.result.code);
	}

	return presentSuccess(
		`Payload ${response.result.value.outcome}: ${response.result.value.path}`,
	);
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
	const identityStringFromArgs = args.positionals[2];

	if (
		input.terminal.mode !== "interactive" &&
		(identityStringFromArgs === undefined ||
			identityStringFromArgs.length === 0)
	) {
		return presentFailure("IDENTITY_STRING_MISSING", 2);
	}

	let stderr = "";
	const aliasFromOption = args.options.alias;
	const trustKeyUpdate = args.options["trust-key-update"] === "true";
	const maxAttempts = input.terminal.mode === "interactive" ? 3 : 1;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const identityString =
			identityStringFromArgs ??
			(await ensurePromptText(input.terminal)("Identity string"));

		if (identityString.length === 0) {
			return {
				...presentFailure("IDENTITY_STRING_MISSING", 2),
				stderr: `${stderr}${presentFailure("IDENTITY_STRING_MISSING", 2).stderr}`,
			};
		}

		const promptedAlias =
			aliasFromOption ??
			(input.terminal.mode === "interactive"
				? await ensurePromptText(input.terminal)("Local alias")
				: undefined);
		const localAlias =
			promptedAlias === undefined || promptedAlias.length === 0
				? undefined
				: promptedAlias;
		const response = await importKnownIdentityWithTrustGate({
			cli: input,
			identityString,
			...(localAlias === undefined ? {} : { localAlias }),
			...(trustKeyUpdate ? { trustKeyUpdate } : {}),
		});

		if (response.result.kind === "success") {
			const result = presentSuccess(
				`Identity imported: ${response.result.value.handle}`,
			);

			return { ...result, stderr: `${stderr}${result.stderr}` };
		}

		if (
			input.terminal.mode === "interactive" &&
			identityStringFromArgs === undefined &&
			response.result.code === "IDENTITY_STRING_INVALID"
		) {
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure(response.result.code),
			);
			continue;
		}

		if (
			input.terminal.mode === "interactive" &&
			aliasFromOption === undefined &&
			(response.result.code === "LOCAL_ALIAS_DUPLICATE" ||
				response.result.code === "LOCAL_ALIAS_INVALID")
		) {
			stderr += await emitInteractiveFeedback(
				input,
				presentFailure(response.result.code),
			);
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
	const listed = await input.core.queries.listKnownIdentities();

	if (listed.result.kind === "failure") {
		return presentFailure(listed.result.code);
	}

	const reference =
		args.positionals[2] ??
		(input.terminal.mode === "interactive"
			? await promptSelectOne(input.terminal, "Identity", [
					...listed.result.value.map((identity) => ({
						value: identity.ownerId,
						label: renderIdentityRow({
							displayName: identity.publicIdentity.displayName,
							ownerId: identity.ownerId,
							localAlias: identity.localAlias,
						}),
						disabled: false,
					})),
					{ value: CANCEL_CHOICE, label: "Cancel", disabled: false },
				])
			: undefined);

	if (reference === undefined || reference === null || reference.length === 0) {
		return presentFailure("IDENTITY_REFERENCE_MISSING", 2);
	}

	if (reference === CANCEL_CHOICE) {
		return presentFailure("CANCELLED", 130);
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

const runIdentityRotate = async (input: RunCliInput): Promise<RunCliResult> => {
	if (input.terminal.mode === "headless") {
		return presentFailure("PASSPHRASE_UNAVAILABLE");
	}

	let stderr = "";

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await acquirePassphrase(input.terminal);

		if ("failure" in passphrase) {
			return passphrase.failure;
		}

		const response = await input.core.commands.rotateSelfIdentity({
			passphrase: passphrase.passphrase,
		});

		if (response.result.kind === "success") {
			const success = presentSuccess(
				`Identity rotated: ${response.result.value.nextFingerprint}`,
			);

			return {
				...success,
				stderr: `${stderr}${success.stderr}${presentWarning("Existing payloads may need update: run bage update")}`,
			};
		}

		if (response.result.code !== "PASSPHRASE_INCORRECT" || attempt === 2) {
			const failure = presentFailure(response.result.code);

			return { ...failure, stderr: `${stderr}${failure.stderr}` };
		}

		stderr += await emitInteractiveFeedback(input, {
			exitCode: 1,
			stdout: "",
			stderr: "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n",
		});
	}

	return presentFailure("PASSPHRASE_INCORRECT");
};

const runIdentityPassphrase = async (
	input: RunCliInput,
): Promise<RunCliResult> => {
	const promptSecret = requirePromptSecret(input.terminal);

	if (promptSecret === null) {
		return presentFailure("PASSPHRASE_UNAVAILABLE");
	}

	let stderr = "";

	for (let attempt = 0; attempt < 3; attempt++) {
		const currentPassphrase = await readSecretPrompt(
			promptSecret,
			"Current passphrase",
		);

		if ("failure" in currentPassphrase) {
			return currentPassphrase.failure;
		}

		const verification = await input.core.queries.verifySelfIdentityPassphrase({
			passphrase: currentPassphrase.secret,
		});

		if (verification.result.kind === "failure") {
			if (
				verification.result.code !== "PASSPHRASE_INCORRECT" ||
				attempt === 2
			) {
				const failure = presentFailure(verification.result.code);

				return { ...failure, stderr: `${stderr}${failure.stderr}` };
			}

			stderr += await emitInteractiveFeedback(input, {
				exitCode: 1,
				stdout: "",
				stderr: "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n",
			});
			continue;
		}

		const nextPassphrase = await acquireConfirmedPassphrase(input);

		if ("failure" in nextPassphrase) {
			return {
				...nextPassphrase.failure,
				stderr: `${stderr}${nextPassphrase.failure.stderr}`,
			};
		}

		stderr += nextPassphrase.stderr;

		const response = await input.core.commands.changeIdentityPassphrase({
			currentPassphrase: currentPassphrase.secret,
			nextPassphrase: nextPassphrase.passphrase,
		});

		if (response.result.kind === "success") {
			const success = presentSuccess("Passphrase changed");

			return { ...success, stderr: `${stderr}${success.stderr}` };
		}

		const failure = presentFailure(response.result.code);

		return { ...failure, stderr: `${stderr}${failure.stderr}` };
	}

	return presentFailure("PASSPHRASE_INCORRECT");
};

const choice = (value: string, label = value) => ({
	value,
	label,
	disabled: false,
});

const rootBeforeSetupChoices = [choice("setup"), choice("quit", "Quit")];

const rootAfterSetupChoices = [
	choice("files", "Files"),
	choice("identities", "Identities"),
	choice("quit", "Quit"),
];

const filesMenuChoices = [
	choice("create"),
	choice("edit"),
	choice("grant"),
	choice("inspect"),
	choice("revoke"),
	choice("update"),
	choice("view"),
	choice("back", "Back"),
	choice("quit", "Quit"),
];

const identitiesMenuChoices = [
	choice("identity export"),
	choice("identity import"),
	choice("identity list"),
	choice("identity forget"),
	choice("identity passphrase"),
	choice("identity rotate"),
	choice("back", "Back"),
	choice("quit", "Quit"),
];

type InteractiveMenu = "root" | "files" | "identities";

const appendSessionResult = (
	session: RunCliResult,
	result: RunCliResult,
): RunCliResult => ({
	exitCode: result.exitCode,
	stdout: `${session.stdout}${result.stdout}`,
	stderr: `${session.stderr}${result.stderr}`,
});

const publishInteractiveResult = async (
	input: RunCliInput,
	session: RunCliResult,
	result: RunCliResult,
): Promise<RunCliResult> => {
	if (input.terminal.writeResult === undefined) {
		return appendSessionResult(session, result);
	}

	await input.terminal.writeResult(result);

	if (result.stdout.length > 0) {
		await input.terminal.waitForEnter?.("Press Enter");
	}

	return session;
};

const runInteractiveSession = async (
	input: RunCliInput,
): Promise<RunCliResult> => {
	if (
		input.terminal.mode === "headless" ||
		input.terminal.selectOne === undefined
	) {
		return presentFailure("INTERACTIVE_UNAVAILABLE");
	}

	let activeMenu: InteractiveMenu = "root";
	let session: RunCliResult = { exitCode: 0, stdout: "", stderr: "" };

	while (true) {
		const homeStatus = await input.core.queries.getHomeStatus();

		if (homeStatus.result.kind === "failure") {
			return appendSessionResult(
				session,
				presentFailure(homeStatus.result.code),
			);
		}

		const isSetup = homeStatus.result.value.status === "setup";

		if (!isSetup && activeMenu !== "root") {
			activeMenu = "root";
		}

		const choices =
			activeMenu === "files"
				? filesMenuChoices
				: activeMenu === "identities"
					? identitiesMenuChoices
					: isSetup
						? rootAfterSetupChoices
						: rootBeforeSetupChoices;

		let selected: string;

		try {
			selected = await input.terminal.selectOne("Command", choices);
		} catch (cause) {
			if (isPromptCancelledError(cause)) {
				return appendSessionResult(session, presentFailure("CANCELLED", 130));
			}

			throw cause;
		}

		if (selected === "quit") {
			return { ...session, exitCode: 0 };
		}

		if (selected === "back") {
			activeMenu = "root";
			continue;
		}

		if (selected === "files" || selected === "identities") {
			activeMenu = selected;
			continue;
		}

		const result = await runCli({
			...input,
			argv: selected.split(" "),
		});
		session = await publishInteractiveResult(input, session, result);
	}
};

const runCliUnstyled = async (input: RunCliInput): Promise<RunCliResult> => {
	const args = parseArgs(input.argv);
	const [command, subcommand] = args.positionals;

	if (command === "interactive" || command === "i") {
		return runInteractiveSession(input);
	}

	if (command === "setup") {
		return runSetup(args, input);
	}

	if (command === "create") {
		return runCreatePayload(args, input);
	}

	if (command === "inspect") {
		return runInspectPayload(args, input);
	}

	if (command === "load") {
		return runLoadPayload(args, input);
	}

	if (command === "view") {
		return runViewPayload(args, input);
	}

	if (command === "edit") {
		return runEditPayload(args, input);
	}

	if (command === "grant") {
		return runGrantPayloadRecipient(args, input);
	}

	if (command === "revoke") {
		return runRevokePayloadRecipient(args, input);
	}

	if (command === "update") {
		return runUpdatePayload(args, input);
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

	if (command === "identity" && subcommand === "rotate") {
		return runIdentityRotate(input);
	}

	if (
		command === "identity" &&
		(subcommand === "passphrase" ||
			subcommand === "pass" ||
			subcommand === "pw")
	) {
		return runIdentityPassphrase(input);
	}

	return presentFailure("COMMAND_UNKNOWN", 2);
};

export const runCli = async (input: RunCliInput): Promise<RunCliResult> => {
	let result: RunCliResult;

	try {
		result = await runCliUnstyled(input);
	} catch (cause) {
		if (isPromptCancelledError(cause)) {
			result = presentFailure("CANCELLED", 130);
		} else {
			throw cause;
		}
	}

	return styleRunCliResult(result, {
		color: input.terminal.presentation?.color ?? false,
	});
};
