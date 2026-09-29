// Expected Core failures. Each `_tag` is the stable public error code printed by
// the CLI (`[ERROR] <CODE>: ...`), so callers can match with `Effect.catchTag`.
// Unexpected IO/runtime problems are defects, not members of this union.
import { Data } from "effect";

export class HomeNotSetup extends Data.TaggedError("HOME_STATE_NOT_FOUND") {}

export class HomeAlreadySetup extends Data.TaggedError(
	"SETUP_ALREADY_CONFIGURED",
) {}

export class SetupNameInvalid extends Data.TaggedError("SETUP_NAME_INVALID") {}

export class HomeStateInvalid extends Data.TaggedError("HOME_STATE_INVALID") {}

export class ArtifactUnsupportedVersion extends Data.TaggedError(
	"ARTIFACT_UNSUPPORTED_VERSION",
)<{ readonly artifact: string; readonly version: number }> {}

export class KeyTransactionIncomplete extends Data.TaggedError(
	"KEY_TRANSACTION_INCOMPLETE",
)<{ readonly cause: unknown }> {}

export class LocalKeyMissing extends Data.TaggedError("LOCAL_KEY_MISSING")<{
	readonly ref: string;
}> {}

export class LocalPermissionRepairFailed extends Data.TaggedError(
	"LOCAL_PERMISSION_REPAIR_FAILED",
)<{ readonly path: string; readonly cause: unknown }> {}

export class PrivateKeyInvalid extends Data.TaggedError(
	"PRIVATE_KEY_INVALID",
) {}

export class PassphraseIncorrect extends Data.TaggedError(
	"PASSPHRASE_INCORRECT",
) {}

export class PayloadNotFound extends Data.TaggedError("PAYLOAD_NOT_FOUND")<{
	readonly path: string;
}> {}

export class PayloadAlreadyExists extends Data.TaggedError(
	"PAYLOAD_ALREADY_EXISTS",
)<{ readonly path: string }> {}

export class PayloadInvalid extends Data.TaggedError("PAYLOAD_INVALID")<{
	readonly path: string;
}> {}

export class PayloadAccessDenied extends Data.TaggedError(
	"PAYLOAD_ACCESS_DENIED",
)<{ readonly path: string }> {}

export class PayloadUpdateRequired extends Data.TaggedError(
	"PAYLOAD_UPDATE_REQUIRED",
)<{ readonly path: string }> {}

export class PayloadWriteVerificationFailed extends Data.TaggedError(
	"PAYLOAD_WRITE_VERIFICATION_FAILED",
) {}

export class IdentityStringInvalid extends Data.TaggedError(
	"IDENTITY_STRING_INVALID",
) {}

export class CannotImportSelf extends Data.TaggedError(
	"CANNOT_IMPORT_SELF_IDENTITY",
) {}

export class KeyUpdateRequiresTrust extends Data.TaggedError(
	"IDENTITY_KEY_UPDATE_REQUIRES_TRUST",
)<{
	readonly ownerId: string;
	readonly oldFingerprint: string;
	readonly newFingerprint: string;
}> {}

export class LocalAliasInvalid extends Data.TaggedError(
	"LOCAL_ALIAS_INVALID",
) {}

export class LocalAliasDuplicate extends Data.TaggedError(
	"LOCAL_ALIAS_DUPLICATE",
) {}

export class IdentityNotFound extends Data.TaggedError(
	"IDENTITY_REFERENCE_NOT_FOUND",
) {}

export class CannotForgetSelf extends Data.TaggedError(
	"CANNOT_FORGET_SELF_IDENTITY",
) {}

export class CannotGrantSelf extends Data.TaggedError("CANNOT_GRANT_SELF") {}

export class CannotRevokeSelf extends Data.TaggedError("CANNOT_REVOKE_SELF") {}

/** Failures of reading local home state; shared by every home-dependent use case. */
export type HomeReadError =
	| HomeNotSetup
	| HomeStateInvalid
	| ArtifactUnsupportedVersion
	| KeyTransactionIncomplete
	| LocalPermissionRepairFailed;

/** Failures of unlocking a local private key with a passphrase. */
export type KeyUnlockError =
	| LocalKeyMissing
	| LocalPermissionRepairFailed
	| KeyTransactionIncomplete
	| PrivateKeyInvalid
	| PassphraseIncorrect;

export type BetterAgeError =
	| HomeReadError
	| KeyUnlockError
	| HomeAlreadySetup
	| SetupNameInvalid
	| PayloadNotFound
	| PayloadAlreadyExists
	| PayloadInvalid
	| PayloadAccessDenied
	| PayloadUpdateRequired
	| PayloadWriteVerificationFailed
	| IdentityStringInvalid
	| CannotImportSelf
	| KeyUpdateRequiresTrust
	| LocalAliasInvalid
	| LocalAliasDuplicate
	| IdentityNotFound
	| CannotForgetSelf
	| CannotGrantSelf
	| CannotRevokeSelf;

export type BetterAgeErrorCode = BetterAgeError["_tag"];
