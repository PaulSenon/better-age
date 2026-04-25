import { describe, expect, it } from "@effect/vitest";
import { Either } from "effect";
import {
	PayloadFileFormatError,
	parsePayloadFile,
	serializePayloadFile,
} from "./PayloadFile.js";

describe("PayloadFile", () => {
	it("round-trips the canonical payload file shape", () => {
		const serialized = serializePayloadFile({
			armoredPayload: "YWJjZGVm\nZ2hpamts",
		});

		expect(serialized).toBe(
			[
				"# better-age encrypted env payload",
				"# This file contains encrypted environment variables.",
				"# Do not edit manually. Use: bage inspect <file>",
				"# To change secrets, use: bage edit <file>",
				"# Docs: https://better-age.dev/docs",
				"",
				"-----BEGIN BETTER-SECRETS PAYLOAD-----",
				"YWJjZGVm",
				"Z2hpamts",
				"-----END BETTER-SECRETS PAYLOAD-----",
			].join("\n"),
		);

		const parsed = parsePayloadFile(serialized);

		expect(Either.isRight(parsed)).toBe(true);
		if (Either.isRight(parsed)) {
			expect(parsed.right).toEqual({
				armoredPayload: "YWJjZGVm\nZ2hpamts",
			});
		}
	});

	it("fails when the begin marker is missing", () => {
		const parsed = parsePayloadFile(
			[
				"# better-age encrypted env payload",
				"# This file contains encrypted environment variables.",
				"# Do not edit manually. Use: bage inspect <file>",
				"# To change secrets, use: bage edit <file>",
				"# Docs: https://better-age.dev/docs",
				"",
				"YWJjZGVm",
				"-----END BETTER-SECRETS PAYLOAD-----",
			].join("\n"),
		);

		expect(Either.isLeft(parsed)).toBe(true);
		if (Either.isLeft(parsed)) {
			expect(parsed.left).toBeInstanceOf(PayloadFileFormatError);
		}
	});

	it("parses payload by outer markers only and ignores preamble text", () => {
		const parsed = parsePayloadFile(
			[
				"# custom docs line",
				"# changed comment text",
				"",
				"-----BEGIN BETTER-SECRETS PAYLOAD-----",
				"-----BEGIN AGE ENCRYPTED FILE-----",
				"YWJjZGVm",
				"-----END AGE ENCRYPTED FILE-----",
				"-----END BETTER-SECRETS PAYLOAD-----",
			].join("\n"),
		);

		expect(Either.isRight(parsed)).toBe(true);
		if (Either.isRight(parsed)) {
			expect(parsed.right).toEqual({
				armoredPayload: [
					"-----BEGIN AGE ENCRYPTED FILE-----",
					"YWJjZGVm",
					"-----END AGE ENCRYPTED FILE-----",
				].join("\n"),
			});
		}
	});
});
