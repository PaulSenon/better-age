import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { runCli } from "./program.js";

const withTempHomeDirectory = <A>(
	run: (homeDirectory: string) => Effect.Effect<A>,
) =>
	Effect.acquireUseRelease(
		Effect.tryPromise(() => fs.mkdtemp(join(tmpdir(), "better-age-cli-test-"))),
		(homeDirectory) =>
			Effect.sync(() => {
				const previous = process.env.BETTER_AGE_HOME;
				process.env.BETTER_AGE_HOME = homeDirectory;
				return previous;
			}).pipe(
				Effect.flatMap((previousHomeDirectory) =>
					run(homeDirectory).pipe(
						Effect.ensuring(
							Effect.sync(() => {
								if (previousHomeDirectory === undefined) {
									delete process.env.BETTER_AGE_HOME;
									return;
								}

								process.env.BETTER_AGE_HOME = previousHomeDirectory;
							}),
						),
					),
				),
			),
		(homeDirectory) =>
			Effect.promise(() =>
				fs.rm(homeDirectory, { force: true, recursive: true }),
			),
	);

describe("cli surface", () => {
	layer(NodeContext.layer)("contract", (it) => {
		it.effect("renders friendly unknown-subcommand guidance", () =>
			withTempHomeDirectory(() =>
				Effect.gen(function* () {
					const stderr: Array<string> = [];
					const writeSpy = vi
						.spyOn(process.stderr, "write")
						.mockImplementation(((chunk: string | Uint8Array) => {
							stderr.push(
								typeof chunk === "string"
									? chunk
									: Buffer.from(chunk).toString("utf8"),
							);
							return true;
						}) as typeof process.stderr.write);

					try {
						const result = yield* runCli([
							"node",
							"bage",
							"read",
							"./.env.enc",
						]).pipe(Effect.either);

						expect(result._tag).toBe("Right");
						if (result._tag === "Right") {
							expect(result.right).toBe(1);
						}
						expect(stderr.join("")).toContain("Invalid subcommand for bage");
						expect(stderr.join("")).toContain("Run: bage --help");
						expect(stderr.join("")).not.toContain('"_tag":"CommandMismatch"');
					} finally {
						writeSpy.mockRestore();
					}
				}),
			),
		);

		it.effect("returns non-zero for renderer-driven command failures", () =>
			withTempHomeDirectory(() =>
				Effect.gen(function* () {
					const stderr: Array<string> = [];
					const writeSpy = vi
						.spyOn(process.stderr, "write")
						.mockImplementation(((chunk: string | Uint8Array) => {
							stderr.push(
								typeof chunk === "string"
									? chunk
									: Buffer.from(chunk).toString("utf8"),
							);
							return true;
						}) as typeof process.stderr.write);

					try {
						const result = yield* runCli([
							"node",
							"bage",
							"load",
							"./.env.enc",
						]).pipe(Effect.either);

						expect(result._tag).toBe("Right");
						if (result._tag === "Right") {
							expect(result.right).toBe(1);
						}
						expect(stderr.join("")).toContain(
							"Missing required protocol version",
						);
						expect(stderr.join("")).toContain("Run with: --protocol-version=1");
					} finally {
						writeSpy.mockRestore();
					}
				}),
			),
		);

		it.effect(
			"fails before command logic when managed home state is newer than runtime",
			() =>
				withTempHomeDirectory((homeDirectory) =>
					Effect.gen(function* () {
						yield* Effect.promise(() =>
							fs.writeFile(
								join(homeDirectory, "state.json"),
								'{"homeSchemaVersion":3}',
								"utf8",
							),
						);

						const stderr: Array<string> = [];
						const writeSpy = vi
							.spyOn(process.stderr, "write")
							.mockImplementation(((chunk: string | Uint8Array) => {
								stderr.push(
									typeof chunk === "string"
										? chunk
										: Buffer.from(chunk).toString("utf8"),
								);
								return true;
							}) as typeof process.stderr.write);

						try {
							const result = yield* runCli(["node", "bage", "me"]).pipe(
								Effect.either,
							);

							expect(result._tag).toBe("Right");
							if (result._tag === "Right") {
								expect(result.right).toBe(1);
							}
							expect(stderr.join("")).toContain(
								"CLI is too old to open this managed home state",
							);
						} finally {
							writeSpy.mockRestore();
						}
					}),
				),
		);
	});
});
