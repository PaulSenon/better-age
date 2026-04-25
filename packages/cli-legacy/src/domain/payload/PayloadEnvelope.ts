import { Schema } from "effect";
import { IdentityUpdatedAt } from "../identity/IdentityUpdatedAt.js";
import { PublicIdentity } from "../identity/PublicIdentity.js";
import { PayloadId } from "./PayloadId.js";

export const PayloadRecipient = PublicIdentity;

export type PayloadRecipient = Schema.Schema.Type<typeof PayloadRecipient>;

export const PayloadEnvelope = Schema.Struct({
	createdAt: IdentityUpdatedAt,
	envText: Schema.String,
	lastRewrittenAt: IdentityUpdatedAt,
	payloadId: PayloadId,
	recipients: Schema.Array(PayloadRecipient),
	version: Schema.Literal(2),
});

export type PayloadEnvelope = Schema.Schema.Type<typeof PayloadEnvelope>;
