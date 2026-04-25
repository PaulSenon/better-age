import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ExportIdentityString } from "../../app/export-identity-string/ExportIdentityString.js";
import { ExportIdentityStringNotSetUpError } from "../../app/export-identity-string/ExportIdentityStringError.js";
import { Prompt } from "../../port/Prompt.js";
import { MeCommandFailedError, meCommand } from "./meCommand.js";

describe("meCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ExportIdentityString,
				ExportIdentityString.make({
					execute: Effect.succeed("better-age://identity/v1/dGVzdA" as never),
				}),
			),
			Layer.sync(Prompt, () => {
				const stdout: Array<string> = [];
				const stderr: Array<string> = [];

				return Object.assign(
					Prompt.make({
						inputSecret: () => Effect.die("unused"),
						inputSecretPairFromStdin: Effect.die("unused"),
						inputText: () => Effect.die("unused"),
						writeStderr: (text) =>
							Effect.sync(() => {
								stderr.push(text);
							}),
						writeStdout: (text) =>
							Effect.sync(() => {
								stdout.push(text);
							}),
					}),
					{
						stderr,
						stdout,
					},
				);
			}),
		),
	)("success", (it) => {
		it.effect("prints only the identity string to stdout", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(Command.withSubcommands([meCommand])),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "me"]);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual(["better-age://identity/v1/dGVzdA\n"]);
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ExportIdentityString,
				ExportIdentityString.make({
					execute: Effect.fail(
						new ExportIdentityStringNotSetUpError({
							message: "No local identity is configured",
						}),
					),
				}),
			),
			Layer.sync(Prompt, () => {
				const stdout: Array<string> = [];
				const stderr: Array<string> = [];

				return Object.assign(
					Prompt.make({
						inputSecret: () => Effect.die("unused"),
						inputSecretPairFromStdin: Effect.die("unused"),
						inputText: () => Effect.die("unused"),
						writeStderr: (text) =>
							Effect.sync(() => {
								stderr.push(text);
							}),
						writeStdout: (text) =>
							Effect.sync(() => {
								stdout.push(text);
							}),
					}),
					{
						stderr,
						stdout,
					},
				);
			}),
		),
	)("failure", (it) => {
		it.effect(
			"prints remediation-oriented stderr and fails when no identity exists",
			() =>
				Effect.gen(function* () {
					const prompt = yield* Prompt;
					const cli = Command.run(
						Command.make("bage").pipe(Command.withSubcommands([meCommand])),
						{
							name: "bage",
							version: "0.0.1",
						},
					);

					const result = yield* cli(["node", "bage", "me"]).pipe(Effect.either);

					expect(result._tag).toBe("Left");
					if (result._tag === "Left") {
						expect(result.left).toBeInstanceOf(MeCommandFailedError);
					}
					expect(
						(prompt as typeof prompt & { stdout: Array<string> }).stdout,
					).toEqual([]);
					expect(
						(prompt as typeof prompt & { stderr: Array<string> }).stderr,
					).toEqual([
						["No local self identity found", "Run: bage setup", ""].join("\n"),
					]);
				}),
		);
	});
});
