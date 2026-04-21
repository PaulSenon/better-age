import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { DisplayName } from "../identity/DisplayName.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadEnvelope, PayloadRecipient } from "./PayloadEnvelope.js";
import { PayloadId } from "./PayloadId.js";

describe("PayloadEnvelope", () => {
	it("decodes the canonical current payload envelope shape", () => {
		const envelope = Schema.decodeUnknownSync(PayloadEnvelope)({
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "API_KEY=secret\n",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_0123456789abcdef",
			recipients: [
				Schema.decodeUnknownSync(PayloadRecipient)({
					displayName: "isaac-mbp",
					identityUpdatedAt: "2026-04-14T10:00:00.000Z",
					ownerId: "bsid1_069f7576d2ab43ef",
					publicKey: "age1testrecipient",
				}),
			],
			version: 2,
		});

		expect(envelope.payloadId).toBe(
			Schema.decodeUnknownSync(PayloadId)("bspld_0123456789abcdef"),
		);
		expect(envelope.recipients).toEqual([
			{
				displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
				identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
					"2026-04-14T10:00:00.000Z",
				),
				ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
				publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
			},
		]);
	});
});
