import { Schema } from "effect";
import { DisplayName } from "../identity/DisplayName.js";
import { KeyFingerprint } from "../identity/KeyFingerprint.js";

export class ActiveKeyAlreadyExistsError extends Schema.TaggedError<ActiveKeyAlreadyExistsError>()(
	"ActiveKeyAlreadyExistsError",
	{
		displayName: DisplayName,
		fingerprint: KeyFingerprint,
		message: Schema.String,
	},
) {}

export class InvalidIdentityAliasError extends Schema.TaggedError<InvalidIdentityAliasError>()(
	"InvalidIdentityAliasError",
	{
		displayName: Schema.String,
		message: Schema.String,
	},
) {}
