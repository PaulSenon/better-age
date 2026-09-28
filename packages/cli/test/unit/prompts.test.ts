import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<{ readonly name: string; readonly context: unknown }> = [];
let nextResult: () => Promise<unknown> = async () => "value";

vi.mock("@inquirer/prompts", () => {
	const fake = (name: string) => (_config: unknown, context: unknown) => {
		calls.push({ name, context });
		return nextResult();
	};
	return {
		confirm: fake("confirm"),
		input: fake("input"),
		password: fake("password"),
		select: fake("select"),
	};
});

const { nodeUiLayer } = await import("../../src/ui/nodeUi.js");
const { Ui } = await import("../../src/ui/Ui.js");

const withUi = <A, E>(use: (ui: typeof Ui.Service) => Effect.Effect<A, E>) =>
	Effect.runPromiseExit(
		Effect.gen(function* () {
			return yield* use(yield* Ui);
		}).pipe(Effect.provide(nodeUiLayer)),
	);

beforeEach(() => {
	calls.length = 0;
	nextResult = async () => "value";
});

describe("node prompts", () => {
	it("render on stdin/stderr, never stdout, with an abort signal", async () => {
		await withUi((ui) => ui.secret("Passphrase"));

		expect(calls).toEqual([
			{
				name: "password",
				context: expect.objectContaining({
					input: process.stdin,
					output: process.stderr,
					signal: expect.any(AbortSignal),
				}),
			},
		]);
	});

	it("turn inquirer Ctrl-C into an abort CANCELLED failure", async () => {
		nextResult = async () => {
			throw Object.assign(new Error("User force closed"), {
				name: "ExitPromptError",
			});
		};
		const exit = await withUi((ui) => ui.select("Command", []));

		expect(Exit.isFailure(exit)).toBe(true);
		expect(JSON.stringify(exit)).toContain('"abort":true');
	});
});
