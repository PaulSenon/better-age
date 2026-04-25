import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { Handle, toHandle } from "./Handle.js";
import { OwnerId } from "./OwnerId.js";

describe("Handle", () => {
	it("derives a handle from display name and owner id prefix", () => {
		const displayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
		const ownerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");

		const handle = toHandle({
			displayName,
			ownerId,
		});

		expect(handle).toBe(Schema.decodeUnknownSync(Handle)("isaac-mbp#069f7576"));
	});
});
