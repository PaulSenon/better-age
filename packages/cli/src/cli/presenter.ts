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

const failureMessage = (code: string) => {
	switch (code) {
		case "HOME_STATE_NOT_FOUND":
			return "run bage setup first";
		case "IDENTITY_REFERENCE_NOT_FOUND":
			return "identity reference not found";
		case "LOCAL_ALIAS_DUPLICATE":
			return "alias already exists";
		case "LOCAL_ALIAS_INVALID":
			return "alias is invalid";
		case "PASSPHRASE_CONFIRMATION_MISMATCH":
			return "passphrase confirmation did not match";
		case "PASSPHRASE_UNAVAILABLE":
			return "cannot prompt in headless mode";
		case "SETUP_NAME_MISSING":
			return "pass --name or run setup interactively";
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
