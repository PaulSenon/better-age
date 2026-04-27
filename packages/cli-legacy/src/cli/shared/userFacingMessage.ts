import { Effect } from "effect";
import { Prompt } from "../../port/Prompt.js";

type UserFacingErrorId =
	| "ERR.IDENTITY.CONFLICT"
	| "ERR.IDENTITY.IMPORT_FAILED"
	| "ERR.IDENTITY.EXPORT_FAILED"
	| "ERR.IDENTITY.INSPECT_FAILED"
	| "ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED"
	| "ERR.IDENTITY.ROTATE_FAILED"
	| "ERR.IDENTITY_STRING.INVALID"
	| "ERR.LOAD.PROTOCOL_REQUIRED"
	| "ERR.LOAD.PROTOCOL_UNSUPPORTED"
	| "ERR.PAYLOAD.DECRYPT_FAILED"
	| "ERR.PAYLOAD.INVALID_FORMAT"
	| "ERR.PASSPHRASE.UNAVAILABLE"
	| "ERR.PROMPT.UNAVAILABLE"
	| "ERR.UPDATE.FAILED"
	| "ERR.SETUP.ALIAS_INVALID"
	| "ERR.SETUP.ALIAS_REQUIRED"
	| "ERR.SETUP.ALREADY_CONFIGURED"
	| "ERR.SETUP.CREATE_FAILED"
	| "ERR.SETUP.REQUIRED";

type UserFacingWarningId = "WARN.LOAD.UPDATE_REQUIRED";

const joinLines = (lines: ReadonlyArray<string>) => lines.join("\n");

export const renderUserFacingError = (input: {
	readonly id: UserFacingErrorId;
	readonly path?: string;
	readonly receivedVersion?: string;
}) => {
	switch (input.id) {
		case "ERR.IDENTITY.CONFLICT":
			return joinLines([
				"Imported identity conflicts with existing local state",
				"Resolve conflict before retrying import",
				"",
			]);
		case "ERR.IDENTITY.IMPORT_FAILED":
			return joinLines(["Failed to save imported identity", "Retry", ""]);
		case "ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED":
			return joinLines(["Failed to change local passphrase", "Retry", ""]);
		case "ERR.IDENTITY.ROTATE_FAILED":
			return joinLines(["Failed to rotate local identity", "Retry", ""]);
		case "ERR.IDENTITY_STRING.INVALID":
			return joinLines(["Invalid identity string", ""]);
		case "ERR.PAYLOAD.DECRYPT_FAILED":
			return joinLines([
				"Failed to decrypt payload with provided passphrase",
				"",
			]);
		case "ERR.PAYLOAD.INVALID_FORMAT":
			return joinLines([`Invalid payload format: ${input.path}`, ""]);
		case "ERR.LOAD.PROTOCOL_REQUIRED":
			return joinLines([
				"Missing required protocol version",
				"Run with: --protocol-version=1",
				"",
			]);
		case "ERR.LOAD.PROTOCOL_UNSUPPORTED":
			return joinLines([
				`Unsupported protocol version: ${"receivedVersion" in input ? input.receivedVersion : ""}`,
				"This better-age CLI supports protocol version 1.",
				"Update the caller/plugin to a compatible version.",
				"",
			]);
		case "ERR.PASSPHRASE.UNAVAILABLE":
			return joinLines([
				"Secure passphrase input is unavailable in this environment",
				"Use an interactive terminal",
				"",
			]);
		case "ERR.PROMPT.UNAVAILABLE":
			return joinLines([
				"Interactive input is unavailable in this environment",
				"Use an interactive terminal or pass all required inputs explicitly when supported",
				"",
			]);
		case "ERR.UPDATE.FAILED":
			return joinLines([`Failed to update payload: ${input.path}`, ""]);
		case "ERR.SETUP.ALIAS_INVALID":
			return joinLines(["Invalid display name", ""]);
		case "ERR.SETUP.ALIAS_REQUIRED":
			return joinLines([
				"Missing required display name",
				"Run: bage setup --alias <display-name>",
				"",
			]);
		case "ERR.SETUP.ALREADY_CONFIGURED":
			return joinLines([
				"Local self identity already exists",
				"Use existing identity or rotate it",
				"",
			]);
		case "ERR.SETUP.CREATE_FAILED":
			return joinLines(["Failed to create local identity", "Retry setup", ""]);
		case "ERR.SETUP.REQUIRED":
			return joinLines(["No local self identity found", "Run: bage setup", ""]);
		case "ERR.IDENTITY.EXPORT_FAILED":
			return joinLines(["Failed to export identity string", "Retry", ""]);
		case "ERR.IDENTITY.INSPECT_FAILED":
			return joinLines(["Failed to inspect local identities", "Retry", ""]);
	}
};

export const renderUserFacingWarning = (input: {
	readonly id: UserFacingWarningId;
	readonly path: string;
}) => {
	switch (input.id) {
		case "WARN.LOAD.UPDATE_REQUIRED":
			return joinLines([
				"Warning: payload should be updated",
				`Run: bage update ${input.path}`,
				"",
			]);
	}
};

export const writeUserFacingError = (input: {
	readonly id: UserFacingErrorId;
	readonly path?: string;
	readonly receivedVersion?: string;
}) => Prompt.writeStderr(renderUserFacingError(input));

export const writeUserFacingWarning = (input: {
	readonly id: UserFacingWarningId;
	readonly path: string;
}) => Prompt.writeStderr(renderUserFacingWarning(input));

export const writeUserFacingInfo = (text: string) => Prompt.writeStdout(text);

export const asCommandFailure = <E extends Error, R>(
	failure: E,
	effect: Effect.Effect<void, never, R>,
) => effect.pipe(Effect.flatMap(() => Effect.fail(failure)));
