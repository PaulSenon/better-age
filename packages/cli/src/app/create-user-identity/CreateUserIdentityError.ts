import { Schema } from "effect";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";

export class CreateUserIdentityCryptoError extends Schema.TaggedError<CreateUserIdentityCryptoError>()(
	"CreateUserIdentityCryptoError",
	{
		message: Schema.String,
	},
) {}

export class CreateUserIdentityPersistenceError extends Schema.TaggedError<CreateUserIdentityPersistenceError>()(
	"CreateUserIdentityPersistenceError",
	{
		message: Schema.String,
		operation: Schema.String,
	},
) {}

export class CreateUserIdentitySuccess extends Schema.TaggedClass<CreateUserIdentitySuccess>()(
	"CreateUserIdentitySuccess",
	{
		displayName: DisplayName,
		fingerprint: KeyFingerprint,
		handle: Handle,
		ownerId: OwnerId,
		privateKeyPath: PrivateKeyRelativePath,
		publicKey: PublicKey,
	},
) {}
