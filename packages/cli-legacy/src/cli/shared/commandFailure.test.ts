import { describe, expect, it } from "@effect/vitest";
import { CliCommandFailedError } from "./commandFailure.js";

describe("commandFailure", () => {
	it("captures command and reason metadata", () => {
		const error = new CliCommandFailedError({
			command: "load",
			reason: "user-facing-error",
		});

		expect(error.command).toBe("load");
		expect(error.reason).toBe("user-facing-error");
		expect(error.name).toBe("CliCommandFailedError");
	});
});
