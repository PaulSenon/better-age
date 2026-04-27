import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { DisplayName } from "../identity/DisplayName.js";
import { KnownIdentity } from "../identity/Identity.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadRecipient } from "./PayloadEnvelope.js";
import {
	decideGrantRecipient,
	decideRevokeRecipient,
} from "./PayloadRecipientMutation.js";

const isaac = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("isaac"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1isaac"),
});

const paulOld = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-14T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulold"),
});

const paulNew = Schema.decodeUnknownSync(KnownIdentity)({
	displayName: Schema.decodeUnknownSync(DisplayName)("paul"),
	identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
		"2026-04-15T10:00:00.000Z",
	),
	ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_aaaaaaaaaaaaaaaa"),
	publicKey: Schema.decodeUnknownSync(PublicKey)("age1paulnew"),
});

const toRecipient = (identity: typeof isaac) =>
	Schema.decodeUnknownSync(PayloadRecipient)({
		displayName: identity.displayName,
		identityUpdatedAt: identity.identityUpdatedAt,
		ownerId: identity.ownerId,
		publicKey: identity.publicKey,
	});

describe("PayloadRecipientMutation", () => {
	it("grant adds recipient when owner is absent", () => {
		const result = decideGrantRecipient({
			currentRecipients: [toRecipient(isaac)],
			targetIdentity: paulNew,
		});

		expect(result._tag).toBe("add");
		if (result._tag === "add") {
			expect(result.nextRecipients).toEqual([
				toRecipient(isaac),
				toRecipient(paulNew),
			]);
		}
	});

	it("grant replaces older snapshot when same owner is present", () => {
		const result = decideGrantRecipient({
			currentRecipients: [toRecipient(isaac), toRecipient(paulOld)],
			targetIdentity: paulNew,
		});

		expect(result._tag).toBe("replace");
		if (result._tag === "replace") {
			expect(result.nextRecipients).toEqual([
				toRecipient(isaac),
				toRecipient(paulNew),
			]);
		}
	});

	it("grant no-ops when identical snapshot is already present", () => {
		const result = decideGrantRecipient({
			currentRecipients: [toRecipient(isaac), toRecipient(paulNew)],
			targetIdentity: paulNew,
		});

		expect(result).toEqual({
			_tag: "unchanged-identical",
			recipient: toRecipient(paulNew),
		});
	});

	it("grant no-ops when provided snapshot is older than payload snapshot", () => {
		const result = decideGrantRecipient({
			currentRecipients: [toRecipient(isaac), toRecipient(paulNew)],
			targetIdentity: paulOld,
		});

		expect(result).toEqual({
			_tag: "unchanged-outdated-input",
			providedRecipient: toRecipient(paulOld),
			recipient: toRecipient(paulNew),
		});
	});

	it("revoke removes matching owner by ownerId", () => {
		const result = decideRevokeRecipient({
			currentRecipients: [toRecipient(isaac), toRecipient(paulNew)],
			selfOwnerId: isaac.ownerId,
			targetOwnerId: paulOld.ownerId,
		});

		expect(result._tag).toBe("remove");
		if (result._tag === "remove") {
			expect(result.nextRecipients).toEqual([toRecipient(isaac)]);
		}
	});

	it("revoke forbids current self", () => {
		const result = decideRevokeRecipient({
			currentRecipients: [toRecipient(isaac), toRecipient(paulNew)],
			selfOwnerId: isaac.ownerId,
			targetOwnerId: isaac.ownerId,
		});

		expect(result).toEqual({
			_tag: "forbidden-self",
		});
	});

	it("revoke no-ops when recipient is absent", () => {
		const result = decideRevokeRecipient({
			currentRecipients: [toRecipient(isaac)],
			selfOwnerId: isaac.ownerId,
			targetOwnerId: paulNew.ownerId,
		});

		expect(result).toEqual({
			_tag: "unchanged-absent",
		});
	});
});
