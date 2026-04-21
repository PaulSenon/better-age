import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	CURRENT_HOME_SCHEMA_VERSION,
	LegacyHomeStateV0,
	LegacyHomeStateV1,
	normalizeHomeStateToCurrent,
	VersionedHomeStateDocument,
} from "./HomeStateMigration.js";

const encodeLegacyKnownIdentityV1 = () => ({
	displayName: "Ops",
	identityUpdatedAt: "2025-01-03T00:00:00.000Z",
	localAlias: "TeamOps",
	ownerId: "owner_ops",
	publicKey: "age1opspublickey",
});

const encodeLegacySelfIdentityV1 = () => ({
	createdAt: "2025-01-01T00:00:00.000Z",
	displayName: "Isaac",
	identityUpdatedAt: "2025-01-02T00:00:00.000Z",
	keyMode: "pq-hybrid" as const,
	ownerId: "owner_isaac",
	privateKeyPath: "keys/active.key.age",
	publicKey: "age1isaacpublickey",
});

describe("HomeStateMigration", () => {
	it("keeps every released home version migratable by default", () => {
		const currentResult = normalizeHomeStateToCurrent({
			document: Schema.decodeUnknownSync(VersionedHomeStateDocument)({
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 2,
				knownIdentities: [],
				localAliases: {},
				retiredKeys: [],
				rotationTtl: "3m",
				self: null,
			}),
		});
		const legacyV1Result = normalizeHomeStateToCurrent({
			document: Schema.decodeUnknownSync(LegacyHomeStateV1)({
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 1,
				knownIdentities: [encodeLegacyKnownIdentityV1()],
				retiredKeys: [],
				rotationTtl: "3m",
				self: encodeLegacySelfIdentityV1(),
			}),
		});
		const legacyV0Result = normalizeHomeStateToCurrent({
			document: Schema.decodeUnknownSync(LegacyHomeStateV0)({
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 0,
				knownIdentities: [encodeLegacyKnownIdentityV1()],
				retiredKeys: [],
				self: encodeLegacySelfIdentityV1(),
			}),
		});

		expect(currentResult._tag).toBe("current");
		expect(legacyV1Result).toMatchObject({
			_tag: "migrated",
			appliedSteps: [{ fromVersion: 1, toVersion: 2 }],
			toVersion: CURRENT_HOME_SCHEMA_VERSION,
		});
		expect(legacyV0Result).toMatchObject({
			_tag: "migrated",
			appliedSteps: [
				{ fromVersion: 0, toVersion: 1 },
				{ fromVersion: 1, toVersion: 2 },
			],
			toVersion: CURRENT_HOME_SCHEMA_VERSION,
		});
	});

	it("migrates legacy home documents into current canonical shape", () => {
		const result = normalizeHomeStateToCurrent({
			document: Schema.decodeUnknownSync(LegacyHomeStateV1)({
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 1,
				knownIdentities: [encodeLegacyKnownIdentityV1()],
				retiredKeys: [],
				rotationTtl: "3m",
				self: encodeLegacySelfIdentityV1(),
			}),
		});

		expect(result).toMatchObject({
			_tag: "migrated",
			artifact: {
				homeSchemaVersion: 2,
				knownIdentities: [
					{
						displayName: "Ops",
						identityUpdatedAt: "2025-01-03T00:00:00.000Z",
						ownerId: "owner_ops",
						publicKey: "age1opspublickey",
					},
				],
				localAliases: {
					owner_ops: "TeamOps",
				},
				self: {
					_tag: "Some",
					value: {
						createdAt: "2025-01-01T00:00:00.000Z",
						keyMode: "pq-hybrid",
						privateKeyPath: "keys/active.key.age",
						publicIdentity: {
							displayName: "Isaac",
							identityUpdatedAt: "2025-01-02T00:00:00.000Z",
							ownerId: "owner_isaac",
							publicKey: "age1isaacpublickey",
						},
					},
				},
			},
		});
	});

	it("blocks otherwise migratable legacy home versions only when cutoff policy says so", () => {
		const legacyDocument = Schema.decodeUnknownSync(VersionedHomeStateDocument)(
			{
				activeKeyFingerprint: null,
				defaultEditorCommand: null,
				homeSchemaVersion: 1 as const,
				knownIdentities: [encodeLegacyKnownIdentityV1()],
				retiredKeys: [],
				rotationTtl: "3m" as const,
				self: encodeLegacySelfIdentityV1(),
			},
		);

		expect(
			normalizeHomeStateToCurrent({
				document: legacyDocument,
			})._tag,
		).toBe("migrated");
		expect(
			normalizeHomeStateToCurrent({
				document: legacyDocument,
				policy: {
					hardBreakAtOrBelowVersion: 1,
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "home-state",
			artifactVersion: 1,
			currentVersion: 2,
		});
	});

	it("treats explicit hard-break versions as additive to cutoff policy", () => {
		expect(
			normalizeHomeStateToCurrent({
				document: Schema.decodeUnknownSync(LegacyHomeStateV1)({
					activeKeyFingerprint: null,
					defaultEditorCommand: null,
					homeSchemaVersion: 1,
					knownIdentities: [encodeLegacyKnownIdentityV1()],
					retiredKeys: [],
					rotationTtl: "3m",
					self: encodeLegacySelfIdentityV1(),
				}),
				policy: {
					hardBreakVersions: [1],
				},
			}),
		).toEqual({
			_tag: "hard-broken",
			artifactId: "home-state",
			artifactVersion: 1,
			currentVersion: 2,
		});
	});

	it("keeps unsupported-newer distinct from intentional hard-broken legacy", () => {
		const unsupportedNewerDocument = {
			activeKeyFingerprint: null,
			defaultEditorCommand: null,
			homeSchemaVersion: 3,
			knownIdentities: [],
			localAliases: {},
			retiredKeys: [],
			rotationTtl: "3m",
			self: null,
		} as unknown as Parameters<
			typeof normalizeHomeStateToCurrent
		>[0]["document"];

		expect(
			normalizeHomeStateToCurrent({
				document: unsupportedNewerDocument,
			}),
		).toEqual({
			_tag: "unsupported-newer",
			artifactId: "home-state",
			artifactVersion: 3,
			currentVersion: 2,
		});
	});
});
