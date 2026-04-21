import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import {
	ViewPayload,
	ViewPayloadFailedError,
} from "../../app/view-payload/ViewPayload.js";
import {
	ViewPayloadCommandFailedError,
	viewPayloadCommand,
} from "./viewPayloadCommand.js";

const makeViewPayload = () => {
	const calls: Array<{ path: Option.Option<string> }> = [];

	return Object.assign(
		ViewPayload.make({
			execute: (input) =>
				Effect.sync(() => {
					calls.push(input);
				}),
		}),
		{ calls },
	);
};

describe("viewPayloadCommand", () => {
	layer(
		Layer.mergeAll(NodeContext.layer, Layer.sync(ViewPayload, makeViewPayload)),
	)("success", (it) => {
		it.effect("delegates optional path to the direct view flow", () =>
			Effect.gen(function* () {
				const viewPayload = yield* ViewPayload;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([viewPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				yield* cli(["node", "bage", "view"]);
				yield* cli(["node", "bage", "view", "./.env.enc"]);

				expect(
					(
						viewPayload as typeof viewPayload & {
							calls: Array<{ path: Option.Option<string> }>;
						}
					).calls,
				).toEqual([
					{ path: Option.none() },
					{ path: Option.some("./.env.enc") },
				]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				ViewPayload,
				ViewPayload.make({
					execute: () => Effect.fail(new ViewPayloadFailedError()),
				}),
			),
		),
	)("failure", (it) => {
		it.effect("maps app failure to command failure", () =>
			Effect.gen(function* () {
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([viewPayloadCommand]),
					),
					{ name: "bage", version: "0.0.1" },
				);

				const result = yield* cli(["node", "bage", "view"]).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ViewPayloadCommandFailedError);
				}
			}),
		);
	});
});
