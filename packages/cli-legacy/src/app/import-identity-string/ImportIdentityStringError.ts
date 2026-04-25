import { Schema } from "effect";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";

export class ImportIdentityStringConflictError extends Schema.TaggedError<ImportIdentityStringConflictError>()(
	"ImportIdentityStringConflictError",
	{
		message: Schema.String,
		ownerId: OwnerId,
	},
) {}

export class ImportIdentityStringDecodeError extends Schema.TaggedError<ImportIdentityStringDecodeError>()(
	"ImportIdentityStringDecodeError",
	{
		message: Schema.String,
	},
) {}

export class ImportIdentityStringForbiddenSelfError extends Schema.TaggedError<ImportIdentityStringForbiddenSelfError>()(
	"ImportIdentityStringForbiddenSelfError",
	{
		message: Schema.String,
	},
) {}

export class ImportIdentityStringPersistenceError extends Schema.TaggedError<ImportIdentityStringPersistenceError>()(
	"ImportIdentityStringPersistenceError",
	{
		message: Schema.String,
	},
) {}

export class ImportIdentityStringSuccess extends Schema.TaggedClass<ImportIdentityStringSuccess>()(
	"ImportIdentityStringSuccess",
	{
		displayName: DisplayName,
		handle: Handle,
		outcome: Schema.Literal("added", "updated", "unchanged"),
	},
) {}
