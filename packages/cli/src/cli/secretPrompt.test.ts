import { describe, expect, it } from "vitest";
import {
	closeSecretPrompt,
	createSecretPromptState,
	reduceSecretPromptInput,
} from "./secretPrompt.js";

describe("secret prompt state", () => {
	it("captures typed input without echoing secret characters", () => {
		const started = createSecretPromptState("Passphrase");
		const typed = reduceSecretPromptInput(started.state, "secret");
		const submitted = reduceSecretPromptInput(typed.state, "\r");

		expect(started.write).toBe("Passphrase: ");
		expect(typed.write).toBe("");
		expect(submitted).toEqual({
			state: { value: "secret", done: true },
			write: "\n",
			result: { kind: "success", value: "secret" },
		});
	});

	it("supports backspace before submit", () => {
		const started = createSecretPromptState("Passphrase");
		const typed = reduceSecretPromptInput(started.state, "secrex");
		const corrected = reduceSecretPromptInput(typed.state, "\u007f");
		const submitted = reduceSecretPromptInput(corrected.state, "\n");

		expect(submitted.result).toEqual({ kind: "success", value: "secre" });
	});

	it("maps ctrl-c and eof to cancel with a newline", () => {
		const started = createSecretPromptState("Passphrase");

		expect(reduceSecretPromptInput(started.state, "\u0003")).toEqual({
			state: { value: "", done: true },
			write: "\n",
			result: { kind: "cancel" },
		});
		expect(closeSecretPrompt(started.state)).toEqual({
			state: { value: "", done: true },
			write: "\n",
			result: { kind: "cancel" },
		});
	});
});
