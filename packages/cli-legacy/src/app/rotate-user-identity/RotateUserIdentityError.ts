import { Schema } from "effect";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";

export class RotateUserIdentityCryptoError extends Schema.TaggedError<RotateUserIdentityCryptoError>()(
	"RotateUserIdentityCryptoError",
	{
		message: Schema.String,
	},
) {}

export class RotateUserIdentityPersistenceError extends Schema.TaggedError<RotateUserIdentityPersistenceError>()(
	"RotateUserIdentityPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class RotateUserIdentityNoActiveIdentityError extends Schema.TaggedError<RotateUserIdentityNoActiveIdentityError>()(
	"RotateUserIdentityNoActiveIdentityError",
	{
		message: Schema.String,
	},
) {}

export class RotateUserIdentitySuccess extends Schema.TaggedClass<RotateUserIdentitySuccess>()(
	"RotateUserIdentitySuccess",
	{
		newFingerprint: KeyFingerprint,
		oldFingerprint: KeyFingerprint,
		ownerId: OwnerId,
	},
) {}
