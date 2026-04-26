import {
	presentFailure,
	presentIdentityList,
	presentIdentityString,
	presentPayloadInspect,
	presentSuccess,
	presentWarning,
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
	readonly openEditor?: (initialText: string) => Promise<
		| { readonly kind: "cancel" }
		| {
				readonly kind: "failure";
				readonly code: "EDITOR_EXIT_NON_ZERO" | "EDITOR_UNAVAILABLE";
		  }
		| { readonly kind: "saved"; readonly text: string }
	>;
	readonly openViewer?: (envText: string, path: string) => Promise<void>;
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
};

export type RunCliInput = {
	readonly argv: ReadonlyArray<string>;
	readonly core: CliCore;
	readonly parseIdentityString?: (
		identityString: string,
	) => Promise<PublicIdentity | null>;
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
				: presentWarning(notice.code),
		)
		.join("");

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
		const passphrase = await readSecretPrompt(promptSecret, "Passphrase");

		if ("failure" in passphrase) {
			return passphrase;
		}

		const confirmation = await readSecretPrompt(
			promptSecret,
			"Confirm passphrase",
		);

		if ("failure" in confirmation) {
			return confirmation;
		}

		if (passphrase.secret === confirmation.secret) {
			return { passphrase: passphrase.secret };
		}
	}

	return { failure: presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH") };
};

const acquireConfirmedPassphrase = async (
	terminal: CliTerminal,
): Promise<
	| { readonly passphrase: string; readonly stderr: string }
	| { readonly failure: RunCliResult }
> => {
	const promptSecret = requirePromptSecret(terminal);

	if (promptSecret === null) {
		return { failure: presentFailure("PASSPHRASE_UNAVAILABLE") };
	}

	let stderr = "";

	for (let attempt = 0; attempt < 3; attempt++) {
		const passphrase = await readSecretPrompt(promptSecret, "New passphrase");

		if ("failure" in passphrase) {
			return passphrase;
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

		if (attempt < 2) {
			stderr += presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH").stderr;
		}
	}

	return {
		failure: {
			...presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH"),
			stderr: `${stderr}${presentFailure("PASSPHRASE_CONFIRMATION_MISMATCH").stderr}`,
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

const exactCommandHasAllOperands = (args: ParsedArgs) =>
	args.positionals[1] !== undefined && args.positionals[2] !== undefined;

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

	return await selectOne(label, choices);
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

const resolvePayloadPath = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<string | null> =>
	args.positionals[1] ??
	(input.terminal.mode === "interactive"
		? await ensurePromptText(input.terminal)("Payload path")
		: null);

const runCreatePayload = async (
	args: ParsedArgs,
	input: RunCliInput,
): Promise<RunCliResult> => {
	const path = await resolvePayloadPath(args, input);

	if (path === null || path.length === 0) {
		return presentFailure("PAYLOAD_PATH_MISSING", 2);
	}

	if ((await input.payloadPathExists?.(path)) === true) {
		return presentFailure("PAYLOAD_ALREADY_EXISTS");
	}

	const passphrase = await acquirePassphrase(input.terminal);

	if ("failure" in passphrase) {
		return passphrase.failure;
	}

	const response = await input.core.commands.createPayload({
		path,
		passphrase: passphrase.passphrase,
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
	const path = await resolvePayloadPath(args, input);

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
			stderr += "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n";
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
			stderr += presentFailure("PAYLOAD_ENV_INVALID").stderr;
			continue;
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
		label: `${recipient.localAlias ?? recipient.displayName} ${recipient.ownerId} ${
			recipient.isSelf ? "[you]" : "[granted]"
		}`,
		disabled: true,
	}));

	for (const identity of knownIdentities) {
		if (!payloadOwnerIds.has(identity.ownerId)) {
			choices.push({
				value: identity.ownerId,
				label: `${identity.localAlias ?? identity.publicIdentity.displayName} ${identity.ownerId}`,
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

	const identityReference =
		reference === "__custom_identity_string__"
			? await ensurePromptText(input.terminal)("Identity string")
			: reference;
	const recipient = await resolveGrantRecipient(
		input,
		opened.payload,
		identityReference,
	);

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
			stderr: `${gate.stderr}${presentFailure(response.result.code).stderr}`,
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
		stderr: `${gate.stderr}${successResult.stderr}`,
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
		label: `${recipient.localAlias ?? recipient.displayName} ${recipient.ownerId}${
			recipient.isSelf ? " [you]" : ""
		}`,
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

		stderr += "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n";
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

			stderr += "[ERROR] PASSPHRASE_INCORRECT: invalid passphrase, try again\n";
			continue;
		}

		const nextPassphrase = await acquireConfirmedPassphrase(input.terminal);

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

const interactiveCommandChoices = [
	{ value: "create", label: "create", disabled: false },
	{ value: "edit", label: "edit", disabled: false },
	{ value: "grant", label: "grant", disabled: false },
	{ value: "inspect", label: "inspect", disabled: false },
	{ value: "load", label: "load", disabled: false },
	{ value: "revoke", label: "revoke", disabled: false },
	{ value: "update", label: "update", disabled: false },
	{ value: "view", label: "view", disabled: false },
	{ value: "identity export", label: "identity export", disabled: false },
	{ value: "identity import", label: "identity import", disabled: false },
	{ value: "identity list", label: "identity list", disabled: false },
	{ value: "identity forget", label: "identity forget", disabled: false },
	{
		value: "identity passphrase",
		label: "identity passphrase",
		disabled: false,
	},
	{ value: "identity rotate", label: "identity rotate", disabled: false },
	{ value: "setup", label: "setup", disabled: false },
	{ value: "__cancel__", label: "Cancel", disabled: false },
] as const;

const runInteractiveSession = async (
	input: RunCliInput,
): Promise<RunCliResult> => {
	if (
		input.terminal.mode === "headless" ||
		input.terminal.selectOne === undefined
	) {
		return presentFailure("INTERACTIVE_UNAVAILABLE");
	}

	const selected = await input.terminal.selectOne(
		"Command",
		interactiveCommandChoices,
	);

	if (selected === "__cancel__") {
		return presentFailure("CANCELLED", 130);
	}

	return await runCli({
		...input,
		argv: selected.split(" "),
	});
};

export const runCli = async (input: RunCliInput): Promise<RunCliResult> => {
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
