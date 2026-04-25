import { describe, expect, it } from "@effect/vitest";
import {
	renderUserFacingError,
	renderUserFacingWarning,
} from "./userFacingMessage.js";

describe("userFacingMessage", () => {
	it("renders setup-required remediation", () => {
		expect(renderUserFacingError({ id: "ERR.SETUP.REQUIRED" })).toBe(
			["No local self identity found", "Run: bage setup", ""].join("\n"),
		);
	});

	it("renders identities inspection failure copy", () => {
		expect(renderUserFacingError({ id: "ERR.IDENTITY.INSPECT_FAILED" })).toBe(
			["Failed to inspect local identities", "Retry", ""].join("\n"),
		);
	});

	it("renders non-fatal warning copy", () => {
		expect(
			renderUserFacingWarning({
				id: "WARN.LOAD.UPDATE_REQUIRED",
				path: "./.env.enc",
			}),
		).toBe(
			[
				"Warning: payload should be updated",
				"Run: bage update ./.env.enc",
				"",
			].join("\n"),
		);
	});
});
