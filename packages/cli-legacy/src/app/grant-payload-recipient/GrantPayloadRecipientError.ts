import { Schema } from "effect";
import { Handle } from "../../domain/identity/Handle.js";

export class GrantPayloadRecipientPersistenceError extends Schema.TaggedError<GrantPayloadRecipientPersistenceError>()(
	"GrantPayloadRecipientPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class GrantPayloadRecipientCryptoError extends Schema.TaggedError<GrantPayloadRecipientCryptoError>()(
	"GrantPayloadRecipientCryptoError",
	{
		message: Schema.String,
	},
) {}

export class GrantPayloadRecipientEnvError extends Schema.TaggedError<GrantPayloadRecipientEnvError>()(
	"GrantPayloadRecipientEnvError",
	{
		message: Schema.String,
	},
) {}

export class GrantPayloadRecipientUpdateRequiredError extends Schema.TaggedError<GrantPayloadRecipientUpdateRequiredError>()(
	"GrantPayloadRecipientUpdateRequiredError",
	{
		message: Schema.String,
		path: Schema.String,
	},
) {}

export class GrantPayloadRecipientVersionError extends Schema.TaggedError<GrantPayloadRecipientVersionError>()(
	"GrantPayloadRecipientVersionError",
	{
		message: Schema.String,
	},
) {}

export class GrantPayloadRecipientIdentityNotFoundError extends Schema.TaggedError<GrantPayloadRecipientIdentityNotFoundError>()(
	"GrantPayloadRecipientIdentityNotFoundError",
	{
		identityRef: Schema.String,
		message: Schema.String,
	},
) {}

export class GrantPayloadRecipientAmbiguousIdentityError extends Schema.TaggedError<GrantPayloadRecipientAmbiguousIdentityError>()(
	"GrantPayloadRecipientAmbiguousIdentityError",
	{
		candidates: Schema.Array(Handle),
		identityRef: Schema.String,
		message: Schema.String,
	},
) {}

export class GrantPayloadRecipientAddedSuccess extends Schema.TaggedClass<GrantPayloadRecipientAddedSuccess>()(
	"GrantPayloadRecipientAddedSuccess",
	{
		handle: Handle,
		path: Schema.String,
	},
) {}

export class GrantPayloadRecipientUpdatedSuccess extends Schema.TaggedClass<GrantPayloadRecipientUpdatedSuccess>()(
	"GrantPayloadRecipientUpdatedSuccess",
	{
		handle: Handle,
		path: Schema.String,
	},
) {}

export class GrantPayloadRecipientUnchangedSuccess extends Schema.TaggedClass<GrantPayloadRecipientUnchangedSuccess>()(
	"GrantPayloadRecipientUnchangedSuccess",
	{
		handle: Handle,
		path: Schema.String,
		reason: Schema.Literal("already-granted", "outdated-input"),
	},
) {}
