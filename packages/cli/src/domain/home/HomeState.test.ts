import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { emptyHomeState, getSelfIdentity, HomeState } from "./HomeState.js";

describe("HomeState", () => {
	it("starts with no self identity, no known identities, and no retired keys", () => {
		const state = Schema.decodeUnknownSync(HomeState)({
			activeKeyFingerprint: null,
			defaultEditorCommand: null,
			homeSchemaVersion: 1,
			knownIdentities: [],
			retiredKeys: [],
			rotationTtl: "3m",
			self: null,
		});

		expect(Option.isNone(getSelfIdentity(state))).toBe(true);
		expect(state.knownIdentities).toEqual([]);
		expect(state.retiredKeys).toEqual([]);
	});

	it("builds an empty v0 home state with default rotation ttl", () => {
		const state = emptyHomeState();

		expect(state.homeSchemaVersion).toBe(1);
		expect(state.rotationTtl).toBe("3m");
		expect(Option.isNone(getSelfIdentity(state))).toBe(true);
		expect(Option.isNone(state.defaultEditorCommand)).toBe(true);
		expect(state.knownIdentities).toEqual([]);
		expect(state.retiredKeys).toEqual([]);
	});
});
