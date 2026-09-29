// `home-state.json` codec. Field order mirrors the persisted JSON so V2 writes
// byte-identical documents to pre-V2 releases (no data migration).
import { Result, Schema } from "effect";
import { ArtifactUnsupportedVersion, HomeStateInvalid } from "../Errors.js";
import { readArtifactHeader } from "./ArtifactHeader.js";

/** Key files must stay inside the managed `keys/` directory. */
export const keyRefPattern = /^keys\/[A-Za-z0-9._-]+\.age$/;

const KeyRef = Schema.String.pipe(
	Schema.check(Schema.isPattern(keyRefPattern)),
);

const CurrentKey = Schema.Struct({
	publicKey: Schema.String,
	fingerprint: Schema.String,
	encryptedPrivateKeyRef: KeyRef,
	createdAt: Schema.String,
});

const RetiredKey = Schema.Struct({
	publicKey: Schema.String,
	fingerprint: Schema.String,
	encryptedPrivateKeyRef: KeyRef,
	createdAt: Schema.String,
	retiredAt: Schema.String,
});

const KnownIdentity = Schema.Struct({
	ownerId: Schema.String,
	publicKey: Schema.String,
	displayName: Schema.String,
	identityUpdatedAt: Schema.String,
	localAlias: Schema.NullOr(Schema.String),
});

const homeStateFields = {
	kind: Schema.Literal("better-age/home-state"),
	ownerId: Schema.String,
	displayName: Schema.String,
	identityUpdatedAt: Schema.String,
	currentKey: CurrentKey,
	retiredKeys: Schema.Array(RetiredKey),
	knownIdentities: Schema.Array(KnownIdentity),
};

const HomeStateV1 = Schema.Struct({
	kind: homeStateFields.kind,
	version: Schema.Literal(1),
	ownerId: homeStateFields.ownerId,
	displayName: homeStateFields.displayName,
	identityUpdatedAt: homeStateFields.identityUpdatedAt,
	currentKey: homeStateFields.currentKey,
	retiredKeys: homeStateFields.retiredKeys,
	knownIdentities: homeStateFields.knownIdentities,
	preferences: Schema.Struct({ rotationTtl: Schema.String }),
});

export const HomeState = Schema.Struct({
	kind: homeStateFields.kind,
	version: Schema.Literal(2),
	ownerId: homeStateFields.ownerId,
	displayName: homeStateFields.displayName,
	identityUpdatedAt: homeStateFields.identityUpdatedAt,
	currentKey: homeStateFields.currentKey,
	retiredKeys: homeStateFields.retiredKeys,
	knownIdentities: homeStateFields.knownIdentities,
	preferences: Schema.Struct({
		rotationTtl: Schema.String,
		editorCommand: Schema.NullOr(Schema.String),
	}),
});

export type HomeState = typeof HomeState.Type;
export type KnownIdentityRecord = HomeState["knownIdentities"][number];
export type RetiredKeyRecord = HomeState["retiredKeys"][number];

export const currentHomeStateVersion = 2;

/**
 * Decodes any supported home-state version into the current one.
 * `migrated` tells the caller the upgraded document should be persisted.
 */
export const decodeHomeState = (
	json: unknown,
): Result.Result<
	{ readonly homeState: HomeState; readonly migrated: boolean },
	HomeStateInvalid | ArtifactUnsupportedVersion
> => {
	const header = readArtifactHeader(json, "better-age/home-state");

	if (header === null) {
		return Result.fail(new HomeStateInvalid());
	}

	if (header.version > currentHomeStateVersion) {
		return Result.fail(
			new ArtifactUnsupportedVersion({
				artifact: "home-state",
				version: header.version,
			}),
		);
	}

	if (header.version === 1) {
		return Schema.decodeUnknownResult(HomeStateV1)(json).pipe(
			Result.map((v1) => ({
				homeState: {
					...v1,
					version: 2 as const,
					preferences: { ...v1.preferences, editorCommand: null },
				},
				migrated: true,
			})),
			Result.mapError(() => new HomeStateInvalid()),
		);
	}

	return Schema.decodeUnknownResult(HomeState)(json).pipe(
		Result.map((homeState) => ({ homeState, migrated: false })),
		Result.mapError(() => new HomeStateInvalid()),
	);
};

export const encodeHomeState = (homeState: HomeState): string =>
	JSON.stringify(homeState);
