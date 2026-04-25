import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import {
	payloadMutationBack,
	payloadMutationCancel,
	payloadMutationDone,
	runResolvedPayloadMutationFlow,
} from "./payloadMutationFlow.js";

describe("payloadMutationFlow", () => {
	it.effect(
		"re-runs current resolved path without re-resolving on current-path back",
		() =>
			(() => {
				const resolvedPaths = ["./first.env.enc"];
				const resolverCalls: Array<Option.Option<string>> = [];
				const runAtPathCalls: Array<string> = [];
				let callIndex = 0;

				return Effect.gen(function* () {
					const result = yield* runResolvedPayloadMutationFlow({
						path: Option.none(),
						runAtPath: (resolvedPath) =>
							Effect.sync(() => {
								runAtPathCalls.push(resolvedPath);
								callIndex += 1;

								return callIndex === 1
									? payloadMutationBack("current-path")
									: payloadMutationDone("done");
							}),
					});

					expect(result).toBe("done");
					expect(resolverCalls).toEqual([Option.none()]);
					expect(runAtPathCalls).toEqual([
						"./first.env.enc",
						"./first.env.enc",
					]);
				}).pipe(
					Effect.provide(
						Layer.succeed(
							ResolvePayloadTarget,
							ResolvePayloadTarget.make({
								resolveExistingPath: (path) =>
									Effect.sync(() => {
										resolverCalls.push(path);

										const resolvedPath = resolvedPaths[0];

										if (resolvedPath === undefined) {
											throw new Error("Missing resolved path");
										}

										return resolvedPath;
									}),
							}),
						),
					),
				);
			})(),
	);

	it.effect("re-resolves path on path back", () =>
		(() => {
			const resolvedPaths = ["./first.env.enc", "./second.env.enc"];
			const resolverCalls: Array<Option.Option<string>> = [];
			const runAtPathCalls: Array<string> = [];
			let resolverIndex = 0;
			let callIndex = 0;

			return Effect.gen(function* () {
				const result = yield* runResolvedPayloadMutationFlow({
					path: Option.none(),
					runAtPath: (resolvedPath) =>
						Effect.sync(() => {
							runAtPathCalls.push(resolvedPath);
							callIndex += 1;

							return callIndex === 1
								? payloadMutationBack("path")
								: payloadMutationDone("done");
						}),
				});

				expect(result).toBe("done");
				expect(resolverCalls).toEqual([Option.none(), Option.none()]);
				expect(runAtPathCalls).toEqual(["./first.env.enc", "./second.env.enc"]);
			}).pipe(
				Effect.provide(
					Layer.succeed(
						ResolvePayloadTarget,
						ResolvePayloadTarget.make({
							resolveExistingPath: (path) =>
								Effect.sync(() => {
									resolverCalls.push(path);

									const resolvedPath = resolvedPaths[resolverIndex];

									if (resolvedPath === undefined) {
										throw new Error("Missing resolved path");
									}

									resolverIndex += 1;
									return resolvedPath;
								}),
						}),
					),
				),
			);
		})(),
	);

	it.effect("fails with GuidedFlowCancelledError on cancel outcome", () =>
		Effect.gen(function* () {
			const result = yield* runResolvedPayloadMutationFlow({
				path: Option.none(),
				runAtPath: () => Effect.succeed(payloadMutationCancel()),
			}).pipe(Effect.either);

			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left).toBeInstanceOf(GuidedFlowCancelledError);
			}
		}).pipe(
			Effect.provide(
				Layer.succeed(
					ResolvePayloadTarget,
					ResolvePayloadTarget.make({
						resolveExistingPath: () => Effect.succeed("./first.env.enc"),
					}),
				),
			),
		),
	);
});
