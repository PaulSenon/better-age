import { Schema } from "effect";
import { EnvDocumentParseError, parseEnvDocument } from "./EnvDocument.js";

export class EnvTextParseError extends Schema.TaggedError<EnvTextParseError>()(
	"EnvTextParseError",
	{
		line: Schema.Number,
		message: Schema.String,
	},
) {}

export const getEnvKeyNames = (envText: string): ReadonlyArray<string> => {
	try {
		return parseEnvDocument(envText).map((entry) => entry.key);
	} catch (error) {
		if (error instanceof EnvDocumentParseError) {
			throw new EnvTextParseError({
				line: error.line,
				message: error.message,
			});
		}

		throw error;
	}
};
