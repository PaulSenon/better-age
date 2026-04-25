import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import { CreateUserIdentitySuccess } from "../../app/create-user-identity/CreateUserIdentityError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { runSetupGate } from "./setupFlow.js";

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

const makePrompt = () => {
	const stdout: Array<string> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: ({ message }) =>
				Effect.succeed(message.startsWith("Confirm") ? "pw" : "pw"),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: () => Effect.succeed("isaac"),
			writeStderr: () => Effect.void,
			writeStdout: (text) =>
				Effect.sync(() => {
					stdout.push(text);
				}),
		}),
		{ stdout },
	);
};

describe("setupFlow", () => {
	it.effect("returns cancel when setup gate selects back", () =>
		Effect.gen(function* () {
			const result = yield* runSetupGate().pipe(Effect.either);

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left).toBeInstanceOf(GuidedFlowCancelledError);
			}
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(InteractivePrompt, makeInteractivePrompt("Back")),
					Layer.succeed(Prompt, makePrompt()),
					Layer.succeed(
						CreateUserIdentity,
						CreateUserIdentity.make({
							execute: () => Effect.die("unused"),
						}),
					),
					Layer.succeed(
						HomeRepository,
						HomeRepository.make({
							deletePrivateKey: () => Effect.die("unused"),
							getActiveKey: Effect.die("unused"),
							getLocation: Effect.succeed({
								keysDirectory: "/tmp/keys",
								rootDirectory: "/tmp/home",
								stateFile: "/tmp/home/state.json",
							}),
							loadState: Effect.die("unused"),
							readPrivateKey: () => Effect.die("unused"),
							saveState: () => Effect.die("unused"),
							writePrivateKey: () => Effect.die("unused"),
							writePrivateKeyAtPath: () => Effect.die("unused"),
						}),
					),
				),
			),
		),
	);

	it.effect("runs setup-now flow and prints created summary", () =>
		(() => {
			const prompt = makePrompt();

			return Effect.gen(function* () {
				yield* runSetupGate();

				expect(prompt.stdout).toEqual([
					[
						"Created user key bs1_0123456789abcdef (isaac)",
						"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k",
						"Home: /tmp/home",
						"",
					].join("\n"),
				]);
			}).pipe(
				Effect.provide(
					Layer.mergeAll(
						Layer.succeed(
							InteractivePrompt,
							makeInteractivePrompt("Setup now"),
						),
						Layer.succeed(Prompt, prompt),
						Layer.succeed(
							CreateUserIdentity,
							CreateUserIdentity.make({
								execute: ({ displayName }) =>
									Effect.succeed(
										new CreateUserIdentitySuccess({
											displayName: displayName as never,
											fingerprint: "bs1_0123456789abcdef" as never,
											handle: "isaac#01234567" as never,
											ownerId: "bsid1_0123456789abcdef" as never,
											privateKeyPath: "keys/active.key.age" as never,
											publicKey:
												"age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqe5d0k" as never,
										}),
									),
							}),
						),
						Layer.succeed(
							HomeRepository,
							HomeRepository.make({
								deletePrivateKey: () => Effect.die("unused"),
								getActiveKey: Effect.die("unused"),
								getLocation: Effect.succeed({
									keysDirectory: "/tmp/keys",
									rootDirectory: "/tmp/home",
									stateFile: "/tmp/home/state.json",
								}),
								loadState: Effect.die("unused"),
								readPrivateKey: () => Effect.die("unused"),
								saveState: () => Effect.die("unused"),
								writePrivateKey: () => Effect.die("unused"),
								writePrivateKeyAtPath: () => Effect.die("unused"),
							}),
						),
					),
				),
			);
		})(),
	);
});
