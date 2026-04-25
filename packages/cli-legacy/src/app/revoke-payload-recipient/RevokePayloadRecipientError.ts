import { Schema } from "effect";
import { Handle } from "../../domain/identity/Handle.js";

export class RevokePayloadRecipientPersistenceError extends Schema.TaggedError<RevokePayloadRecipientPersistenceError>()(
	"RevokePayloadRecipientPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class RevokePayloadRecipientCryptoError extends Schema.TaggedError<RevokePayloadRecipientCryptoError>()(
	"RevokePayloadRecipientCryptoError",
	{
		message: Schema.String,
	},
) {}

export class RevokePayloadRecipientEnvError extends Schema.TaggedError<RevokePayloadRecipientEnvError>()(
	"RevokePayloadRecipientEnvError",
	{
		message: Schema.String,
	},
) {}

export class RevokePayloadRecipientUpdateRequiredError extends Schema.TaggedError<RevokePayloadRecipientUpdateRequiredError>()(
	"RevokePayloadRecipientUpdateRequiredError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

export class RevokePayloadRecipientVersionError extends Schema.TaggedError<RevokePayloadRecipientVersionError>()(
	"RevokePayloadRecipientVersionError",
	{
		message: Schema.String,
	},
) {}

export class RevokePayloadRecipientAmbiguousIdentityError extends Schema.TaggedError<RevokePayloadRecipientAmbiguousIdentityError>()(
	"RevokePayloadRecipientAmbiguousIdentityError",
	{
		candidates: Schema.Array(Handle),
		identityRef: Schema.String,
		message: Schema.String,
	},
) {}

export class RevokePayloadRecipientForbiddenSelfError extends Schema.TaggedError<RevokePayloadRecipientForbiddenSelfError>()(
	"RevokePayloadRecipientForbiddenSelfError",
	{
		message: Schema.String,
	},
) {}

export class RevokePayloadRecipientRemovedSuccess extends Schema.TaggedClass<RevokePayloadRecipientRemovedSuccess>()(
	"RevokePayloadRecipientRemovedSuccess",
	{
		path: Schema.String,
	},
) {}

export class RevokePayloadRecipientUnchangedSuccess extends Schema.TaggedClass<RevokePayloadRecipientUnchangedSuccess>()(
	"RevokePayloadRecipientUnchangedSuccess",
	{
		path: Schema.String,
		reason: Schema.Literal("recipient-not-granted"),
	},
) {}
