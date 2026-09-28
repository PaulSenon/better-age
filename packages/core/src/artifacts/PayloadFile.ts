// Payload file = readable Better Age wrapper around untouched age armor, whose
// decrypted content is the JSON payload plaintext below.
import { Option, Result, Schema } from "effect";
import { PublicIdentity } from "./PublicIdentity.js";

const OUTER_BEGIN = "-----BEGIN BETTER AGE PAYLOAD-----";
const OUTER_END = "-----END BETTER AGE PAYLOAD-----";
const AGE_BEGIN = "-----BEGIN AGE ENCRYPTED FILE-----";
const AGE_END = "-----END AGE ENCRYPTED FILE-----";

export const PayloadPlaintext = Schema.Struct({
	kind: Schema.Literal("better-age/payload"),
	version: Schema.Literal(1),
	payloadId: Schema.String,
	createdAt: Schema.String,
	lastRewrittenAt: Schema.String,
	envText: Schema.String,
	recipients: Schema.Array(PublicIdentity),
});

export type PayloadPlaintext = typeof PayloadPlaintext.Type;

export const encodePayloadPlaintext = (plaintext: PayloadPlaintext): string =>
	JSON.stringify(plaintext);

export const decodePayloadPlaintext = (
	text: string,
): Option.Option<PayloadPlaintext> =>
	Result.getSuccess(
		Schema.decodeUnknownResult(Schema.fromJsonString(PayloadPlaintext))(text),
	);

export const formatPayloadFile = (armor: string): string =>
	[
		"# better-age encrypted env payload",
		"# Docs: https://github.com/PaulSenon/better-age",
		"# This file is safe to commit only if your policy allows encrypted secrets.",
		"# Do not edit the armored block manually.",
		"",
		OUTER_BEGIN,
		(armor.endsWith("\n") ? armor : `${armor}\n`) + OUTER_END,
		"",
	].join("\n");

const countOf = (input: string, needle: string) =>
	input.split(needle).length - 1;

/** Extracts the inner age armor; None when the wrapper is missing or ambiguous. */
export const extractPayloadArmor = (
	fileContents: string,
): Option.Option<string> => {
	if (
		countOf(fileContents, OUTER_BEGIN) !== 1 ||
		countOf(fileContents, OUTER_END) !== 1
	) {
		return Option.none();
	}

	const begin = fileContents.indexOf(OUTER_BEGIN);
	const end = fileContents.indexOf(OUTER_END);

	if (begin > end) {
		return Option.none();
	}

	const armor = fileContents
		.slice(begin + OUTER_BEGIN.length, end)
		.replace(/^\r?\n/, "")
		.replace(/\r?\n$/, "");

	return countOf(armor, AGE_BEGIN) === 1 &&
		countOf(armor, AGE_END) === 1 &&
		armor.trimStart().startsWith(AGE_BEGIN) &&
		armor.trimEnd().endsWith(AGE_END)
		? Option.some(armor)
		: Option.none();
};
