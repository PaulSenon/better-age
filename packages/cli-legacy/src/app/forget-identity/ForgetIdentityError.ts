import { Schema } from "effect";
import { Handle } from "../../domain/identity/Handle.js";

export class ForgetIdentityPersistenceError extends Schema.TaggedError<ForgetIdentityPersistenceError>()(
	"ForgetIdentityPersistenceError",
	{
		message: Schema.String,
	},
) {}

export class ForgetIdentityForbiddenSelfError extends Schema.TaggedError<ForgetIdentityForbiddenSelfError>()(
	"ForgetIdentityForbiddenSelfError",
	{
		message: Schema.String,
	},
) {}

export class ForgetIdentityAmbiguousIdentityError extends Schema.TaggedError<ForgetIdentityAmbiguousIdentityError>()(
	"ForgetIdentityAmbiguousIdentityError",
	{
		candidates: Schema.Array(Handle),
		identityRef: Schema.String,
		message: Schema.String,
	},
) {}

export class ForgetIdentityRemovedSuccess extends Schema.TaggedClass<ForgetIdentityRemovedSuccess>()(
	"ForgetIdentityRemovedSuccess",
	{
		handle: Handle,
	},
) {}

export class ForgetIdentityUnchangedSuccess extends Schema.TaggedClass<ForgetIdentityUnchangedSuccess>()(
	"ForgetIdentityUnchangedSuccess",
	{
		identityRef: Schema.String,
		reason: Schema.Literal("identity-not-known"),
	},
) {}
