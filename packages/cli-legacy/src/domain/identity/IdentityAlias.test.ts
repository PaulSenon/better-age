import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { decodeIdentityAlias, IdentityAlias } from "./IdentityAlias.js";

describe("IdentityAlias", () => {
	it("accepts valid aliases", () =>
		Effect.gen(function* () {
			const alias = yield* decodeIdentityAlias("isaac-mbp");

			expect(alias).toBe("isaac-mbp");
			expect(Schema.is(IdentityAlias)("isaac-mbp")).toBe(true);
		}));

	it("rejects invalid aliases", () =>
		Effect.gen(function* () {
			const result = yield* decodeIdentityAlias("bad alias!").pipe(
				Effect.either,
			);

			expect(result._tag).toBe("Left");
		}));
});
