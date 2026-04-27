import { Either } from "effect";

const OUTER_BEGIN = "-----BEGIN BETTER AGE PAYLOAD-----";
const OUTER_END = "-----END BETTER AGE PAYLOAD-----";
const AGE_BEGIN = "-----BEGIN AGE ENCRYPTED FILE-----";
const AGE_END = "-----END AGE ENCRYPTED FILE-----";

export type PayloadFileEnvelopeParseError = {
	readonly code: "PAYLOAD_FILE_ENVELOPE_INVALID";
};

const countOccurrences = (input: string, needle: string): number => {
	let count = 0;
	let index = input.indexOf(needle);

	while (index !== -1) {
		count += 1;
		index = input.indexOf(needle, index + needle.length);
	}

	return count;
};

const stripEnvelopePadding = (input: string): string => {
	const withoutLeadingNewline = input.replace(/^\r?\n/, "");

	return withoutLeadingNewline.replace(/\r?\n$/, "");
};

const invalid = Either.left({
	code: "PAYLOAD_FILE_ENVELOPE_INVALID",
} satisfies PayloadFileEnvelopeParseError);

export const formatPayloadFileEnvelope = (armoredPayload: string): string => {
	const payloadBlock = armoredPayload.endsWith("\n")
		? armoredPayload
		: `${armoredPayload}\n`;

	return [
		"# better-age encrypted env payload",
		"# Docs: https://github.com/PaulSenon/better-age",
		"# This file is safe to commit only if your policy allows encrypted secrets.",
		"# Do not edit the armored block manually.",
		"",
		OUTER_BEGIN,
		payloadBlock + OUTER_END,
		"",
	].join("\n");
};

export const extractPayloadArmor = (
	fileContents: string,
): Either.Either<string, PayloadFileEnvelopeParseError> => {
	if (
		countOccurrences(fileContents, OUTER_BEGIN) !== 1 ||
		countOccurrences(fileContents, OUTER_END) !== 1
	) {
		return invalid;
	}

	const beginIndex = fileContents.indexOf(OUTER_BEGIN);
	const endIndex = fileContents.indexOf(OUTER_END);

	if (beginIndex === -1 || endIndex === -1 || beginIndex > endIndex) {
		return invalid;
	}

	const rawBlock = fileContents.slice(
		beginIndex + OUTER_BEGIN.length,
		endIndex,
	);
	const armoredPayload = stripEnvelopePadding(rawBlock);

	if (
		countOccurrences(armoredPayload, AGE_BEGIN) !== 1 ||
		countOccurrences(armoredPayload, AGE_END) !== 1 ||
		!armoredPayload.trimStart().startsWith(AGE_BEGIN) ||
		!armoredPayload.trimEnd().endsWith(AGE_END)
	) {
		return invalid;
	}

	return Either.right(armoredPayload);
};
