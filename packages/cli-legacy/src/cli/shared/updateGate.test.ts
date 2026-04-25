import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import {
	promptForPayloadUpdateAction,
	renderUpdateRequiredMessage,
	runPayloadUpdateGate,
} from "./updateGate.js";

const makeInteractivePrompt = (answer: string) =>
	InteractivePrompt.make({
		select: <A>(input: {
			readonly choices: ReadonlyArray<{ title: string; value: A }>;
			readonly maxPerPage?: number;
			readonly message: string;
		}) =>
			Effect.sync(() => {
				const choice = input.choices.find((item) => item.title === answer);

				if (!choice) {
					throw new Error(`Missing choice ${answer}`);
				}

				return choice.value;
			}),
	});

describe("updateGate", () => {
	it.effect("returns selected update action", () =>
		Effect.gen(function* () {
			const result = yield* promptForPayloadUpdateAction();

			expect(result).toBe("back");
		}).pipe(
			Effect.provide(
				Layer.succeed(InteractivePrompt, makeInteractivePrompt("Back")),
			),
		),
	);

	it.effect("maps accepted update into updated outcome", () =>
		Effect.gen(function* () {
			let updateCalls = 0;
			const result = yield* runPayloadUpdateGate(
				Effect.sync(() => {
					updateCalls += 1;
				}),
			);

			expect(result).toBe("updated");
			expect(updateCalls).toBe(1);
		}).pipe(
			Effect.provide(
				Layer.succeed(InteractivePrompt, makeInteractivePrompt("Update now")),
			),
		),
	);

	it.effect("returns cancel without running update effect", () =>
		Effect.gen(function* () {
			let updateCalls = 0;
			const result = yield* runPayloadUpdateGate(
				Effect.sync(() => {
					updateCalls += 1;
				}),
			);

			expect(result).toBe("cancel");
			expect(updateCalls).toBe(0);
		}).pipe(
			Effect.provide(
				Layer.succeed(InteractivePrompt, makeInteractivePrompt("Cancel")),
			),
		),
	);

	it("renders remediation text", () => {
		expect(renderUpdateRequiredMessage("grant", "./.env.enc")).toBe(
			[
				"Payload must be updated before grant",
				"Run: bage update ./.env.enc",
				"",
			].join("\n"),
		);
	});
});
