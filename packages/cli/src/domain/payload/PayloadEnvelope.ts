import { Schema } from "effect";
import { DisplayName } from "../identity/DisplayName.js";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";
import { OwnerId } from "../identity/OwnerId.js";
import { PublicKey } from "../identity/PublicKey.js";
import { PayloadId } from "./PayloadId.js";

export const PayloadRecipient = Schema.Struct({
	displayNameSnapshot: DisplayName,
	fingerprint: KeyFingerprint,
	identityUpdatedAt: IdentityUpdatedAt,
	ownerId: OwnerId,
	publicKey: PublicKey,
});

export type PayloadRecipient = Schema.Schema.Type<typeof PayloadRecipient>;

export const PayloadEnvelope = Schema.Struct({
	createdAt: IdentityUpdatedAt,
	envText: Schema.String,
	lastRewrittenAt: IdentityUpdatedAt,
	payloadId: PayloadId,
	recipients: Schema.Array(PayloadRecipient),
	version: Schema.Literal(1),
});

export type PayloadEnvelope = Schema.Schema.Type<typeof PayloadEnvelope>;
