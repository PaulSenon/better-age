import { describe, expect, it } from "vitest";
import {
	EnvDocumentParseError,
	parseEnvDocument,
	serializeEnvDocument,
} from "./EnvDocument.js";

describe("EnvDocument", () => {
	it("parses ordered key value entries while ignoring blank lines and comments", () => {
		const result = parseEnvDocument(
			"# comment\nAPI_TOKEN=secret\nEMPTY=\n\nDEBUG=true\n",
		);

		expect(result).toEqual([
			{ key: "API_TOKEN", value: "secret" },
			{ key: "EMPTY", value: "" },
			{ key: "DEBUG", value: "true" },
		]);
	});

	it("serializes the canonical normalized env text", () => {
		expect(
			serializeEnvDocument([
				{ key: "API_TOKEN", value: "secret" },
				{ key: "EMPTY", value: "" },
				{ key: "DEBUG", value: "true" },
			]),
		).toBe("API_TOKEN=secret\nEMPTY=\nDEBUG=true\n");
	});

	it("fails on duplicate keys", () => {
		expect(() => parseEnvDocument("API_TOKEN=one\nAPI_TOKEN=two\n")).toThrow(
			EnvDocumentParseError,
		);
	});
});
