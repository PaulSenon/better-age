import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
	createNodePromptAdapter,
	type NodePromptFunctions,
} from "./nodePromptAdapter.js";
import { CliPromptCancelledError } from "./secretPrompt.js";

const makeStreams = () => ({
	stderr: new Writable({
		write: (_chunk, _encoding, next) => {
			next();
		},
	}),
	stdin: new PassThrough(),
});

const makeCancelError = () => {
	const error = new Error("User force closed the prompt");
	error.name = "ExitPromptError";
	return error;
};

describe("node prompt adapter", () => {
	it("routes Inquirer prompt context through stdin and stderr", async () => {
		const streams = makeStreams();
		const promptFns: NodePromptFunctions = {
			confirm: vi.fn(async () => true),
			input: vi.fn(async () => "typed"),
			password: vi.fn(async () => "secret"),
			select: vi.fn(async () => "beta"),
		};
		const adapter = createNodePromptAdapter({ ...streams, promptFns });

		await expect(adapter.promptText("Name")).resolves.toBe("typed");
		await expect(adapter.promptSecret("Passphrase")).resolves.toBe("secret");
		await expect(
			adapter.selectOne("Pick", [
				{ value: "alpha", label: "Alpha", disabled: false },
				{ value: "beta", label: "Beta", disabled: false },
			]),
		).resolves.toBe("beta");

		const expectedContext = {
			clearPromptOnDone: false,
			input: streams.stdin,
			output: streams.stderr,
		};
		expect(promptFns.input).toHaveBeenCalledWith(
			{ message: "Name" },
			expectedContext,
		);
		expect(promptFns.password).toHaveBeenCalledWith(
			{ mask: false, message: "Passphrase" },
			expectedContext,
		);
		expect(promptFns.select).toHaveBeenCalledWith(
			{
				choices: [
					{ value: "alpha", name: "Alpha" },
					{ value: "beta", name: "Beta" },
				],
				default: "alpha",
				message: "Pick",
			},
			expectedContext,
		);
	});

	it("normalizes Inquirer prompt cancellation", async () => {
		const streams = makeStreams();
		const promptFns: NodePromptFunctions = {
			confirm: vi.fn(async () => true),
			input: vi.fn(async () => {
				throw makeCancelError();
			}),
			password: vi.fn(async () => "secret"),
			select: vi.fn(async () => "alpha"),
		};
		const adapter = createNodePromptAdapter({ ...streams, promptFns });

		await expect(adapter.promptText("Name")).rejects.toBeInstanceOf(
			CliPromptCancelledError,
		);
	});
});
