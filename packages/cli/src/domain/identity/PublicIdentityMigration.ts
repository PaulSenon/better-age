import { Option, Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { IdentityAlias } from "./IdentityAlias.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import {
	KeyMode,
	type KnownIdentity,
	type SelfIdentity,
} from "./Identity.js";
import { OwnerId } from "./OwnerId.js";
import { PrivateKeyRelativePath } from "./PrivateKeyRelativePath.js";
import { PublicIdentity } from "./PublicIdentity.js";
import { PublicKey } from "./PublicKey.js";

export const LegacyKnownIdentityV1 = Schema.Struct({
	displayName: DisplayName,
	identityUpdatedAt: IdentityUpdatedAt,
	localAlias: Schema.OptionFromNullOr(IdentityAlias),
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type LegacyKnownIdentityV1 = Schema.Schema.Type<
	typeof LegacyKnownIdentityV1
>;

export const LegacySelfIdentityV1 = Schema.Struct({
	createdAt: Schema.String.pipe(Schema.minLength(20)),
	displayName: DisplayName,
	identityUpdatedAt: IdentityUpdatedAt,
	keyMode: KeyMode,
	ownerId: OwnerId,
	privateKeyPath: PrivateKeyRelativePath,
	publicKey: PublicKey,
});

export type LegacySelfIdentityV1 = Schema.Schema.Type<typeof LegacySelfIdentityV1>;

export const LegacyPayloadRecipientV0 = Schema.Struct({
	displayName: DisplayName,
	fingerprint: Schema.String,
	handle: Schema.String,
	identityUpdatedAt: IdentityUpdatedAt,
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type LegacyPayloadRecipientV0 = Schema.Schema.Type<
	typeof LegacyPayloadRecipientV0
>;

export const migrateLegacyKnownIdentityV1 = (input: LegacyKnownIdentityV1): {
	readonly localAlias: Option.Option<IdentityAlias>;
	readonly publicIdentity: KnownIdentity;
} => ({
	localAlias: input.localAlias,
	publicIdentity: Schema.decodeUnknownSync(PublicIdentity)({
		displayName: input.displayName,
		identityUpdatedAt: input.identityUpdatedAt,
		ownerId: input.ownerId,
		publicKey: input.publicKey,
	}),
});

export const migrateLegacySelfIdentityV1 = (
	input: LegacySelfIdentityV1,
): SelfIdentity => ({
	createdAt: input.createdAt,
	keyMode: input.keyMode,
	privateKeyPath: input.privateKeyPath,
	publicIdentity: Schema.decodeUnknownSync(PublicIdentity)({
		displayName: input.displayName,
		identityUpdatedAt: input.identityUpdatedAt,
		ownerId: input.ownerId,
		publicKey: input.publicKey,
	}),
});

export const migrateLegacyPayloadRecipientV0 = (
	input: LegacyPayloadRecipientV0,
): KnownIdentity =>
	Schema.decodeUnknownSync(PublicIdentity)({
		displayName: input.displayName,
		identityUpdatedAt: input.identityUpdatedAt,
		ownerId: input.ownerId,
		publicKey: input.publicKey,
	});
