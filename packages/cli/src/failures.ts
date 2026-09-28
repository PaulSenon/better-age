// Every user-visible failure: Core's tagged errors plus CLI-only failures.
// Rendered as `[ERROR] <CODE>: <message>` on stderr with a stable exit code.
import type {
	BetterAgeError,
	BetterAgeErrorCode,
} from "@better-age/core/Errors";
import { Data } from "effect";

export type CliCode =
	| "CANCELLED"
	| "COMMAND_PARSE"
	| "EDITOR_EXIT_NON_ZERO"
	| "EDITOR_UNAVAILABLE"
	| "IDENTITY_REFERENCE_MISSING"
	| "IDENTITY_STRING_MISSING"
	| "INTERACTIVE_UNAVAILABLE"
	| "LOAD_PROTOCOL_REQUIRED"
	| "LOAD_PROTOCOL_UNSUPPORTED"
	| "PASSPHRASE_CONFIRMATION_MISMATCH"
	| "PASSPHRASE_TOO_SHORT"
	| "PASSPHRASE_UNAVAILABLE"
	| "PAYLOAD_PATH_MISSING"
	| "RECIPIENT_REFERENCE_NOT_FOUND"
	| "SETUP_NAME_MISSING"
	| "UNEXPECTED"
	| "VIEWER_UNAVAILABLE";

/** 2 = usage error, 130 = cancelled, 1 = everything else. */
export type ExitCode = 1 | 2 | 130;

export class CliFailure extends Data.TaggedError("CliFailure")<{
	readonly code: CliCode;
	readonly exitCode?: ExitCode;
	/** Overrides the default message (parse errors, unexpected errors). */
	readonly detail?: string;
	/** Ctrl-C/EOF in a prompt: ends the whole command or session. */
	readonly abort?: boolean;
}> {}

export const usage = (code: CliCode) => new CliFailure({ code, exitCode: 2 });
export const cancelled = () =>
	new CliFailure({ code: "CANCELLED", exitCode: 130 });
export const aborted = () =>
	new CliFailure({ code: "CANCELLED", exitCode: 130, abort: true });

export type Failure = BetterAgeError | CliFailure;

const messages: Record<BetterAgeErrorCode | CliCode, string> = {
	ARTIFACT_UNSUPPORTED_VERSION:
		"artifact version is not supported by this Better Age version",
	CANCELLED: "command cancelled",
	CANNOT_FORGET_SELF_IDENTITY: "cannot forget your own identity",
	CANNOT_GRANT_SELF: "you are always a recipient of your payloads",
	CANNOT_IMPORT_SELF_IDENTITY: "cannot import your own identity",
	CANNOT_REVOKE_SELF: "cannot revoke yourself from a payload",
	COMMAND_PARSE: "invalid command",
	EDITOR_EXIT_NON_ZERO: "editor exited with a non-zero status",
	EDITOR_UNAVAILABLE: "editor is unavailable",
	HOME_STATE_INVALID: "local home state is invalid",
	HOME_STATE_NOT_FOUND: "run bage setup first",
	IDENTITY_KEY_UPDATE_REQUIRES_TRUST:
		"identity key update requires explicit trust",
	IDENTITY_REFERENCE_MISSING: "pass an identity reference or run interactively",
	IDENTITY_REFERENCE_NOT_FOUND: "identity reference not found",
	IDENTITY_STRING_INVALID: "identity string is invalid",
	IDENTITY_STRING_MISSING: "pass an identity string or run interactively",
	INTERACTIVE_UNAVAILABLE: "interactive terminal is unavailable",
	KEY_TRANSACTION_INCOMPLETE:
		"local key transaction could not be recovered automatically",
	LOAD_PROTOCOL_REQUIRED: "pass --protocol-version=1",
	LOAD_PROTOCOL_UNSUPPORTED: "supported protocol version is 1",
	LOCAL_ALIAS_DUPLICATE: "alias already exists",
	LOCAL_ALIAS_INVALID: "alias is invalid",
	LOCAL_KEY_MISSING: "local private key file is missing",
	LOCAL_PERMISSION_REPAIR_FAILED:
		"local file permissions could not be repaired",
	PASSPHRASE_CONFIRMATION_MISMATCH: "passphrase confirmation did not match",
	PASSPHRASE_INCORRECT: "invalid passphrase",
	PASSPHRASE_TOO_SHORT: "passphrase must be at least 8 characters",
	PASSPHRASE_UNAVAILABLE: "cannot prompt in headless mode",
	PAYLOAD_ACCESS_DENIED: "none of your local keys can decrypt this payload",
	PAYLOAD_ALREADY_EXISTS: "payload already exists",
	PAYLOAD_INVALID: "payload file is not a valid Better Age payload",
	PAYLOAD_NOT_FOUND: "payload not found",
	PAYLOAD_PATH_MISSING: "pass a payload path or run interactively",
	PAYLOAD_UPDATE_REQUIRED: "run bage update before mutating payload",
	PAYLOAD_WRITE_VERIFICATION_FAILED:
		"encrypted payload failed verification before write",
	PRIVATE_KEY_INVALID: "local private key artifact is invalid",
	RECIPIENT_REFERENCE_NOT_FOUND: "recipient reference not found",
	SETUP_ALREADY_CONFIGURED: "identity is already set up",
	SETUP_NAME_INVALID: "display name must not be blank",
	SETUP_NAME_MISSING: "pass --name or run setup interactively",
	UNEXPECTED: "unexpected error",
	VIEWER_UNAVAILABLE: "secure viewer is unavailable",
};

export const codeOf = (failure: Failure): BetterAgeErrorCode | CliCode =>
	failure._tag === "CliFailure" ? failure.code : failure._tag;

export const exitCodeOf = (failure: Failure): ExitCode =>
	failure._tag === "CliFailure" ? (failure.exitCode ?? 1) : 1;

export const messageOf = (failure: Failure): string =>
	failure._tag === "CliFailure" && failure.detail !== undefined
		? failure.detail
		: messages[codeOf(failure)];
