import { Option, Schema } from "effect";
import {
	type ArtifactMigrationPolicy,
	normalizeArtifactToCurrent,
	type NormalizeArtifactResult,
	type VersionedArtifactDefinition,
} from "../migration/ArtifactMigration.js";
import {
	LegacyKnownIdentityV1,
	LegacySelfIdentityV1,
	migrateLegacyKnownIdentityV1,
	migrateLegacySelfIdentityV1,
} from "../identity/PublicIdentityMigration.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";
import {
	emptyLocalAliasMap,
	LocalAliasMap,
	RetiredKey,
	setLocalAlias,
} from "../identity/Identity.js";
import {
	emptyHomeState,
	HomeState,
	type HomeState as CurrentHomeState,
	RotationTtl,
} from "./HomeState.js";

const HomeStateVersion = Schema.Number.pipe(
	Schema.int(),
	Schema.greaterThanOrEqualTo(0),
);

const LegacyHomeStateV1 = Schema.Struct({
	activeKeyFingerprint: Schema.OptionFromNullOr(KeyFingerprint),
	defaultEditorCommand: Schema.OptionFromNullOr(Schema.String),
	homeSchemaVersion: Schema.Literal(1),
	knownIdentities: Schema.Array(LegacyKnownIdentityV1),
	retiredKeys: Schema.Array(RetiredKey),
	rotationTtl: RotationTtl,
	self: Schema.OptionFromNullOr(LegacySelfIdentityV1),
});

type LegacyHomeStateV1 = Schema.Schema.Type<typeof LegacyHomeStateV1>;

const LegacyHomeStateV0 = Schema.Struct({
	activeKeyFingerprint: Schema.OptionFromNullOr(KeyFingerprint),
	defaultEditorCommand: Schema.OptionFromNullOr(Schema.String),
	homeSchemaVersion: Schema.Literal(0),
	knownIdentities: Schema.Array(LegacyKnownIdentityV1),
	retiredKeys: Schema.Array(RetiredKey),
	self: Schema.OptionFromNullOr(LegacySelfIdentityV1),
});

type LegacyHomeStateV0 = Schema.Schema.Type<typeof LegacyHomeStateV0>;

export type VersionedHomeStateDocument =
	| CurrentHomeState
	| LegacyHomeStateV0
	| LegacyHomeStateV1;

export const CURRENT_HOME_SCHEMA_VERSION = 2;

export const readHomeSchemaVersion = (document: unknown) =>
	Schema.decodeUnknownOption(HomeStateVersion)(
		typeof document === "object" && document !== null
			? (document as { readonly homeSchemaVersion?: unknown }).homeSchemaVersion
			: undefined,
	).pipe(Option.getOrUndefined);

const upgradeLegacyHomeStateV0 = (
	document: LegacyHomeStateV0,
): LegacyHomeStateV1 => ({
	...document,
	homeSchemaVersion: 1,
	rotationTtl: "3m",
});

const toLocalAliasesFromLegacyKnownIdentities = (
	knownIdentities: LegacyHomeStateV1["knownIdentities"],
): LocalAliasMap =>
	knownIdentities.reduce((localAliases, knownIdentity) => {
		const migratedKnownIdentity = migrateLegacyKnownIdentityV1(knownIdentity);

		return setLocalAlias({
			localAlias: migratedKnownIdentity.localAlias,
			localAliases,
			ownerId: migratedKnownIdentity.publicIdentity.ownerId,
		});
	}, emptyLocalAliasMap());

const upgradeLegacyHomeStateV1 = (
	document: LegacyHomeStateV1,
): CurrentHomeState => ({
	activeKeyFingerprint: document.activeKeyFingerprint,
	defaultEditorCommand: document.defaultEditorCommand,
	homeSchemaVersion: 2,
	knownIdentities: document.knownIdentities.map(
		(knownIdentity) => migrateLegacyKnownIdentityV1(knownIdentity).publicIdentity,
	),
	localAliases: toLocalAliasesFromLegacyKnownIdentities(document.knownIdentities),
	retiredKeys: document.retiredKeys,
	rotationTtl: document.rotationTtl,
	self: Option.map(document.self, migrateLegacySelfIdentityV1),
});

export const VersionedHomeStateDocument = Schema.Union(
	HomeState,
	LegacyHomeStateV0,
	LegacyHomeStateV1,
);

export const HomeStateMigrationDefinition: VersionedArtifactDefinition<VersionedHomeStateDocument> =
	{
		artifactId: "home-state",
		currentVersion: CURRENT_HOME_SCHEMA_VERSION,
		readVersion: (artifact) => artifact.homeSchemaVersion,
		steps: [
			{
				fromVersion: 0,
				migrate: upgradeLegacyHomeStateV0,
				toVersion: 1,
			},
			{
				fromVersion: 1,
				migrate: upgradeLegacyHomeStateV1,
				toVersion: 2,
			},
		],
	};

export const normalizeHomeStateToCurrent = (input: {
	readonly document: VersionedHomeStateDocument;
	readonly policy?: ArtifactMigrationPolicy;
}): NormalizeArtifactResult<VersionedHomeStateDocument> =>
	normalizeArtifactToCurrent({
		artifact: input.document,
		definition: HomeStateMigrationDefinition,
		policy: input.policy,
	});

export const emptyCurrentHomeState = () => emptyHomeState();
