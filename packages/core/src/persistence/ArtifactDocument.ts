import { Either, Encoding, Schema } from "effect";

const IsoUtcTimestamp = Schema.String;
const OwnerId = Schema.String;
const DisplayName = Schema.String;
const PublicKey = Schema.String;
const KeyFingerprint = Schema.String;
const EncryptedPrivateKeyRef = Schema.String.pipe(
	Schema.pattern(/^keys\/[A-Za-z0-9._-]+\.age$/),
);
const LocalAlias = Schema.String;
const PayloadId = Schema.String;
const EnvText = Schema.String;
const RotationTtl = Schema.String;
const keyMetadataPrefix = "# better-age-key-metadata/v1 ";

const ArtifactVersionV1 = Schema.Literal(1);
const HomeStateVersionV2 = Schema.Literal(2);

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
	version: ArtifactVersionV1,
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

export const HomeStateDocumentV2 = Schema.Struct({
	kind: Schema.Literal("better-age/home-state"),
	version: HomeStateVersionV2,
	ownerId: OwnerId,
	displayName: DisplayName,
	identityUpdatedAt: IsoUtcTimestamp,
	currentKey: KeyMetadataV1,
	retiredKeys: Schema.Array(RetiredKeyMetadataV1),
	knownIdentities: Schema.Array(KnownIdentityV1),
	preferences: Schema.Struct({
		rotationTtl: RotationTtl,
		editorCommand: Schema.NullOr(Schema.String),
	}),
});

export type HomeStateDocumentV2 = Schema.Schema.Type<
	typeof HomeStateDocumentV2
>;

export const PrivateKeyPlaintextV1 = Schema.Struct({
	kind: Schema.Literal("better-age/private-key"),
	version: ArtifactVersionV1,
	ownerId: OwnerId,
	publicKey: PublicKey,
	privateKey: Schema.String,
	fingerprint: KeyFingerprint,
	createdAt: IsoUtcTimestamp,
});

export type PrivateKeyPlaintextV1 = Schema.Schema.Type<
	typeof PrivateKeyPlaintextV1
>;

export const PrivateKeyMetadataV1 = Schema.Struct({
	kind: Schema.Literal("better-age/key-metadata"),
	version: ArtifactVersionV1,
	ownerId: OwnerId,
	publicKey: PublicKey,
	fingerprint: KeyFingerprint,
	createdAt: IsoUtcTimestamp,
});

export type PrivateKeyMetadataV1 = Schema.Schema.Type<
	typeof PrivateKeyMetadataV1
>;

export const PublicIdentityDocumentV1 = Schema.Struct({
	kind: Schema.Literal("better-age/public-identity"),
	version: ArtifactVersionV1,
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
	version: ArtifactVersionV1,
	payloadId: PayloadId,
	createdAt: IsoUtcTimestamp,
	lastRewrittenAt: IsoUtcTimestamp,
	envText: EnvText,
	recipients: Schema.Array(PayloadRecipientV1),
});

export type PayloadPlaintextV1 = Schema.Schema.Type<typeof PayloadPlaintextV1>;

export const PayloadDocumentV1 = Schema.Struct({
	kind: Schema.Literal("better-age/payload"),
	version: ArtifactVersionV1,
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

const parseVersionedDocument = <A>(
	input: unknown,
	schemas: Readonly<Record<number, Schema.Schema.AnyNoContext>>,
	artifact: string,
	expectedKind: string,
	currentVersion: number,
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

	if (version > currentVersion) {
		return Either.left(
			new ArtifactDocumentUnsupportedVersionError({
				artifact,
				artifactVersion: version,
				currentVersion,
				message: "CLI is too old for this artifact version",
			}),
		);
	}

	const schema = schemas[version];

	if (schema === undefined) {
		return Either.left(
			new ArtifactDocumentMigrationPathMissingError({
				artifact,
				fromVersion: version,
				toVersion: currentVersion,
				message: "Artifact migration path is missing",
			}),
		);
	}

	return Schema.decodeUnknownEither(schema)(input).pipe(
		Either.map((document) => document as A),
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
): Either.Either<
	HomeStateDocumentV1 | HomeStateDocumentV2,
	ArtifactDocumentParseError
> =>
	parseVersionedDocument<HomeStateDocumentV1 | HomeStateDocumentV2>(
		input,
		{
			1: HomeStateDocumentV1,
			2: HomeStateDocumentV2,
		},
		"home-state",
		"better-age/home-state",
		2,
	);

export const parsePrivateKeyPlaintext = (
	input: unknown,
): Either.Either<PrivateKeyPlaintextV1, ArtifactDocumentParseError> => {
	if (typeof input !== "string") {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "private-key",
				message: "Private key plaintext must be age identity text",
			}),
		);
	}

	const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0);
	const metadataLine = lines[0];

	if (
		metadataLine === undefined ||
		!metadataLine.startsWith(keyMetadataPrefix)
	) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "private-key",
				message: "Private key metadata is missing or malformed",
			}),
		);
	}

	const decodedMetadata = Encoding.decodeBase64UrlString(
		metadataLine.slice(keyMetadataPrefix.length),
	).pipe(
		Either.flatMap((metadataJson) =>
			Schema.decodeUnknownEither(Schema.parseJson(Schema.Unknown))(
				metadataJson,
			),
		),
		Either.flatMap((metadata) =>
			Schema.decodeUnknownEither(PrivateKeyMetadataV1)(metadata),
		),
	);

	if (Either.isLeft(decodedMetadata)) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "private-key",
				message: "Private key metadata is invalid",
			}),
		);
	}

	const identityLines = lines.filter((line) => !line.startsWith("#"));

	if (identityLines.length !== 1) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "private-key",
				message: "Private key identity line is missing or ambiguous",
			}),
		);
	}

	const privateKey = identityLines[0];

	if (privateKey === undefined) {
		return Either.left(
			new ArtifactDocumentInvalidError({
				artifact: "private-key",
				message: "Private key identity line is missing",
			}),
		);
	}

	return Either.right({
		...decodedMetadata.right,
		kind: "better-age/private-key",
		version: 1,
		privateKey,
	});
};

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
	document: HomeStateDocumentV2,
): string => encodeJsonDocument(document);

export const encodePrivateKeyPlaintext = (
	document: PrivateKeyPlaintextV1,
): string => {
	const metadata: PrivateKeyMetadataV1 = {
		kind: "better-age/key-metadata",
		version: 1,
		ownerId: document.ownerId,
		publicKey: document.publicKey,
		fingerprint: document.fingerprint,
		createdAt: document.createdAt,
	};

	return [
		`${keyMetadataPrefix}${Encoding.encodeBase64Url(
			encodeJsonDocument(metadata),
		)}`,
		document.privateKey,
		"",
	].join("\n");
};

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
	document: HomeStateDocumentV1 | HomeStateDocumentV2,
): MigrationResult<HomeStateDocumentV2> => {
	if (document.version === 2) {
		return {
			kind: "already-current",
			document,
		};
	}

	return {
		kind: "migrated",
		fromVersion: 1,
		toVersion: 2,
		document: {
			...document,
			version: 2,
			preferences: {
				...document.preferences,
				editorCommand: null,
			},
		},
	};
};

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
