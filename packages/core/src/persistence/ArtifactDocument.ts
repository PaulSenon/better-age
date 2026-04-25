import { Either, Encoding, Schema } from "effect";

const IsoUtcTimestamp = Schema.String;
const OwnerId = Schema.String;
const DisplayName = Schema.String;
const PublicKey = Schema.String;
const KeyFingerprint = Schema.String;
const EncryptedPrivateKeyRef = Schema.String;
const LocalAlias = Schema.String;
const PayloadId = Schema.String;
const EnvText = Schema.String;
const RotationTtl = Schema.String;

const CurrentVersion = Schema.Literal(1);

const KeyMetadataV1 = Schema.Struct({
	publicKey: PublicKey,
	fingerprint: KeyFingerprint,
	encryptedPrivateKeyRef: EncryptedPrivateKeyRef,
	createdAt: IsoUtcTimestamp,
});

const RetiredKeyMetadataV1 = Schema.Struct({
	publicKey: PublicKey,
	fingerprint: KeyFingerprint,
	encryptedPrivateKeyRef: EncryptedPrivateKeyRef,
	createdAt: IsoUtcTimestamp,
	retiredAt: IsoUtcTimestamp,
});

const KnownIdentityV1 = Schema.Struct({
	ownerId: OwnerId,
	publicKey: PublicKey,
	displayName: DisplayName,
	identityUpdatedAt: IsoUtcTimestamp,
	localAlias: Schema.NullOr(LocalAlias),
});

export const HomeStateDocumentV1 = Schema.Struct({
	kind: Schema.Literal("better-age/home-state"),
	version: CurrentVersion,
	ownerId: OwnerId,
	displayName: DisplayName,
	identityUpdatedAt: IsoUtcTimestamp,
	currentKey: KeyMetadataV1,
	retiredKeys: Schema.Array(RetiredKeyMetadataV1),
	knownIdentities: Schema.Array(KnownIdentityV1),
	preferences: Schema.Struct({
		rotationTtl: RotationTtl,
	}),
});

export type HomeStateDocumentV1 = Schema.Schema.Type<
	typeof HomeStateDocumentV1
>;

export const PrivateKeyPlaintextV1 = Schema.Struct({
	kind: Schema.Literal("better-age/private-key"),
	version: CurrentVersion,
	ownerId: OwnerId,
	publicKey: PublicKey,
	privateKey: Schema.String,
	fingerprint: KeyFingerprint,
	createdAt: IsoUtcTimestamp,
});

export type PrivateKeyPlaintextV1 = Schema.Schema.Type<
	typeof PrivateKeyPlaintextV1
>;

export const PublicIdentityDocumentV1 = Schema.Struct({
	kind: Schema.Literal("better-age/public-identity"),
	version: CurrentVersion,
	ownerId: OwnerId,
	displayName: DisplayName,
	publicKey: PublicKey,
	identityUpdatedAt: IsoUtcTimestamp,
});

export type PublicIdentityDocumentV1 = Schema.Schema.Type<
	typeof PublicIdentityDocumentV1
>;

const PayloadRecipientV1 = Schema.Struct({
	ownerId: OwnerId,
	displayName: DisplayName,
	publicKey: PublicKey,
	identityUpdatedAt: IsoUtcTimestamp,
});

export const PayloadPlaintextV1 = Schema.Struct({
	kind: Schema.Literal("better-age/payload"),
	version: CurrentVersion,
	payloadId: PayloadId,
	createdAt: IsoUtcTimestamp,
	lastRewrittenAt: IsoUtcTimestamp,
	envText: EnvText,
	recipients: Schema.Array(PayloadRecipientV1),
});

export type PayloadPlaintextV1 = Schema.Schema.Type<typeof PayloadPlaintextV1>;

export const PayloadDocumentV1 = Schema.Struct({
	kind: Schema.Literal("better-age/payload"),
	version: CurrentVersion,
	encryptedPayload: Schema.String,
});

export type PayloadDocumentV1 = Schema.Schema.Type<typeof PayloadDocumentV1>;

export class ArtifactDocumentInvalidError extends Schema.TaggedError<ArtifactDocumentInvalidError>()(
	"ArtifactDocumentInvalidError",
	{
		artifact: Schema.String,
		message: Schema.String,
	},
) {}

export class ArtifactDocumentKindMismatchError extends Schema.TaggedError<ArtifactDocumentKindMismatchError>()(
	"ArtifactDocumentKindMismatchError",
	{
		artifact: Schema.String,
		expectedKind: Schema.String,
		actualKind: Schema.String,
		message: Schema.String,
	},
) {}

export class ArtifactDocumentUnsupportedVersionError extends Schema.TaggedError<ArtifactDocumentUnsupportedVersionError>()(
	"ArtifactDocumentUnsupportedVersionError",
	{
		artifact: Schema.String,
		artifactVersion: Schema.Number,
		currentVersion: Schema.Number,
		message: Schema.String,
	},
) {}

export class ArtifactDocumentMigrationPathMissingError extends Schema.TaggedError<ArtifactDocumentMigrationPathMissingError>()(
	"ArtifactDocumentMigrationPathMissingError",
	{
		artifact: Schema.String,
		fromVersion: Schema.Number,
		toVersion: Schema.Number,
		message: Schema.String,
	},
) {}

export type ArtifactDocumentParseError =
	| ArtifactDocumentInvalidError
	| ArtifactDocumentKindMismatchError
	| ArtifactDocumentUnsupportedVersionError
	| ArtifactDocumentMigrationPathMissingError;

export type MigrationResult<TCurrent> =
	| {
			readonly kind: "already-current";
			readonly document: TCurrent;
	  }
	| {
			readonly kind: "migrated";
			readonly document: TCurrent;
			readonly fromVersion: number;
			readonly toVersion: number;
	  };

const encodeJsonDocument = (document: unknown): string =>
	JSON.stringify(document);

const parseCurrentDocument = <A, I>(
	input: unknown,
	schema: Schema.Schema<A, I, never>,
	artifact: string,
	expectedKind: string,
): Either.Either<A, ArtifactDocumentParseError> => {
	if (typeof input !== "object" || input === null) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact,
				message: "Artifact document must be an object",
			}),
		);
	}

	const candidate = input as {
		readonly kind?: unknown;
		readonly version?: unknown;
	};

	if (typeof candidate.kind !== "string") {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact,
				message: "Artifact kind is missing or malformed",
			}),
		);
	}

	if (candidate.kind !== expectedKind) {
		return Either.left(
			new ArtifactDocumentKindMismatchError({
				artifact,
				expectedKind,
				actualKind: candidate.kind,
				message: "Artifact kind does not match parser",
			}),
		);
	}

	const version = candidate.version;

	if (typeof version !== "number" || !Number.isInteger(version)) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact,
				message: "Artifact version is missing or malformed",
			}),
		);
	}

	if (version > 1) {
		return Either.left(
			new ArtifactDocumentUnsupportedVersionError({
				artifact,
				artifactVersion: version,
				currentVersion: 1,
				message: "CLI is too old for this artifact version",
			}),
		);
	}

	if (version < 1) {
		return Either.left(
			new ArtifactDocumentMigrationPathMissingError({
				artifact,
				fromVersion: version,
				toVersion: 1,
				message: "Artifact migration path is missing",
			}),
		);
	}

	return Schema.decodeUnknownEither(schema)(input).pipe(
		Either.mapLeft(
			() =>
				new ArtifactDocumentInvalidError({
					artifact,
					message: "Invalid artifact document",
				}),
		),
	);
};

export const parseHomeStateDocument = (
	input: unknown,
): Either.Either<HomeStateDocumentV1, ArtifactDocumentParseError> =>
	parseCurrentDocument(
		input,
		HomeStateDocumentV1,
		"home-state",
		"better-age/home-state",
	);

export const parsePrivateKeyPlaintext = (
	input: unknown,
): Either.Either<PrivateKeyPlaintextV1, ArtifactDocumentParseError> =>
	parseCurrentDocument(
		input,
		PrivateKeyPlaintextV1,
		"private-key",
		"better-age/private-key",
	);

export const parsePayloadPlaintext = (
	input: unknown,
): Either.Either<PayloadPlaintextV1, ArtifactDocumentParseError> =>
	parseCurrentDocument(
		input,
		PayloadPlaintextV1,
		"payload-plaintext",
		"better-age/payload",
	);

export const parsePayloadDocument = (
	input: unknown,
): Either.Either<PayloadDocumentV1, ArtifactDocumentParseError> =>
	parseCurrentDocument(
		input,
		PayloadDocumentV1,
		"payload-document",
		"better-age/payload",
	);

export const parsePublicIdentityDocument = (
	input: unknown,
): Either.Either<PublicIdentityDocumentV1, ArtifactDocumentParseError> =>
	parseCurrentDocument(
		input,
		PublicIdentityDocumentV1,
		"public-identity",
		"better-age/public-identity",
	);

export const encodeHomeStateDocument = (
	document: HomeStateDocumentV1,
): string => encodeJsonDocument(document);

export const encodePrivateKeyPlaintext = (
	document: PrivateKeyPlaintextV1,
): string => encodeJsonDocument(document);

export const encodePayloadPlaintext = (document: PayloadPlaintextV1): string =>
	encodeJsonDocument(document);

export const encodePayloadDocument = (document: PayloadDocumentV1): string =>
	encodeJsonDocument(document);

export const encodePublicIdentityDocument = (
	document: PublicIdentityDocumentV1,
): string => encodeJsonDocument(document);

export const encodePublicIdentityString = (
	document: PublicIdentityDocumentV1,
): string =>
	`better-age://identity/v1/${Encoding.encodeBase64Url(
		encodePublicIdentityDocument(document),
	)}`;

const identityStringPattern =
	/^better-age:\/\/identity\/v(?<version>\d+)\/(?<payload>[A-Za-z0-9_-]+)$/;

export const parsePublicIdentityString = (
	identityString: string,
): Either.Either<PublicIdentityDocumentV1, ArtifactDocumentParseError> => {
	const matches = identityString.match(identityStringPattern);

	if (matches?.groups === undefined) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "public-identity",
				message: "Identity string prefix is malformed",
			}),
		);
	}

	const encodedPayload = matches.groups.payload;

	if (encodedPayload === undefined) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "public-identity",
				message: "Identity string payload is missing",
			}),
		);
	}

	const decodedPayload = Encoding.decodeBase64UrlString(encodedPayload);

	if (Either.isLeft(decodedPayload)) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "public-identity",
				message: "Identity string payload is not base64url",
			}),
		);
	}

	const parsedJson = Schema.decodeUnknownEither(
		Schema.parseJson(Schema.Unknown),
	)(decodedPayload.right);

	if (Either.isLeft(parsedJson)) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "public-identity",
				message: "Identity string payload is not JSON",
			}),
		);
	}

	return parsePublicIdentityDocument(parsedJson.right);
};

export const migrateHomeStateDocument = (
	document: HomeStateDocumentV1,
): MigrationResult<HomeStateDocumentV1> => ({
	kind: "already-current",
	document,
});

export const migratePrivateKeyPlaintext = (
	document: PrivateKeyPlaintextV1,
): MigrationResult<PrivateKeyPlaintextV1> => ({
	kind: "already-current",
	document,
});

export const migratePayloadPlaintext = (
	document: PayloadPlaintextV1,
): MigrationResult<PayloadPlaintextV1> => ({
	kind: "already-current",
	document,
});

export const migratePayloadDocument = (
	document: PayloadDocumentV1,
): MigrationResult<PayloadDocumentV1> => ({
	kind: "already-current",
	document,
});

export const migratePublicIdentityDocument = (
	document: PublicIdentityDocumentV1,
): MigrationResult<PublicIdentityDocumentV1> => ({
	kind: "already-current",
	document,
});
