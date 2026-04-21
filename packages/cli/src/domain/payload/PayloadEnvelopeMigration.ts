import { Schema } from "effect";
import {
	type ArtifactMigrationPolicy,
	normalizeArtifactToCurrent,
	type NormalizeArtifactResult,
	type VersionedArtifactDefinition,
} from "../migration/ArtifactMigration.js";
import {
	LegacyPayloadRecipientV0,
	migrateLegacyPayloadRecipientV0,
} from "../identity/PublicIdentityMigration.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import {
	PayloadEnvelope,
	PayloadRecipient,
	type PayloadEnvelope as CurrentPayloadEnvelope,
} from "./PayloadEnvelope.js";
import { PayloadId } from "./PayloadId.js";

const PayloadSchemaVersion = Schema.Number.pipe(
	Schema.int(),
	Schema.greaterThanOrEqualTo(0),
);

export const CURRENT_PAYLOAD_SCHEMA_VERSION = 2;

export const LegacyPayloadEnvelopeV1 = Schema.Struct({
	createdAt: IdentityUpdatedAt,
	envText: Schema.String,
	lastRewrittenAt: IdentityUpdatedAt,
	payloadId: PayloadId,
	recipients: Schema.Array(PayloadRecipient),
	version: Schema.Literal(1),
});

export type LegacyPayloadEnvelopeV1 = Schema.Schema.Type<
	typeof LegacyPayloadEnvelopeV1
>;

export const LegacyPayloadEnvelopeV0 = Schema.Struct({
	createdAt: IdentityUpdatedAt,
	envText: Schema.String,
	lastRewrittenAt: IdentityUpdatedAt,
	payloadId: PayloadId,
	recipients: Schema.Array(LegacyPayloadRecipientV0),
	version: Schema.Literal(0),
});

export type LegacyPayloadEnvelopeV0 = Schema.Schema.Type<
	typeof LegacyPayloadEnvelopeV0
>;

export type VersionedPayloadEnvelope =
	| CurrentPayloadEnvelope
	| LegacyPayloadEnvelopeV0
	| LegacyPayloadEnvelopeV1;

export const VersionedPayloadEnvelope = Schema.Union(
	PayloadEnvelope,
	LegacyPayloadEnvelopeV0,
	LegacyPayloadEnvelopeV1,
);

export const readPayloadSchemaVersion = (document: unknown) =>
	Schema.decodeUnknownOption(PayloadSchemaVersion)(
		typeof document === "object" && document !== null
			? (document as { readonly version?: unknown }).version
			: undefined,
	);

const upgradeLegacyPayloadEnvelopeV0 = (
	envelope: LegacyPayloadEnvelopeV0,
): LegacyPayloadEnvelopeV1 => ({
	...envelope,
	recipients: envelope.recipients.map(migrateLegacyPayloadRecipientV0),
	version: 1,
});

const upgradeLegacyPayloadEnvelopeV1 = (
	envelope: LegacyPayloadEnvelopeV1,
): CurrentPayloadEnvelope => ({
	...envelope,
	version: 2,
});

export const PayloadEnvelopeMigrationDefinition: VersionedArtifactDefinition<VersionedPayloadEnvelope> =
	{
		artifactId: "payload-envelope",
		currentVersion: CURRENT_PAYLOAD_SCHEMA_VERSION,
		readVersion: (artifact) => artifact.version,
		steps: [
			{
				fromVersion: 0,
				migrate: upgradeLegacyPayloadEnvelopeV0,
				toVersion: 1,
			},
			{
				fromVersion: 1,
				migrate: upgradeLegacyPayloadEnvelopeV1,
				toVersion: 2,
			},
		],
	};

export const normalizePayloadEnvelopeToCurrent = (input: {
	readonly envelope: VersionedPayloadEnvelope;
	readonly policy?: ArtifactMigrationPolicy;
}): NormalizeArtifactResult<VersionedPayloadEnvelope> =>
	normalizeArtifactToCurrent({
		artifact: input.envelope,
		definition: PayloadEnvelopeMigrationDefinition,
		policy: input.policy,
	});
