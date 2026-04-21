import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { runCli } from "./program.js";

describe("cli surface", () => {
	layer(NodeContext.layer)("contract", (it) => {
		it.effect("renders friendly unknown-subcommand guidance", () =>
			Effect.gen(function* () {
				const stderr: Array<string> = [];
				const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(((
					chunk: string | Uint8Array,
				) => {
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
		);

		it.effect("returns non-zero for renderer-driven command failures", () =>
			Effect.gen(function* () {
				const stderr: Array<string> = [];
				const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(((
					chunk: string | Uint8Array,
				) => {
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
		);
	});
});
