import { Schema } from "effect";

export class EnvDocumentParseError extends Schema.TaggedError<EnvDocumentParseError>()(
	"EnvDocumentParseError",
	{
		line: Schema.Number,
		message: Schema.String,
	},
) {}

export type EnvEntry = {
	readonly key: string;
	readonly value: string;
};

export type EnvDocument = ReadonlyArray<EnvEntry>;

const envKeyPattern = /^[A-Z_][A-Z0-9_]*$/;

export const parseEnvDocument = (envText: string): EnvDocument => {
	const entries: Array<EnvEntry> = [];
	const seen = new Set<string>();

	for (const [index, rawLine] of envText.split("\n").entries()) {
		const line = rawLine.trim();

		if (line === "" || line.startsWith("#")) {
			continue;
		}

		const separatorIndex = rawLine.indexOf("=");

		if (separatorIndex <= 0) {
			throw new EnvDocumentParseError({
				line: index + 1,
				message: "Env line must use KEY=value syntax",
			});
		}

		const key = rawLine.slice(0, separatorIndex).trim();

		if (!envKeyPattern.test(key)) {
			throw new EnvDocumentParseError({
				line: index + 1,
				message: "Env key is invalid",
			});
		}

		if (seen.has(key)) {
			throw new EnvDocumentParseError({
				line: index + 1,
				message: "Env key is duplicated",
			});
		}

		seen.add(key);
		entries.push({
			key,
			value: rawLine.slice(separatorIndex + 1),
		});
	}

	return entries;
};

export const serializeEnvDocument = (document: EnvDocument): string =>
	document
		.map(({ key, value }) => `${key}=${value}`)
		.join("\n")
		.concat("\n");
