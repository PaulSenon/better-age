import type { RunCliResult } from "./runCli.js";

export type IdentityListView = {
	readonly self: {
		readonly ownerId: string;
		readonly publicIdentity: { readonly displayName: string };
		readonly fingerprint: string;
	};
	readonly known: ReadonlyArray<{
		readonly ownerId: string;
		readonly publicIdentity: { readonly displayName: string };
		readonly fingerprint: string;
		readonly localAlias: string | null;
	}>;
	readonly retired: ReadonlyArray<{
		readonly fingerprint: string;
		readonly retiredAt: string;
	}>;
};

export type PayloadInspectView = {
	readonly path: string;
	readonly payloadId: string;
	readonly schemaVersion: number;
	readonly compatibility: string;
	readonly envKeys: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<{
		readonly ownerId: string;
		readonly displayName: string;
		readonly fingerprint: string;
		readonly localAlias: string | null;
		readonly isSelf: boolean;
		readonly isStaleSelf: boolean;
	}>;
};

const failureMessage = (code: string) => {
	switch (code) {
		case "CANCELLED":
			return "command cancelled";
		case "EDITOR_UNAVAILABLE":
			return "editor is unavailable";
		case "HOME_STATE_NOT_FOUND":
			return "run bage setup first";
		case "IDENTITY_REFERENCE_NOT_FOUND":
			return "identity reference not found";
		case "LOCAL_ALIAS_DUPLICATE":
			return "alias already exists";
		case "LOCAL_ALIAS_INVALID":
			return "alias is invalid";
		case "LOAD_PROTOCOL_REQUIRED":
			return "pass --protocol-version=1";
		case "LOAD_PROTOCOL_UNSUPPORTED":
			return "supported protocol version is 1";
		case "PASSPHRASE_CONFIRMATION_MISMATCH":
			return "passphrase confirmation did not match";
		case "PASSPHRASE_INCORRECT":
			return "invalid passphrase";
		case "PASSPHRASE_UNAVAILABLE":
			return "cannot prompt in headless mode";
		case "PAYLOAD_ALREADY_EXISTS":
			return "payload already exists";
		case "PAYLOAD_NOT_FOUND":
			return "payload not found";
		case "PAYLOAD_ENV_INVALID":
			return "invalid .env content";
		case "PAYLOAD_PATH_MISSING":
			return "pass a payload path or run interactively";
		case "SETUP_NAME_MISSING":
			return "pass --name or run setup interactively";
		case "VIEWER_UNAVAILABLE":
			return "secure viewer is unavailable";
		default:
			return "command failed";
	}
};

export const presentSuccess = (message: string): RunCliResult => ({
	exitCode: 0,
	stdout: "",
	stderr: `[OK] ${message}\n`,
});

export const presentFailure = (code: string, exitCode = 1): RunCliResult => ({
	exitCode,
	stdout: "",
	stderr: `[ERROR] ${code}: ${failureMessage(code)}\n`,
});

export const presentIdentityString = (
	identityString: string,
): RunCliResult => ({
	exitCode: 0,
	stdout: `${identityString}\n`,
	stderr: "",
});

export const presentIdentityList = (input: IdentityListView): RunCliResult => {
	const knownLines =
		input.known.length === 0
			? "  none\n"
			: input.known
					.map((identity) => {
						const name =
							identity.localAlias ?? identity.publicIdentity.displayName;
						return `  ${name} ${identity.ownerId} ${identity.fingerprint}\n`;
					})
					.join("");
	const retiredLines =
		input.retired.length === 0
			? "  none\n"
			: input.retired
					.map((key) => `  ${key.fingerprint} ${key.retiredAt}\n`)
					.join("");

	return {
		exitCode: 0,
		stdout: [
			"Self\n",
			`  ${input.self.publicIdentity.displayName} ${input.self.ownerId} ${input.self.fingerprint}\n`,
			"\nKnown identities\n",
			knownLines,
			"\nRetired keys\n",
			retiredLines,
		].join(""),
		stderr: "",
	};
};

export const presentWarning = (message: string): string =>
	`[WARN] ${message}\n`;

export const presentPayloadInspect = (
	input: PayloadInspectView,
): RunCliResult => {
	const envKeyLines =
		input.envKeys.length === 0
			? "  none\n"
			: input.envKeys.map((key) => `  ${key}\n`).join("");
	const recipientLines =
		input.recipients.length === 0
			? "  none\n"
			: input.recipients
					.map((recipient) => {
						const name = recipient.localAlias ?? recipient.displayName;
						const tags = [
							recipient.isSelf ? "[you]" : "",
							recipient.isStaleSelf ? "[stale]" : "",
						]
							.filter((tag) => tag.length > 0)
							.join(" ");
						const suffix = tags.length === 0 ? "" : ` ${tags}`;

						return `  ${name} ${recipient.ownerId} ${recipient.fingerprint}${suffix}\n`;
					})
					.join("");

	return {
		exitCode: 0,
		stdout: [
			"Payload\n",
			`  path: ${input.path}\n`,
			`  payload id: ${input.payloadId}\n`,
			`  schema version: ${input.schemaVersion}\n`,
			`  compatibility: ${input.compatibility}\n`,
			"\nEnv keys\n",
			envKeyLines,
			"\nRecipients\n",
			recipientLines,
		].join(""),
		stderr: "",
	};
};
