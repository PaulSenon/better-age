import { Either, Schema } from "effect";

export class PayloadFileFormatError extends Schema.TaggedError<PayloadFileFormatError>()(
	"PayloadFileFormatError",
	{
		message: Schema.String,
	},
) {}

export const payloadFilePreambleLines = [
	"# better-age encrypted env payload",
	"# This file contains encrypted environment variables.",
	"# Do not edit manually. Use: bage inspect <file>",
	"# To change secrets, use: bage edit <file>",
	"# Docs: https://better-age.dev/docs",
] as const;

export const payloadFileBeginMarker = "-----BEGIN BETTER-SECRETS PAYLOAD-----";
export const payloadFileEndMarker = "-----END BETTER-SECRETS PAYLOAD-----";

export type PayloadFile = {
	readonly armoredPayload: string;
};

export const serializePayloadFile = (payloadFile: PayloadFile): string =>
	[
		...payloadFilePreambleLines,
		"",
		payloadFileBeginMarker,
		payloadFile.armoredPayload,
		payloadFileEndMarker,
	].join("\n");

export const parsePayloadFile = (
	rawFile: string,
): Either.Either<PayloadFile, PayloadFileFormatError> => {
	const lines = rawFile.split("\n");
	const beginIndex = lines.indexOf(payloadFileBeginMarker);
	const endIndex = lines.lastIndexOf(payloadFileEndMarker);

	if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex + 1) {
		return Either.left(
			new PayloadFileFormatError({
				message: "Payload file did not match the expected outer markers",
			}),
		);
	}

	return Either.right({
		armoredPayload: lines.slice(beginIndex + 1, endIndex).join("\n"),
	});
};
