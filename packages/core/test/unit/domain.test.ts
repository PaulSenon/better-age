import { Result } from "effect";
import { describe, expect, it } from "vitest";
import type { HomeState } from "../../src/artifacts/HomeState.js";
import {
	fingerprintOf,
	forgetKnownIdentity,
	importKnownIdentity,
	newHomeState,
	rotateHome,
	validateDisplayName,
} from "../../src/domain/Identity.js";
import {
	envKeysOf,
	grantRecipient,
	isOutdated,
	newPayload,
	refreshSelf,
	revokeRecipient,
	toPayloadRecipient,
} from "../../src/domain/Payload.js";

const key = (ownerId: string, publicKey: string, createdAt = "t0") => ({
	ownerId,
	publicKey,
	privateKey: `secret-${publicKey}`,
	fingerprint: fingerprintOf(publicKey),
	createdAt,
});

const home: HomeState = newHomeState({
	displayName: "Alice",
	key: key("owner_alice", "age1alice"),
});

const sarah = {
	ownerId: "owner_sarah",
	displayName: "Sarah",
	publicKey: "age1sarah",
	identityUpdatedAt: "t1",
};

const failureTag = (
	result: Result.Result<unknown, { readonly _tag: string }>,
) => (Result.isFailure(result) ? result.failure._tag : "success");

const imported = (
	base: HomeState,
	incoming: typeof sarah,
	options: Parameters<typeof importKnownIdentity>[2] = {},
) => {
	const result = importKnownIdentity(base, incoming, options);
	if (Result.isFailure(result)) throw new Error(result.failure._tag);
	return result.success;
};

describe("identity rules", () => {
	it("derives short fingerprints and requires a non-blank display name", () => {
		expect(fingerprintOf("age1alice")).toMatch(/^fp_[0-9a-f]{16}$/);
		expect(failureTag(validateDisplayName("   "))).toBe("SETUP_NAME_INVALID");
		expect(validateDisplayName("Alice")).toEqual(Result.succeed("Alice"));
	});

	it("classifies imports as added, unchanged, alias-updated, or updated", () => {
		const added = imported(home, sarah, { localAlias: "sarah" });
		expect(added.outcome).toBe("added");
		expect(added.identity).toMatchObject({
			localAlias: "sarah",
			handle: `sarah#${fingerprintOf("age1sarah")}`,
		});

		expect(imported(added.home, sarah).outcome).toBe("unchanged");
		expect(imported(added.home, sarah).identity.localAlias).toBe("sarah");
		expect(imported(added.home, sarah, { localAlias: "s2" }).outcome).toBe(
			"alias-updated",
		);
		expect(
			imported(added.home, { ...sarah, displayName: "Sarah B" }).outcome,
		).toBe("updated");
	});

	it("requires explicit trust before accepting a new key for a known owner", () => {
		const known = imported(home, sarah).home;
		const rekeyed = { ...sarah, publicKey: "age1sarah-new" };

		expect(importKnownIdentity(known, rekeyed, {})).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "IDENTITY_KEY_UPDATE_REQUIRES_TRUST",
					oldFingerprint: fingerprintOf("age1sarah"),
					newFingerprint: fingerprintOf("age1sarah-new"),
				}),
			),
		);
		expect(imported(known, rekeyed, { trustKeyUpdate: true }).outcome).toBe(
			"updated",
		);
	});

	it("rejects self import, invalid aliases, and duplicate aliases", () => {
		const withSarah = imported(home, sarah, { localAlias: "friend" }).home;

		expect(
			failureTag(
				importKnownIdentity(home, { ...sarah, ownerId: home.ownerId }, {}),
			),
		).toBe("CANNOT_IMPORT_SELF_IDENTITY");
		expect(
			failureTag(importKnownIdentity(home, sarah, { localAlias: "1bad" })),
		).toBe("LOCAL_ALIAS_INVALID");
		expect(
			failureTag(
				importKnownIdentity(
					withSarah,
					{ ...sarah, ownerId: "owner_bob" },
					{ localAlias: "friend" },
				),
			),
		).toBe("LOCAL_ALIAS_DUPLICATE");
	});

	it("forgets known identities but never self", () => {
		const withSarah = imported(home, sarah).home;

		expect(forgetKnownIdentity(withSarah, sarah.ownerId)).toEqual(
			Result.succeed(home),
		);
		expect(failureTag(forgetKnownIdentity(home, home.ownerId))).toBe(
			"CANNOT_FORGET_SELF_IDENTITY",
		);
		expect(failureTag(forgetKnownIdentity(home, "owner_nobody"))).toBe(
			"IDENTITY_REFERENCE_NOT_FOUND",
		);
	});

	it("rotates keys under the same owner and retires the previous key", () => {
		const rotated = rotateHome(home, key("owner_alice", "age1alice2", "t9"));

		expect(rotated.ownerId).toBe(home.ownerId);
		expect(rotated.identityUpdatedAt).toBe("t9");
		expect(rotated.currentKey.publicKey).toBe("age1alice2");
		expect(rotated.retiredKeys).toEqual([
			{ ...home.currentKey, retiredAt: "t9" },
		]);
	});
});

describe("payload rules", () => {
	const self = {
		ownerId: home.ownerId,
		displayName: home.displayName,
		publicKey: home.currentKey.publicKey,
		identityUpdatedAt: home.identityUpdatedAt,
	};
	const payload = newPayload({ payloadId: "payload_1", now: "t0", self });

	it("grants idempotently and updates changed recipients", () => {
		const added = grantRecipient(payload, sarah);
		expect(added.outcome).toBe("added");

		const withSarah = { ...payload, recipients: added.recipients };
		expect(grantRecipient(withSarah, sarah).outcome).toBe("unchanged");
		expect(
			grantRecipient(withSarah, { ...sarah, publicKey: "age1new" }),
		).toMatchObject({
			outcome: "updated",
			recipients: [self, { ...sarah, publicKey: "age1new" }],
		});
	});

	it("revokes idempotently", () => {
		const withSarah = {
			...payload,
			recipients: grantRecipient(payload, sarah).recipients,
		};

		expect(revokeRecipient(withSarah, sarah.ownerId)).toEqual({
			recipients: [self],
			outcome: "removed",
		});
		expect(revokeRecipient(payload, sarah.ownerId).outcome).toBe("unchanged");
	});

	it("marks payloads outdated after rotation and refreshes self first", () => {
		const rotated = rotateHome(home, key("owner_alice", "age1alice2", "t9"));
		const shared = { ...payload, recipients: [sarah, self] };

		expect(isOutdated(home, shared)).toBe(false);
		expect(isOutdated(rotated, shared)).toBe(true);
		expect(toPayloadRecipient(rotated, self)).toMatchObject({
			isSelf: true,
			isStaleSelf: true,
		});
		expect(refreshSelf(rotated, shared)).toEqual([
			{
				ownerId: "owner_alice",
				displayName: "Alice",
				publicKey: "age1alice2",
				identityUpdatedAt: "t9",
			},
			sarah,
		]);
	});

	it("lists env keys as a display hint without rejecting other text", () => {
		expect(envKeysOf("A=1\n# note\n\n  B = 2\nfree text\n=x")).toEqual([
			"A",
			"B ",
			"free text",
		]);
	});
});
