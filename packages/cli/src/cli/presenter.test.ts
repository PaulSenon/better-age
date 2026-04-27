import { describe, expect, it } from "vitest";
import {
	presentFailure,
	presentIdentityList,
	presentIdentityString,
	presentPayloadInspect,
	presentSuccess,
	presentWarning,
	styleHumanStderr,
	styleRunCliResult,
} from "./presenter.js";

describe("presenter styling", () => {
	it("keeps plain output readable without styling", () => {
		expect(styleRunCliResult(presentSuccess("Done"), { color: false })).toEqual(
			{
				exitCode: 0,
				stdout: "",
				stderr: "[OK] Done\n",
			},
		);
		expect(
			styleHumanStderr(`${presentWarning("Careful")}`, { color: false }),
		).toBe("[WARN] Careful\n");
	});

	it("styles human stderr labels without emoji when color is enabled", () => {
		const styled = styleRunCliResult(presentFailure("PAYLOAD_NOT_FOUND"), {
			color: true,
		});

		expect(styled.stdout).toBe("");
		expect(styled.stderr).toContain("\u001B[31m[ERROR]\u001B[0m");
		expect(styled.stderr).toContain("PAYLOAD_NOT_FOUND");
		expect(styled.stderr).not.toMatch(/\p{Extended_Pictographic}/u);
	});

	it("never styles machine stdout", () => {
		expect(
			styleRunCliResult(presentIdentityString("bage-id-v1:abc123"), {
				color: true,
			}),
		).toEqual({
			exitCode: 0,
			stdout: "bage-id-v1:abc123\n",
			stderr: "",
		});
	});

	it("renders unknown failure codes with an explicit unmapped-code fallback", () => {
		expect(presentFailure("NEW_SECURITY_FAILURE")).toEqual({
			exitCode: 1,
			stdout: "",
			stderr:
				"[ERROR] NEW_SECURITY_FAILURE: unmapped failure code NEW_SECURITY_FAILURE\n",
		});
	});

	it("renders untrusted identity names without terminal control characters", () => {
		const maliciousName = "Eve\u001B]52;c;secret\u0007\rAdmin";

		const identityList = presentIdentityList({
			known: [
				{
					ownerId: "owner_eve",
					publicIdentity: { displayName: maliciousName },
					localAlias: "ops",
				},
			],
			retired: [],
			self: {
				ownerId: "owner_self",
				publicIdentity: { displayName: maliciousName },
			},
		});
		const payloadInspect = presentPayloadInspect({
			compatibility: "up-to-date",
			envKeys: [],
			path: ".env.enc",
			payloadId: "payload_123",
			recipients: [
				{
					displayName: maliciousName,
					isSelf: false,
					isStaleSelf: false,
					localAlias: null,
					ownerId: "owner_eve",
				},
			],
			schemaVersion: 1,
		});

		for (const stdout of [identityList.stdout, payloadInspect.stdout]) {
			expect(stdout).not.toContain("\u001B]52");
			expect(stdout).not.toContain("\u0007");
			expect(stdout).not.toContain("\r");
			expect(stdout).toContain("\\x1b]52;c;secret\\x07\\rAdmin");
		}
	});
});
