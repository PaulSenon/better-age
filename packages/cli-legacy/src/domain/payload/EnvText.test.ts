import { describe, expect, it } from "vitest";
import { EnvTextParseError, getEnvKeyNames } from "./EnvText.js";

describe("EnvText", () => {
	it("extracts key names in order without values", () => {
		const result = getEnvKeyNames(
			"# comment\nAPI_TOKEN=secret\nEMPTY=\n\nDEBUG=true\n",
		);

		expect(result).toEqual(["API_TOKEN", "EMPTY", "DEBUG"]);
	});

	it("fails on duplicate keys", () => {
		expect(() => getEnvKeyNames("API_TOKEN=one\nAPI_TOKEN=two\n")).toThrow(
			EnvTextParseError,
		);
	});
});
