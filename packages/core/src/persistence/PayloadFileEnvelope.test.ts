import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
	extractPayloadArmor,
	formatPayloadFileEnvelope,
} from "./PayloadFileEnvelope.js";

const armoredPayload = [
	"-----BEGIN AGE ENCRYPTED FILE-----",
	"encrypted bytes",
	"-----END AGE ENCRYPTED FILE-----",
].join("\n");

describe("PayloadFileEnvelope", () => {
	it("formats a readable Better Age wrapper around untouched age armor", () => {
		const fileContents = formatPayloadFileEnvelope(armoredPayload);

		expect(fileContents).toContain("# better-age encrypted env payload");
		expect(fileContents).toContain("-----BEGIN BETTER AGE PAYLOAD-----");
		expect(fileContents).toContain("-----END BETTER AGE PAYLOAD-----");
		expect(fileContents).toContain(armoredPayload);
		expect(Either.getOrThrow(extractPayloadArmor(fileContents))).toBe(
			armoredPayload,
		);
	});

	it("rejects missing, duplicated, malformed, or non-age-armored blocks", () => {
		const validEnvelope = formatPayloadFileEnvelope(armoredPayload);
		const invalidFiles = [
			armoredPayload,
			`${validEnvelope}\n${validEnvelope}`,
			"-----END BETTER AGE PAYLOAD-----\n-----BEGIN BETTER AGE PAYLOAD-----",
			formatPayloadFileEnvelope("encrypted bytes"),
			formatPayloadFileEnvelope(`${armoredPayload}\n${armoredPayload}`),
		];

		for (const fileContents of invalidFiles) {
			expect(Either.isLeft(extractPayloadArmor(fileContents))).toBe(true);
		}
	});
});
