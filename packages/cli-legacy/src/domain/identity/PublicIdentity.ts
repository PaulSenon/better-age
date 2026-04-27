import { createHash } from "node:crypto";
import { Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { type Handle, toHandle } from "./Handle.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PublicKey } from "./PublicKey.js";

export const PublicIdentity = Schema.Struct({
	displayName: DisplayName,
	identityUpdatedAt: IdentityUpdatedAt,
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type PublicIdentity = Schema.Schema.Type<typeof PublicIdentity>;

export const derivePublicIdentityHandle = (identity: PublicIdentity): Handle =>
	toHandle({
		displayName: identity.displayName,
		ownerId: identity.ownerId,
	});

export const derivePublicIdentityFingerprint = (
	identity: PublicIdentity,
): KeyFingerprint =>
	Schema.decodeUnknownSync(KeyFingerprint)(
		`bs1_${createHash("sha256").update(identity.publicKey).digest("hex").slice(0, 16)}`,
	);
