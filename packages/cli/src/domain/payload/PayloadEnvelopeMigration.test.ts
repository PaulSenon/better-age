import { describe, expect, it } from "vitest";
import {
	CURRENT_PAYLOAD_SCHEMA_VERSION,
	normalizePayloadEnvelopeToCurrent,
} from "./PayloadEnvelopeMigration.js";

const currentRecipient = {
	displayName: "paul",
	identityUpdatedAt: "2026-04-14T11:00:00.000Z",
	ownerId: "bsid1_aaaaaaaaaaaaaaaa",
	publicKey: "age1paul",
};

describe("PayloadEnvelopeMigration", () => {
	it("keeps every released payload version migratable by default", () => {
		const currentResult = normalizePayloadEnvelopeToCurrent({
			envelope: {
				createdAt: "2026-04-14T10:00:00.000Z",
				envText: "API_TOKEN=secret\n",
				lastRewrittenAt: "2026-04-14T10:00:00.000Z",
				payloadId: "bspld_2222222222222222",
				recipients: [currentRecipient],
				version: 2,
			} as unknown as Parameters<
				typeof normalizePayloadEnvelopeToCurrent
			>[0]["envelope"],
		});
		const legacyV1Result = normalizePayloadEnvelopeToCurrent({
			envelope: {
				createdAt: "2026-04-14T10:00:00.000Z",
				envText: "API_TOKEN=secret\n",
				lastRewrittenAt: "2026-04-14T10:00:00.000Z",
				payloadId: "bspld_1111111111111111",
				recipients: [currentRecipient],
				version: 1,
			} as unknown as Parameters<
				typeof normalizePayloadEnvelopeToCurrent
			>[0]["envelope"],
		});
		const legacyV0Result = normalizePayloadEnvelopeToCurrent({
			envelope: {
				createdAt: "2026-04-14T10:00:00.000Z",
				envText: "API_TOKEN=secret\n",
				lastRewrittenAt: "2026-04-14T10:00:00.000Z",
				payloadId: "bspld_0000000000000000",
				recipients: [
					{
						...currentRecipient,
						fingerprint: "bs1_aaaaaaaaaaaaaaaa",
						handle: "paul#aaaaaaaa",
					},
				],
				version: 0,
			} as unknown as Parameters<
				typeof normalizePayloadEnvelopeToCurrent
			>[0]["envelope"],
		});

		expect(currentResult._tag).toBe("current");
		expect(legacyV1Result).toMatchObject({
			_tag: "migrated",
			appliedSteps: [{ fromVersion: 1, toVersion: 2 }],
			toVersion: CURRENT_PAYLOAD_SCHEMA_VERSION,
		});
		expect(legacyV0Result).toMatchObject({
			_tag: "migrated",
			appliedSteps: [
				{ fromVersion: 0, toVersion: 1 },
				{ fromVersion: 1, toVersion: 2 },
			],
			toVersion: CURRENT_PAYLOAD_SCHEMA_VERSION,
		});
	});

	it("normalizes oldest supported payload into current recipient shape", () => {
		const result = normalizePayloadEnvelopeToCurrent({
			envelope: {
				createdAt: "2026-04-14T10:00:00.000Z",
				envText: "API_TOKEN=secret\n",
				lastRewrittenAt: "2026-04-14T10:00:00.000Z",
				payloadId: "bspld_0000000000000000",
				recipients: [
					{
						...currentRecipient,
						fingerprint: "bs1_aaaaaaaaaaaaaaaa",
						handle: "paul#aaaaaaaa",
					},
				],
				version: 0,
			} as unknown as Parameters<
				typeof normalizePayloadEnvelopeToCurrent
			>[0]["envelope"],
		});

		expect(result).toMatchObject({
			_tag: "migrated",
			artifact: {
				payloadId: "bspld_0000000000000000",
				recipients: [currentRecipient],
				version: 2,
			},
		});
	});

	it("blocks otherwise migratable legacy payload versions only when cutoff policy says so", () => {
		const legacyEnvelope = {
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "API_TOKEN=secret\n",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_1111111111111111",
			recipients: [currentRecipient],
			version: 1 as const,
		} as unknown as Parameters<
			typeof normalizePayloadEnvelopeToCurrent
		>[0]["envelope"];

		expect(
			normalizePayloadEnvelopeToCurrent({
				envelope: legacyEnvelope,
			})._tag,
		).toBe("migrated");
		expect(
			normalizePayloadEnvelopeToCurrent({
				envelope: legacyEnvelope,
				policy: {
					hardBreakAtOrBelowVersion: 1,
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "payload-envelope",
			artifactVersion: 1,
			currentVersion: 2,
		});
	});

	it("treats explicit hard-break versions as additive to cutoff policy", () => {
		expect(
			normalizePayloadEnvelopeToCurrent({
				envelope: {
					createdAt: "2026-04-14T10:00:00.000Z",
					envText: "API_TOKEN=secret\n",
					lastRewrittenAt: "2026-04-14T10:00:00.000Z",
					payloadId: "bspld_1111111111111111",
					recipients: [currentRecipient],
					version: 1,
				} as unknown as Parameters<
					typeof normalizePayloadEnvelopeToCurrent
				>[0]["envelope"],
				policy: {
					hardBreakVersions: [1],
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "payload-envelope",
			artifactVersion: 1,
			currentVersion: 2,
		});
	});

	it("keeps unsupported-newer distinct from intentional hard-broken legacy", () => {
		const unsupportedNewerEnvelope = {
			createdAt: "2026-04-14T10:00:00.000Z",
			envText: "API_TOKEN=secret\n",
			lastRewrittenAt: "2026-04-14T10:00:00.000Z",
			payloadId: "bspld_3333333333333333",
			recipients: [currentRecipient],
			version: 3,
		} as unknown as Parameters<
			typeof normalizePayloadEnvelopeToCurrent
		>[0]["envelope"];

		expect(
			normalizePayloadEnvelopeToCurrent({
				envelope: unsupportedNewerEnvelope,
			}),
		).toEqual({
			_tag: "unsupported-newer",
			artifactId: "payload-envelope",
			artifactVersion: 3,
			currentVersion: 2,
		});
	});
});
