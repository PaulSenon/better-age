import { describe, expect, it } from "vitest";
import {
	presentFailure,
	presentIdentityString,
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
});
