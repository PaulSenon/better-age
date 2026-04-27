import { Either, Encoding, Option, Schema } from "effect";
import {
	type ArtifactMigrationPolicy,
	type NormalizeArtifactResult,
	normalizeArtifactToCurrent,
	type VersionedArtifactDefinition,
} from "../migration/ArtifactMigration.js";
import {
	PublicIdentity,
	type PublicIdentity as PublicIdentityType,
} from "./PublicIdentity.js";

export class IdentityStringDecodeError extends Schema.TaggedError<IdentityStringDecodeError>()(
	"IdentityStringDecodeError",
	{
		message: Schema.String,
	},
) {}

export const CURRENT_IDENTITY_STRING_SCHEMA_VERSION = 1;

const CURRENT_IDENTITY_STRING_SCHEMA_LITERAL = `v${CURRENT_IDENTITY_STRING_SCHEMA_VERSION}`;

export const IdentityString = Schema.String.pipe(
	Schema.pattern(
		new RegExp(
			`^better-age://identity/${CURRENT_IDENTITY_STRING_SCHEMA_LITERAL}/[A-Za-z0-9_-]+$`,
		),
	),
	Schema.brand("@better-age/IdentityString"),
);

export type IdentityString = Schema.Schema.Type<typeof IdentityString>;

export const IdentityStringPayload = Schema.Struct({
	...PublicIdentity.fields,
	version: Schema.Literal(CURRENT_IDENTITY_STRING_SCHEMA_LITERAL),
});

export type IdentityStringPayload = Schema.Schema.Type<
	typeof IdentityStringPayload
>;

export const toIdentityStringPayload = (
	publicIdentity: PublicIdentityType,
): IdentityStringPayload => ({
	...publicIdentity,
	version: CURRENT_IDENTITY_STRING_SCHEMA_LITERAL,
});

export const toPublicIdentityFromIdentityStringPayload = (
	payload: IdentityStringPayload,
): PublicIdentityType => ({
	displayName: payload.displayName,
	identityUpdatedAt: payload.identityUpdatedAt,
	ownerId: payload.ownerId,
	publicKey: payload.publicKey,
});

export type VersionedIdentityStringPayload = IdentityStringPayload;

export const VersionedIdentityStringPayload = Schema.Union(
	IdentityStringPayload,
);

const identityStringPrefixPattern =
	/^better-age:\/\/identity\/(v\d+)\/([A-Za-z0-9_-]+)$/;

const toIdentityStringPrefix = (version: `v${number}`) =>
	`better-age://identity/${version}/`;

const parseIdentityStringSchemaVersion = (version: unknown) =>
	Schema.decodeUnknownOption(Schema.String.pipe(Schema.pattern(/^v\d+$/)))(
		version,
	).pipe(
		Option.map((value) => Number.parseInt(value.slice(1), 10)),
		Option.filter((value) => Number.isInteger(value) && value >= 0),
		Option.getOrUndefined,
	);

export const readIdentityStringSchemaVersion = (payload: unknown) =>
	parseIdentityStringSchemaVersion(
		typeof payload === "object" && payload !== null
			? (payload as { readonly version?: unknown }).version
			: undefined,
	);

export const IdentityStringMigrationDefinition: VersionedArtifactDefinition<VersionedIdentityStringPayload> =
	{
		artifactId: "identity-string",
		currentVersion: CURRENT_IDENTITY_STRING_SCHEMA_VERSION,
		readVersion: (artifact) => readIdentityStringSchemaVersion(artifact) ?? -1,
		steps: [],
	};

export const normalizeIdentityStringPayloadToCurrent = (input: {
	readonly payload: VersionedIdentityStringPayload;
	readonly policy?: ArtifactMigrationPolicy;
}): NormalizeArtifactResult<VersionedIdentityStringPayload> =>
	normalizeArtifactToCurrent({
		artifact: input.payload,
		definition: IdentityStringMigrationDefinition,
		...(input.policy === undefined ? {} : { policy: input.policy }),
	});

const parseIdentityStringComponents = (identityString: string) => {
	const matches = identityString.match(identityStringPrefixPattern);

	if (matches === null) {
		return Either.left(
			new IdentityStringDecodeError({
				message:
					"Identity string must use a supported better-age identity prefix",
			}),
		);
	}

	const [, version, encodedPayload] = matches;

	if (version === undefined || encodedPayload === undefined) {
		return Either.left(
			new IdentityStringDecodeError({
				message: "Identity string prefix is malformed",
			}),
		);
	}

	return Either.right({
		encodedPayload,
		version,
	});
};

const invalidIdentityStringPayload = (message: string) =>
	new IdentityStringDecodeError({ message });

const decodeVersionedIdentityStringPayload = (
	rawPayload: unknown,
): Either.Either<VersionedIdentityStringPayload, IdentityStringDecodeError> =>
	Schema.decodeUnknownEither(VersionedIdentityStringPayload)(rawPayload).pipe(
		Either.mapLeft(() =>
			invalidIdentityStringPayload("Identity string payload is malformed"),
		),
	);

const decodeCurrentIdentityStringPayload = (
	payload: VersionedIdentityStringPayload,
): Either.Either<IdentityStringPayload, IdentityStringDecodeError> =>
	Schema.decodeUnknownEither(IdentityStringPayload)(payload).pipe(
		Either.mapLeft(() =>
			invalidIdentityStringPayload(
				"Identity string payload could not be normalized to current schema",
			),
		),
	);

export const encodeIdentityString = (
	payload: IdentityStringPayload,
): IdentityString =>
	Schema.decodeUnknownSync(IdentityString)(
		`${toIdentityStringPrefix(payload.version)}${Encoding.encodeBase64Url(
			JSON.stringify(payload),
		)}`,
	);

export const decodeIdentityString = (
	identityString: string,
): Either.Either<IdentityStringPayload, IdentityStringDecodeError> => {
	const parsedComponents = parseIdentityStringComponents(identityString);

	if (Either.isLeft(parsedComponents)) {
		return Either.left(parsedComponents.left);
	}

	const decodedPayload = Encoding.decodeBase64UrlString(
		parsedComponents.right.encodedPayload,
	);

	if (Either.isLeft(decodedPayload)) {
		return Either.left(
			invalidIdentityStringPayload("Identity string payload is not base64url"),
		);
	}

	const parsedJson = Schema.decodeUnknownEither(
		Schema.parseJson(Schema.Unknown),
	)(decodedPayload.right);

	if (Either.isLeft(parsedJson)) {
		return Either.left(
			invalidIdentityStringPayload("Identity string payload is not valid JSON"),
		);
	}

	const payloadVersion = readIdentityStringSchemaVersion(parsedJson.right);

	if (payloadVersion === undefined) {
		return Either.left(
			invalidIdentityStringPayload(
				"Identity string payload is missing a valid version marker",
			),
		);
	}

	const prefixVersion = parseIdentityStringSchemaVersion(
		parsedComponents.right.version,
	);

	if (prefixVersion !== payloadVersion) {
		return Either.left(
			invalidIdentityStringPayload(
				"Identity string prefix version does not match payload version",
			),
		);
	}

	if (payloadVersion > CURRENT_IDENTITY_STRING_SCHEMA_VERSION) {
		return Either.left(
			invalidIdentityStringPayload(
				"CLI is too old to import this identity string. Update CLI to latest version.",
			),
		);
	}

	const versionedPayload = decodeVersionedIdentityStringPayload(
		parsedJson.right,
	);

	if (Either.isLeft(versionedPayload)) {
		return versionedPayload;
	}

	const normalized = normalizeIdentityStringPayloadToCurrent({
		payload: versionedPayload.right,
	});

	switch (normalized._tag) {
		case "current":
		case "migrated":
			return decodeCurrentIdentityStringPayload(normalized.artifact);
		case "unsupported-newer":
			return Either.left(
				invalidIdentityStringPayload(
					"CLI is too old to import this identity string. Update CLI to latest version.",
				),
			);
		case "hard-broken":
			return Either.left(
				invalidIdentityStringPayload(
					"CLI no longer supports migrating this identity string version.",
				),
			);
		case "missing-path":
			return Either.left(
				invalidIdentityStringPayload(
					"CLI cannot migrate this identity string because a migration step is missing.",
				),
			);
		case "invalid-step":
			return Either.left(
				invalidIdentityStringPayload(
					"CLI cannot migrate this identity string because a migration step produced an invalid version.",
				),
			);
	}
};
