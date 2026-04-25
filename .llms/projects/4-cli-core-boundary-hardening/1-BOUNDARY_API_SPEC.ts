/**
 * Boundary API Spec
 *
 * Goal:
 * - define the target package split and layer responsibilities
 * - define the exact TypeScript IO contracts between those layers
 * - cover the full current product surface, not only a refactor subset
 * - keep domain rules in core and shell policy in CLI
 *
 * This is a spec file only.
 * It is not runtime code.
 */

// ===========================================================================
// Package + layer map
// ===========================================================================

/**
 * Package: @better-age/core
 *
 * Layers:
 * - domain/model
 *   canonical concepts and pure rules
 * - app/api
 *   public core lifecycle, queries, commands
 * - app/ports
 *   repository / crypto / clock / randomness boundaries
 * - infra/*
 *   node/fs/age implementations of those ports
 *
 * Core owns:
 * - artifact migration policy execution
 * - identity parsing and resolution rules
 * - payload read / inspect / mutate semantics
 * - payload repository IO behind ports
 *
 * Core does not own:
 * - cwd discovery
 * - prompts
 * - retry loops
 * - editor/viewer UI
 * - ANSI rendering
 * - CLI command parsing
 *
 * Naming:
 * - core names should describe semantic/internal operations
 * - example: `decryptPayload`
 */

/**
 * Package: @better-age/cli
 *
 * Layers:
 * - shell/commands
 *   maps argv to flows and core calls
 * - interaction/flows
 *   exact / guided / interactive-session orchestration
 * - presentation
 *   human message ids, formatting, styling
 * - ports
 *   prompt / editor / secure-viewer / cwd-discovery / terminal mode
 * - infra/*
 *   node TTY, prompt, editor, secure viewer, style renderer
 *
 * CLI owns:
 * - missing-arg resolution
 * - passphrase prompt timing and retry policy
 * - back / cancel / session loops
 * - choosing how to project decrypted payload data into view / inspect / load
 * - human stderr/stdout rendering
 *
 * Naming:
 * - CLI names should describe outside/user intent and command-local flows
 * - example: `runOpenPayloadContextFlow`
 */

/**
 * Package: @better-age/varlock
 *
 * Layers:
 * - plugin/runtime
 *   shells out to CLI load protocol and exposes varlock plugin surface
 *
 * Varlock owns:
 * - plugin init/runtime contract
 * - process spawning of `bage load`
 * - preserving inherited stdin/stderr for CLI prompts and human messages
 *
 * Varlock does not own:
 * - domain logic
 * - payload crypto
 * - artifact migration policy
 * - passphrase collection
 */

// ===========================================================================
// Shared primitives
// ===========================================================================

export type OwnerId = string;
export type PayloadId = string;
export type PayloadPath = string;
export type IdentityString = string;
export type IdentityReferenceInput = string;
export type DisplayName = string;
export type Handle = string;
export type LocalAlias = string;
export type KeyFingerprint = string;
export type EncryptedPrivateKeyRef = string;
export type Passphrase = string;
export type EnvText = string;
export type ProtocolVersion = string;
export type IsoUtcTimestamp = string;

export type CliInvocationMode = "exact" | "guided";

export type CliTerminalMode = "interactive" | "headless";

export interface CliExecutionContext {
	readonly invocationMode: CliInvocationMode;
	readonly terminalMode: CliTerminalMode;
}

export interface CliCommandRunContext {
	readonly execution: CliExecutionContext;
}

/**
 * Invocation exactness is about mandatory non-secret operands only.
 *
 * Examples:
 * - `bage grant <payload-path> <identity-ref>` is exact.
 * - `bage grant <payload-path>` is guided because `identity-ref` is missing.
 * - `bage grant` is guided because both mandatory operands are missing.
 *
 * Passphrase acquisition is not an operand-completeness signal.
 */
export type CliMandatoryOperandCompleteness = "complete" | "incomplete";

export type CliOperandClass = "promptable" | "protocol" | "secret";

export interface CliCommandContract {
	readonly command: BetterAgeTargetCliCommand;
	readonly promptableOperands: ReadonlyArray<string>;
	readonly protocolOperands: ReadonlyArray<string>;
	readonly secretPrompts: ReadonlyArray<string>;
	readonly stdoutContract:
		| "none"
		| "human-output"
		| "identity-string-only"
		| "raw-envText-only";
	readonly headlessBehavior:
		| "allowed"
		| "fail-missing-operand"
		| "fail-passphrase-unavailable"
		| "fail-interactive-unavailable";
}

export type CliCredentialAcquisition =
	| "prompt-if-interactive"
	| "fail-if-headless"
	| "not-required";

export interface CliPassphraseRetryPolicy {
	readonly maxAttempts: 3;
	readonly retryUi: "inline-prompt-loop";
	readonly exhaustedBehavior: "fail-with-passphrase-error";
}

export interface GuidedPayloadPathRecoveryPolicy {
	readonly appliesTo: "guided-payload-path-resolution";
	readonly readFailureBehavior: "return-to-path-picker";
	readonly preserveSuggestions: true;
	readonly allowCustomPathRetry: true;
	readonly exactInvocationBehavior: "exit-failure";
}

export type GrantRecipientPickerEntry =
	| {
			readonly kind: "self";
			readonly identity: PublicIdentitySnapshot;
			readonly localAlias: LocalAlias | null;
			readonly selectable: false;
			readonly marker: "you";
	  }
	| {
			readonly kind: "already-granted";
			readonly identity: PublicIdentitySnapshot;
			readonly localAlias: LocalAlias | null;
			readonly selectable: false;
			readonly marker: "granted";
	  }
	| {
			readonly kind: "grantable-known-identity";
			readonly identity: PublicIdentitySnapshot;
			readonly ownerId: OwnerId;
			readonly localAlias: LocalAlias | null;
			readonly selectable: true;
			readonly value: PublicIdentitySnapshot;
	  }
	| {
			readonly kind: "custom-identity-string";
			readonly selectable: true;
			readonly value: "parse-custom-identity-string";
	  };

export interface GrantRecipientPickerPolicy {
	readonly source: "self+known-identities+payload-recipients";
	readonly mergeKey: "ownerId";
	readonly localAliasBehavior: "render-overlay-only";
	readonly alreadyGrantedBehavior: "visible-disabled";
	readonly selfBehavior: "visible-disabled";
	readonly customIdentityStringBehavior: "selectable";
}

export interface PayloadRecipientDiscoveryPolicy {
	readonly knownIdentityBehavior: "silently-update-when-payload-snapshot-newer";
	readonly unknownIdentityBehavior: "transient-only-do-not-auto-import";
	readonly aliasPromptBehavior: "not-in-payload-command-flow";
	readonly futureImportFlowRequired: true;
}

export interface GrantRecipientIdempotencePolicy {
	readonly alreadyGrantedSameOrOlderBehavior: "success-unchanged";
	readonly newerSnapshotBehavior: "replace-recipient-snapshot-and-success-updated";
	readonly missingRecipientBehavior: "add-recipient-and-success-added";
}

export interface GrantSelfPolicy {
	readonly exactBehavior: "fail-CANNOT_GRANT_SELF";
	readonly guidedBehavior: "visible-disabled-you-marker";
}

export type RevokeRecipientPickerEntry =
	| {
			readonly kind: "self-recipient";
			readonly ownerId: OwnerId;
			readonly identity: PublicIdentitySnapshot;
			readonly localAlias: LocalAlias | null;
			readonly selectable: false;
			readonly marker: "you";
	  }
	| {
			readonly kind: "revokable-recipient";
			readonly ownerId: OwnerId;
			readonly identity: PublicIdentitySnapshot;
			readonly localAlias: LocalAlias | null;
			readonly selectable: true;
	  };

export interface RevokeRecipientPickerPolicy {
	readonly source: "payload-recipients-only";
	readonly localAliasBehavior: "render-overlay-only";
	readonly selfBehavior: "visible-disabled";
}

export interface RevokeRecipientPolicy {
	readonly selfBehavior: "fail-CANNOT_REVOKE_SELF";
	readonly notGrantedBehavior: "success-unchanged";
	readonly grantedBehavior: "remove-recipient-and-success-removed";
}

export interface UpdatePayloadPolicy {
	readonly allowedReasons: ReadonlyArray<PayloadUpdateReason>;
	readonly noReasonsBehavior: "success-unchanged";
	readonly reasonsBehavior: "rewrite-current-schema-and-self-recipient";
	readonly broaderRepairBehavior: "out-of-scope";
	readonly futurePrePersistVerifyRequired: true;
}

export interface OutdatedPayloadWriteGatePolicy {
	readonly appliesTo: readonly ["edit", "grant", "revoke"];
	readonly exactInteractiveBehavior: "fail-with-run-update-remediation";
	readonly guidedInteractiveBehavior: "gate-update-now-back-cancel";
	readonly headlessBehavior: "fail-fast-with-run-update-remediation";
	readonly updateNowBehavior: "run-update-and-resume-original-command";
}

export interface EditPayloadFlowPolicy {
	readonly editorCancelBehavior: "cancel-command";
	readonly identicalTextBehavior: "success-unchanged";
	readonly invalidEnvBehavior: "show-error-and-reopen-editor-with-edited-text";
	readonly validChangedTextBehavior: "rewrite-payload-and-success-edited";
}

export interface PayloadReadOutputPolicy {
	readonly viewBehavior: "secure-viewer-no-stdout-plaintext";
	readonly inspectBehavior: "metadata-env-key-names-recipients-no-values";
	readonly loadBehavior: "raw-envText-stdout-warnings-stderr";
	readonly readableOutdatedBehavior: "success-with-in-memory-migration-and-update-warning";
	readonly readPersistenceBehavior: "never-persist";
}

export interface CoreMutationStatelessnessPolicy {
	readonly openedPayloadUsage: "cli-ux-convenience-only";
	readonly mutationInputShape: "path-passphrase-and-command-specific-input";
	readonly openedPayloadAsMutationInput: "forbidden";
	readonly mutationBehavior: "reopen-and-revalidate";
	readonly doubleDecryptTradeoff: "accepted-for-simplicity-and-safety";
}

export interface IdentityImportFlowPolicy {
	readonly aliasPromptBehavior: "prompt-optional-alias-when-interactive";
	readonly aliasFlagBehavior: "optional-hard-fail-invalid-or-duplicate";
	readonly emptyAliasOnNewIdentityBehavior: "no-alias";
	readonly emptyAliasOnExistingIdentityBehavior: "keep-existing-alias";
	readonly invalidAliasPromptBehavior: "show-error-and-retry";
	readonly duplicateAliasPromptBehavior: "show-error-and-retry";
	readonly selfBehavior: "fail-CANNOT_IMPORT_SELF";
	readonly unknownBehavior: "add-known-identity";
	readonly knownNewerBehavior: "update-known-identity";
	readonly knownSameOrOlderBehavior: "success-unchanged-or-alias-updated";
	readonly payloadMutationBehavior: "never";
}

export interface IdentityForgetFlowPolicy {
	readonly exactNotFoundBehavior: "fail-IDENTITY_REFERENCE_NOT_FOUND";
	readonly guidedPickerSource: "known-identities-only";
	readonly payloadMutationBehavior: "never";
	readonly aliasBehavior: "remove-local-alias-with-known-identity";
}

export interface IdentityListOutputPolicy {
	readonly sections: readonly ["self", "known-identities", "retired-keys"];
	readonly coreQueryComposition: "getSelfIdentity+listKnownIdentities+listRetiredKeys";
	readonly aggregateQueryBehavior: "optional-convenience-over-primitives";
	readonly privateKeyMaterialBehavior: "never-render";
	readonly passphraseBehavior: "not-required";
	readonly payloadAccessBehavior: "never";
	readonly headlessBehavior: "allowed";
	readonly missingSetupBehavior: "fail-HOME_STATE_NOT_FOUND-with-setup-remediation";
}

export interface IdentityExportOutputPolicy {
	readonly stdoutBehavior: "identity-string-only-unstyled";
	readonly stderrBehavior: "warnings-notices-only";
	readonly headlessBehavior: "allowed";
	readonly passphraseBehavior: "not-required";
	readonly missingSetupBehavior: "fail-HOME_STATE_NOT_FOUND-with-setup-remediation";
	readonly exportedIdentity: "current-public-identity-only";
	readonly retiredKeysBehavior: "never-export";
}

export interface IdentityRotateFlowPolicy {
	readonly ownerIdBehavior: "preserve";
	readonly oldKeyBehavior: "move-to-retired-keys";
	readonly selfPublicIdentityBehavior: "replace-current-key-snapshot";
	readonly payloadMutationBehavior: "never";
	readonly passphraseBehavior: "required-with-standard-retry";
	readonly headlessBehavior: "fail-passphrase-unavailable";
	readonly remediationBehavior: "tell-user-to-run-update-for-stale-self-recipient-payloads";
}

export interface IdentityPassphraseFlowPolicy {
	readonly credentialCheck: "decrypt-current-private-key";
	readonly currentPassphraseRetry: "standard-3-attempt-inline-retry";
	readonly newPassphraseConfirmationBehavior: "retry-pair-on-mismatch";
	readonly reencryptScope: "current-and-retired-private-keys";
	readonly persistedResult: "all-local-private-key-material-uses-new-passphrase";
	readonly headlessBehavior: "fail-passphrase-unavailable";
}

export interface SetupFlowPolicy {
	readonly displayNameInput: "name-option-or-guided-prompt";
	readonly positionalDisplayNameBehavior: "not-supported";
	readonly exactRequirement: "require-name-option";
	readonly headlessRequirement: "require-name-option-then-fail-passphrase-unavailable";
	readonly alreadyConfiguredBehavior: "fail-SETUP_ALREADY_CONFIGURED";
	readonly passphraseConfirmationBehavior: "retry-pair-on-mismatch";
	readonly persistedResult: "create-self-identity-and-encrypted-current-private-key";
}

export type PayloadContentCommand =
	| "inspect"
	| "view"
	| "edit"
	| "grant"
	| "revoke"
	| "update"
	| "load";

export type PayloadCreationCommand = "create";

export type PayloadCommandOpenPolicy =
	| {
			readonly command: PayloadContentCommand;
			readonly existingPayloadRead: "open-and-decrypt-early";
			readonly credentialAcquisition:
				| "prompt-if-interactive"
				| "fail-if-headless";
	  }
	| {
			readonly command: PayloadCreationCommand;
			readonly existingPayloadRead: "never";
			readonly credentialAcquisition:
				| "prompt-if-interactive"
				| "fail-if-headless";
	  };

export type LoadExecutionRequirement = {
	readonly outputContract: "machine-stdout";
	readonly credentialRequirement: "interactive-passphrase-required";
	readonly headlessBehavior: "fail-fast-with-passphrase-unavailable";
};

export interface CliMandatoryOperandTable {
	readonly setup: readonly ["--name for exact/headless"];
	readonly create: readonly ["path"];
	readonly edit: readonly ["path"];
	readonly grant: readonly ["path", "identity-ref"];
	readonly inspect: readonly ["path"];
	readonly load: readonly ["path", "--protocol-version"];
	readonly revoke: readonly ["path", "identity-ref"];
	readonly update: readonly ["path"];
	readonly view: readonly ["path"];
	readonly identityExport: readonly [];
	readonly identityImport: readonly ["identity-string"];
	readonly identityForget: readonly ["identity-ref"];
	readonly identityList: readonly [];
	readonly identityPassphrase: readonly [];
	readonly identityRotate: readonly [];
	readonly interactive: readonly [];
}

export interface HeadlessCredentialPolicy {
	readonly credentialRequiredCommands: readonly [
		"setup",
		"create",
		"edit",
		"grant",
		"inspect",
		"load",
		"revoke",
		"update",
		"view",
		"identity passphrase",
		"identity rotate",
	];
	readonly allowedHeadlessCommands: readonly [
		"identity export",
		"identity import",
		"identity forget",
		"identity list",
	];
	readonly validationOrder: "missing-operands-before-passphrase-unavailable";
	readonly noPromptBehavior: true;
	readonly noDecryptBehavior: true;
	readonly noMutationBehavior: true;
}

export interface InteractiveSessionPolicy {
	readonly aliases: readonly ["i"];
	readonly headlessBehavior: "fail-INTERACTIVE_UNAVAILABLE";
	readonly ownership: "cli-only";
	readonly routing: "same-command-flows-as-direct-commands";
	readonly backBehavior: "previous-menu";
	readonly cancelBehavior: "exit-session";
}

/**
 * CLI execution policy is exactly two-axis.
 *
 * Do not add core concerns here.
 * This policy controls shell behavior only: prompts, chooser flows, fail-fast
 * behavior, and back/cancel availability.
 */
export type CliExecutionPolicy =
	| {
			readonly invocationMode: "exact";
			readonly terminalMode: "interactive";
			readonly missingOperandBehavior: "not-applicable";
			readonly chooserBehavior: "forbidden-for-explicit-operands";
			readonly passphrasePromptBehavior: "allowed";
			readonly credentialAcquisition: "prompt-if-interactive";
			readonly backCancelBehavior: "local-only-where-flow-has-parent";
	  }
	| {
			readonly invocationMode: "exact";
			readonly terminalMode: "headless";
			readonly missingOperandBehavior: "not-applicable";
			readonly chooserBehavior: "forbidden";
			readonly passphrasePromptBehavior: "forbidden";
			readonly credentialAcquisition: "fail-if-headless";
			readonly backCancelBehavior: "unavailable";
	  }
	| {
			readonly invocationMode: "guided";
			readonly terminalMode: "interactive";
			readonly missingOperandBehavior: "resolve-through-cli-flow";
			readonly chooserBehavior: "allowed";
			readonly passphrasePromptBehavior: "allowed";
			readonly credentialAcquisition: "prompt-if-interactive";
			readonly backCancelBehavior: "available";
	  }
	| {
			readonly invocationMode: "guided";
			readonly terminalMode: "headless";
			readonly missingOperandBehavior: "fail-fast";
			readonly chooserBehavior: "forbidden";
			readonly passphrasePromptBehavior: "forbidden";
			readonly credentialAcquisition: "fail-if-headless";
			readonly backCancelBehavior: "unavailable";
	  };

export type RotationTtl = "1w" | "1m" | "3m" | "6m" | "9m" | "1y";

export type PayloadCompatibilityState = "up-to-date" | "readable-but-outdated";

export type PayloadUpdateReason =
	| "payload-format-migration"
	| "self-recipient-refresh";

// ===========================================================================
// Canonical domain shapes
// ===========================================================================

/**
 * Canonical shared public identity shape.
 * Identity strings, payload recipients, known identities, and self public core
 * all map to this shape.
 */
export interface PublicIdentitySnapshot {
	readonly ownerId: OwnerId;
	readonly publicKey: string;
	readonly displayName: DisplayName;
	readonly identityUpdatedAt: IsoUtcTimestamp;
}

/**
 * Home-local resolved known identity.
 * Adds only derived and local overlay fields.
 */
export interface KnownIdentitySummary {
	readonly ownerId: OwnerId;
	readonly publicIdentity: PublicIdentitySnapshot;
	readonly handle: Handle;
	readonly fingerprint: KeyFingerprint;
	readonly localAlias: LocalAlias | null;
}

/**
 * Self identity read model for core queries.
 * Still avoids exposing encrypted private key contents.
 */
export interface SelfIdentitySummary {
	readonly ownerId: OwnerId;
	readonly publicIdentity: PublicIdentitySnapshot;
	readonly handle: Handle;
	readonly fingerprint: KeyFingerprint;
	readonly keyMode: "pq-hybrid";
	readonly createdAt: IsoUtcTimestamp;
	readonly rotationTtl: RotationTtl;
	readonly rotationDueAt: IsoUtcTimestamp;
	readonly rotationIsOverdue: boolean;
}

export interface RetiredKeySummary {
	readonly fingerprint: KeyFingerprint;
	readonly retiredAt: IsoUtcTimestamp;
}

export interface PayloadRecipientSummary {
	readonly ownerId: OwnerId;
	readonly displayName: DisplayName;
	readonly handle: Handle;
	readonly fingerprint: KeyFingerprint;
	readonly localAlias: LocalAlias | null;
	readonly isSelf: boolean;
	readonly isStaleSelf: boolean;
}

export interface DecryptedPayload {
	readonly path: PayloadPath;
	readonly payloadId: PayloadId;
	readonly createdAt: IsoUtcTimestamp;
	readonly lastRewrittenAt: IsoUtcTimestamp;
	readonly schemaVersion: number;
	readonly compatibility: PayloadCompatibilityState;
	readonly envText: EnvText;
	readonly envKeys: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<PayloadRecipientSummary>;
}

// ===========================================================================
// Persistence document shapes
// ===========================================================================

export type BetterAgeArtifactKind =
	| "better-age/home-state"
	| "better-age/private-key"
	| "better-age/payload"
	| "better-age/public-identity";

export type ArtifactVersion = 1;

export interface HomeStateDocumentV1 {
	readonly kind: "better-age/home-state";
	readonly version: 1;
	readonly ownerId: OwnerId;
	readonly displayName: DisplayName;
	readonly identityUpdatedAt: IsoUtcTimestamp;
	readonly currentKey: {
		readonly publicKey: string;
		readonly fingerprint: KeyFingerprint;
		readonly encryptedPrivateKeyRef: EncryptedPrivateKeyRef;
		readonly createdAt: IsoUtcTimestamp;
	};
	readonly retiredKeys: ReadonlyArray<{
		readonly publicKey: string;
		readonly fingerprint: KeyFingerprint;
		readonly encryptedPrivateKeyRef: EncryptedPrivateKeyRef;
		readonly createdAt: IsoUtcTimestamp;
		readonly retiredAt: IsoUtcTimestamp;
	}>;
	readonly knownIdentities: ReadonlyArray<{
		readonly ownerId: OwnerId;
		readonly publicKey: string;
		readonly displayName: DisplayName;
		readonly identityUpdatedAt: IsoUtcTimestamp;
		readonly localAlias: LocalAlias | null;
	}>;
	readonly preferences: {
		readonly rotationTtl: RotationTtl;
	};
}

export type HomeStateDocument = HomeStateDocumentV1;

export interface PrivateKeyPlaintextV1 {
	readonly kind: "better-age/private-key";
	readonly version: 1;
	readonly ownerId: OwnerId;
	readonly publicKey: string;
	readonly privateKey: string;
	readonly fingerprint: KeyFingerprint;
	readonly createdAt: IsoUtcTimestamp;
}

export type PrivateKeyPlaintext = PrivateKeyPlaintextV1;

export interface PayloadPlaintextV1 {
	readonly kind: "better-age/payload";
	readonly version: 1;
	readonly payloadId: PayloadId;
	readonly createdAt: IsoUtcTimestamp;
	readonly lastRewrittenAt: IsoUtcTimestamp;
	readonly envText: EnvText;
	readonly recipients: ReadonlyArray<PublicIdentitySnapshot>;
}

export type PayloadPlaintext = PayloadPlaintextV1;

export interface PayloadDocumentV1 {
	readonly kind: "better-age/payload";
	readonly version: 1;
	readonly encryptedPayload: string;
}

export type PayloadDocument = PayloadDocumentV1;

export interface PublicIdentityStringV1 {
	readonly kind: "better-age/public-identity";
	readonly version: 1;
	readonly ownerId: OwnerId;
	readonly displayName: DisplayName;
	readonly publicKey: string;
	readonly identityUpdatedAt: IsoUtcTimestamp;
}

export type PublicIdentityDocument = PublicIdentityStringV1;

export type MigrationResult<TCurrent> =
	| {
			readonly kind: "already-current";
			readonly document: TCurrent;
	  }
	| {
			readonly kind: "migrated";
			readonly document: TCurrent;
			readonly fromVersion: number;
			readonly toVersion: number;
	  };

// ===========================================================================
// Core result / error / notice model
// ===========================================================================

export interface CoreSuccess<TCode extends string, TValue> {
	readonly kind: "success";
	readonly code: TCode;
	readonly value: TValue;
}

export interface CoreFailure<TCode extends string, TDetails = undefined> {
	readonly kind: "failure";
	readonly code: TCode;
	readonly details: TDetails;
}

export type CoreResult<
	TSuccessCode extends string,
	TValue,
	TErrorCode extends string,
	TErrorDetails = undefined,
> = CoreSuccess<TSuccessCode, TValue> | CoreFailure<TErrorCode, TErrorDetails>;

export type CoreNoticeLevel = "info" | "warning";

export interface CoreNoticeBase<TCode extends string, TDetails> {
	readonly level: CoreNoticeLevel;
	readonly code: TCode;
	readonly details: TDetails;
}

/**
 * Notices are semantic side information.
 *
 * They are not generic logs.
 * They exist only when they affect user-visible or machine-visible behavior.
 */
export type BetterAgeCoreNotice =
	| CoreNoticeBase<
			"HOME_STATE_MIGRATED",
			{
				readonly fromVersion: number;
				readonly toVersion: number;
			}
	  >
	| CoreNoticeBase<
			"PAYLOAD_READ_USED_IN_MEMORY_MIGRATION",
			{
				readonly path: PayloadPath;
				readonly fromVersion: number;
				readonly toVersion: number;
			}
	  >
	| CoreNoticeBase<
			"PAYLOAD_UPDATE_RECOMMENDED",
			{
				readonly path: PayloadPath;
				readonly reasons: ReadonlyArray<PayloadUpdateReason>;
			}
	  >;

export interface CoreResponse<
	TResult,
	TNotice extends BetterAgeCoreNotice = never,
> {
	readonly result: TResult;
	readonly notices: ReadonlyArray<TNotice>;
}

export type CoreMethodResult<
	TResult,
	TNotice extends BetterAgeCoreNotice = never,
> = Promise<CoreResponse<TResult, TNotice>>;

// ===========================================================================
// Shared error detail shapes
// ===========================================================================

export type IdentityReferenceResolutionScope =
	| "known-identities"
	| "payload-recipients"
	| "known-and-payload-recipients";

export interface AmbiguousIdentityReferenceDetails {
	readonly reference: IdentityReferenceInput;
	readonly scope: IdentityReferenceResolutionScope;
	readonly candidates: ReadonlyArray<IdentityReferenceCandidate>;
}

export interface IdentityReferenceNotFoundDetails {
	readonly reference: IdentityReferenceInput;
	readonly scope: IdentityReferenceResolutionScope;
}

export type IdentityReferenceCandidate =
	| {
			readonly kind: "known-identity";
			readonly identity: KnownIdentitySummary;
	  }
	| {
			readonly kind: "payload-recipient";
			readonly recipient: PayloadRecipientSummary;
	  };

export interface KnownIdentityConflictDetails {
	readonly ownerId: OwnerId;
}

export interface PayloadMutationBlockedDetails {
	readonly path: PayloadPath;
	readonly reasons: ReadonlyArray<PayloadUpdateReason>;
}

export interface VersionCompatibilityDetails {
	readonly artifactVersion?: number;
	readonly currentVersion?: number;
}

// ===========================================================================
// Core error code groups
// ===========================================================================

export type HomeReadErrorCode =
	| "HOME_STATE_NOT_FOUND"
	| "HOME_STATE_READ_FAILED"
	| "HOME_STATE_INVALID"
	| HomeCompatibilityErrorCode;

export type HomeSetupProbeErrorCode = Exclude<
	HomeReadErrorCode,
	"HOME_STATE_NOT_FOUND"
>;

export type HomeWriteErrorCode = "HOME_STATE_WRITE_FAILED";

export type HomeCompatibilityErrorCode =
	| "HOME_STATE_CLI_TOO_OLD"
	| "HOME_STATE_MIGRATION_PATH_MISSING"
	| "HOME_STATE_MIGRATION_HARD_BROKEN";

export type PayloadRepositoryErrorCode =
	| "PAYLOAD_NOT_FOUND"
	| "PAYLOAD_READ_FAILED"
	| "PAYLOAD_WRITE_FAILED"
	| "PAYLOAD_ALREADY_EXISTS";

export type PayloadReadRepositoryErrorCode =
	| "PAYLOAD_NOT_FOUND"
	| "PAYLOAD_READ_FAILED";

export type PayloadCreateRepositoryErrorCode =
	| "PAYLOAD_ALREADY_EXISTS"
	| "PAYLOAD_WRITE_FAILED";

export type PayloadMutationRepositoryErrorCode =
	| "PAYLOAD_NOT_FOUND"
	| "PAYLOAD_READ_FAILED"
	| "PAYLOAD_WRITE_FAILED";

export type PayloadContentErrorCode = "PAYLOAD_INVALID" | "PAYLOAD_ENV_INVALID";

export type PayloadCompatibilityErrorCode =
	| "PAYLOAD_CLI_TOO_OLD"
	| "PAYLOAD_MIGRATION_PATH_MISSING"
	| "PAYLOAD_MIGRATION_HARD_BROKEN";

export type PayloadSecretErrorCode =
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_DECRYPT_FAILED"
	| "PAYLOAD_ACCESS_DENIED"
	| "PAYLOAD_DECRYPT_FAILED";

export type IdentityParseErrorCode = "IDENTITY_STRING_INVALID";

export type IdentityReferenceResolutionErrorCode =
	| "IDENTITY_REFERENCE_NOT_FOUND"
	| "IDENTITY_REFERENCE_AMBIGUOUS";

// ===========================================================================
// @better-age/core :: app/ports
// ===========================================================================

/**
 * Path-based repository ports stay in core.
 * CLI may discover candidate paths from cwd, but once an exact path is chosen,
 * core owns reading/writing through these ports.
 */

export interface HomeRepositoryPort {
	loadHomeStateDocument(): Promise<unknown | null>;
	saveCurrentHomeStateDocument(document: HomeStateDocument): Promise<void>;
	readEncryptedPrivateKey(ref: EncryptedPrivateKeyRef): Promise<string>;
	writeEncryptedPrivateKey(input: {
		readonly ref: EncryptedPrivateKeyRef;
		readonly encryptedKey: string;
	}): Promise<void>;
	getLocation(): Promise<{
		readonly homeDir: string;
		readonly stateFile: string;
	}>;
}

export interface PayloadRepositoryPort {
	readPayloadFile(path: PayloadPath): Promise<string>;
	writePayloadFile(path: PayloadPath, contents: string): Promise<void>;
	payloadExists(path: PayloadPath): Promise<boolean>;
}

export interface PayloadCryptoPort {
	encryptPayload(input: {
		readonly plaintext: PayloadPlaintext;
		readonly recipients: ReadonlyArray<string>;
	}): Promise<string>;

	decryptPayload(input: {
		readonly armoredPayload: string;
		readonly privateKeys: ReadonlyArray<PrivateKeyPlaintext>;
	}): Promise<unknown>;
}

export interface IdentityCryptoPort {
	generatePrivateKey(input: {
		readonly ownerId: OwnerId;
		readonly createdAt: IsoUtcTimestamp;
	}): Promise<PrivateKeyPlaintext>;

	protectPrivateKey(input: {
		readonly privateKey: PrivateKeyPlaintext;
		readonly passphrase: Passphrase;
	}): Promise<string>;

	decryptPrivateKey(input: {
		readonly encryptedKey: string;
		readonly passphrase: Passphrase;
	}): Promise<PrivateKeyPlaintext>;
}

export interface ClockPort {
	now(): Promise<IsoUtcTimestamp>;
}

export interface RandomIdsPort {
	nextOwnerId(): Promise<OwnerId>;
	nextPayloadId(): Promise<PayloadId>;
}

// ===========================================================================
// @better-age/core :: app/lifecycle
// ===========================================================================

export type RunHomeStatePreflightErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode;

export interface BetterAgeCoreLifecycle {
	runHomeStatePreflight(): CoreMethodResult<
		CoreResult<
			"HOME_STATE_PREFLIGHT_COMPLETED",
			{
				readonly status: "already-current" | "migrated";
			},
			RunHomeStatePreflightErrorCode,
			VersionCompatibilityDetails | undefined
		>,
		BetterAgeCoreNotice
	>;
}

// ===========================================================================
// @better-age/core :: app/queries
// ===========================================================================

export type GetSelfIdentityErrorCode = HomeReadErrorCode;

export type ListKnownIdentitiesErrorCode = HomeReadErrorCode;

export type ListRetiredKeysErrorCode = HomeReadErrorCode;

export type ExportSelfIdentityStringErrorCode = HomeReadErrorCode;

export type VerifySelfIdentityPassphraseErrorCode =
	| HomeReadErrorCode
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_DECRYPT_FAILED";

export type ParseIdentityStringErrorCode = IdentityParseErrorCode;

export type ResolveKnownIdentityErrorCode =
	| HomeReadErrorCode
	| IdentityReferenceResolutionErrorCode;

export type ResolvePayloadRecipientErrorCode =
	IdentityReferenceResolutionErrorCode;

export type ResolveGrantRecipientErrorCode =
	| HomeReadErrorCode
	| IdentityParseErrorCode
	| IdentityReferenceResolutionErrorCode;

export type DecryptPayloadErrorCode =
	| PayloadReadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode;

export interface BetterAgeCoreQueries {
	getSelfIdentity(): CoreMethodResult<
		CoreResult<
			"SELF_IDENTITY_FOUND",
			SelfIdentitySummary,
			GetSelfIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	listKnownIdentities(): CoreMethodResult<
		CoreResult<
			"KNOWN_IDENTITIES_LISTED",
			ReadonlyArray<KnownIdentitySummary>,
			ListKnownIdentitiesErrorCode
		>,
		BetterAgeCoreNotice
	>;

	listRetiredKeys(): CoreMethodResult<
		CoreResult<
			"RETIRED_KEYS_LISTED",
			ReadonlyArray<RetiredKeySummary>,
			ListRetiredKeysErrorCode
		>,
		BetterAgeCoreNotice
	>;

	exportSelfIdentityString(): CoreMethodResult<
		CoreResult<
			"SELF_IDENTITY_STRING_EXPORTED",
			{
				readonly identityString: IdentityString;
				readonly publicIdentity: PublicIdentitySnapshot;
				readonly handle: Handle;
			},
			ExportSelfIdentityStringErrorCode
		>,
		BetterAgeCoreNotice
	>;

	verifySelfIdentityPassphrase(input: {
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"PASSPHRASE_VERIFIED",
			{
				readonly ownerId: OwnerId;
			},
			VerifySelfIdentityPassphraseErrorCode
		>,
		BetterAgeCoreNotice
	>;

	parseIdentityString(input: {
		readonly identityString: IdentityString;
	}): CoreMethodResult<
		CoreResult<
			"IDENTITY_STRING_PARSED",
			PublicIdentitySnapshot,
			ParseIdentityStringErrorCode
		>
	>;

	resolveKnownIdentity(input: {
		readonly reference: IdentityReferenceInput;
	}): CoreMethodResult<
		CoreResult<
			"KNOWN_IDENTITY_RESOLVED",
			KnownIdentitySummary,
			ResolveKnownIdentityErrorCode,
			| IdentityReferenceNotFoundDetails
			| AmbiguousIdentityReferenceDetails
			| undefined
		>,
		BetterAgeCoreNotice
	>;

	resolvePayloadRecipient(input: {
		readonly reference: IdentityReferenceInput;
		readonly recipients: ReadonlyArray<PayloadRecipientSummary>;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_RECIPIENT_RESOLVED",
			PayloadRecipientSummary,
			ResolvePayloadRecipientErrorCode,
			| IdentityReferenceNotFoundDetails
			| AmbiguousIdentityReferenceDetails
			| undefined
		>
	>;

	resolveGrantRecipient(input: {
		readonly reference: IdentityReferenceInput;
		readonly payloadRecipients: ReadonlyArray<PayloadRecipientSummary>;
	}): CoreMethodResult<
		CoreResult<
			"GRANT_RECIPIENT_RESOLVED",
			PublicIdentitySnapshot,
			ResolveGrantRecipientErrorCode,
			| IdentityReferenceNotFoundDetails
			| AmbiguousIdentityReferenceDetails
			| undefined
		>,
		BetterAgeCoreNotice
	>;

	decryptPayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<"PAYLOAD_DECRYPTED", DecryptedPayload, DecryptPayloadErrorCode>,
		BetterAgeCoreNotice
	>;
}

// ===========================================================================
// @better-age/core :: app/commands
// ===========================================================================

export type CreateSelfIdentityErrorCode =
	| HomeSetupProbeErrorCode
	| HomeWriteErrorCode
	| "SETUP_NAME_INVALID"
	| "SETUP_ALREADY_CONFIGURED"
	| "KEY_GENERATION_FAILED"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type ImportKnownIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| IdentityParseErrorCode
	| "CANNOT_IMPORT_SELF_IDENTITY"
	| "KNOWN_IDENTITY_CONFLICT"
	| "LOCAL_ALIAS_INVALID"
	| "LOCAL_ALIAS_DUPLICATE";

export type ForgetKnownIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "IDENTITY_REFERENCE_NOT_FOUND"
	| "CANNOT_FORGET_SELF_IDENTITY";

export type ChangePassphraseErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_DECRYPT_FAILED"
	| "PRIVATE_KEY_REENCRYPT_FAILED"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type RotateSelfIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_DECRYPT_FAILED"
	| "KEY_GENERATION_FAILED"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type CreatePayloadErrorCode =
	| HomeReadErrorCode
	| PayloadCreateRepositoryErrorCode
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_DECRYPT_FAILED"
	| "PAYLOAD_ENCRYPT_FAILED";

export type EditPayloadErrorCode =
	| PayloadMutationRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED";

export type GrantPayloadRecipientErrorCode =
	| PayloadMutationRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED"
	| "CANNOT_GRANT_SELF"
	| "PAYLOAD_ENCRYPT_FAILED";

export type RevokePayloadRecipientErrorCode =
	| PayloadMutationRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED"
	| "CANNOT_REVOKE_SELF"
	| "PAYLOAD_ENCRYPT_FAILED";

export type UpdatePayloadErrorCode =
	| PayloadMutationRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_ENCRYPT_FAILED";

/**
 * Command-side identity targets stay exact.
 *
 * Flexible references never cross this boundary.
 * The CLI must call query-side resolution/parsing first, then pass the exact
 * public identity snapshot to the payload mutation.
 */
export interface BetterAgeCoreCommands {
	createSelfIdentity(input: {
		readonly displayName: DisplayName;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"SELF_IDENTITY_CREATED",
			{
				readonly ownerId: OwnerId;
				readonly handle: Handle;
			},
			CreateSelfIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	importKnownIdentity(input: {
		readonly identityString: IdentityString;
		readonly localAlias?: LocalAlias | null;
	}): CoreMethodResult<
		CoreResult<
			"KNOWN_IDENTITY_IMPORTED",
			{
				readonly ownerId: OwnerId;
				readonly handle: Handle;
				readonly outcome: "added" | "updated" | "unchanged" | "alias-updated";
			},
			ImportKnownIdentityErrorCode,
			KnownIdentityConflictDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	forgetKnownIdentity(input: { readonly ownerId: OwnerId }): CoreMethodResult<
		CoreResult<
			"KNOWN_IDENTITY_FORGOTTEN",
			{
				readonly ownerId: OwnerId;
				readonly outcome: "removed";
			},
			ForgetKnownIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	changeIdentityPassphrase(input: {
		readonly currentPassphrase: Passphrase;
		readonly nextPassphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"PASSPHRASE_CHANGED",
			{
				readonly ownerId: OwnerId;
			},
			ChangePassphraseErrorCode
		>,
		BetterAgeCoreNotice
	>;

	rotateSelfIdentity(input: {
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"SELF_IDENTITY_ROTATED",
			{
				readonly ownerId: OwnerId;
				readonly nextFingerprint: KeyFingerprint;
			},
			RotateSelfIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	createPayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_CREATED",
			{
				readonly path: PayloadPath;
				readonly payloadId: PayloadId;
			},
			CreatePayloadErrorCode
		>,
		BetterAgeCoreNotice
	>;

	editPayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly editedEnvText: EnvText;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_EDITED",
			{
				readonly path: PayloadPath;
				readonly payloadId: PayloadId;
				readonly outcome: "edited" | "unchanged";
			},
			EditPayloadErrorCode,
			PayloadMutationBlockedDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	grantPayloadRecipient(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly recipient: PublicIdentitySnapshot;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_RECIPIENT_GRANTED",
			{
				readonly path: PayloadPath;
				readonly payloadId: PayloadId;
				readonly recipient: PublicIdentitySnapshot;
				readonly outcome: "added" | "updated" | "unchanged";
				readonly unchangedReason?: "already-granted" | "outdated-input";
			},
			GrantPayloadRecipientErrorCode,
			PayloadMutationBlockedDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	revokePayloadRecipient(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly recipientOwnerId: OwnerId;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_RECIPIENT_REVOKED",
			{
				readonly path: PayloadPath;
				readonly payloadId: PayloadId;
				readonly recipientOwnerId: OwnerId;
				readonly outcome: "removed" | "unchanged";
				readonly unchangedReason?: "recipient-not-granted";
			},
			RevokePayloadRecipientErrorCode,
			PayloadMutationBlockedDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	updatePayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_UPDATED",
			{
				readonly path: PayloadPath;
				readonly payloadId: PayloadId;
				readonly outcome: "updated" | "unchanged";
				readonly rewriteReasons: ReadonlyArray<PayloadUpdateReason>;
			},
			UpdatePayloadErrorCode
		>,
		BetterAgeCoreNotice
	>;
}

export interface BetterAgeCoreApi {
	readonly lifecycle: BetterAgeCoreLifecycle;
	readonly queries: BetterAgeCoreQueries;
	readonly commands: BetterAgeCoreCommands;
}

// ===========================================================================
// @better-age/cli :: ports
// ===========================================================================

/**
 * CLI-only shell convenience.
 * This never moves into core.
 */
export interface CwdPayloadDiscoveryPort {
	discoverPayloadPathsFromCwd(): Promise<
		ReadonlyArray<{
			readonly path: PayloadPath;
		}>
	>;
}

export interface CliTerminalModePort {
	getTerminalMode(): Promise<CliTerminalMode>;
}

export interface PromptPort {
	inputText(input: {
		readonly label: string;
		readonly defaultValue?: string;
	}): Promise<string>;

	inputSecret(input: { readonly label: string }): Promise<Passphrase>;

	selectOne<T>(input: {
		readonly label: string;
		readonly options: ReadonlyArray<{
			readonly label: string;
			readonly value: T;
			readonly hint?: string;
		}>;
	}): Promise<T>;
}

export interface EditorPort {
	edit(input: { readonly initialText: EnvText }): Promise<{
		readonly editedText: EnvText;
		readonly outcome: "saved" | "cancelled";
	}>;
}

export interface SecureViewerPort {
	view(input: {
		readonly path: PayloadPath;
		readonly envText: EnvText;
	}): Promise<void>;
}

// ===========================================================================
// @better-age/cli :: presentation
// ===========================================================================

export type CliHumanMessageKind =
	| "error"
	| "warning"
	| "info"
	| "success"
	| "hint";

export type CliErrorMessageId =
	| "ERR.SETUP.NAME_MISSING"
	| "ERR.SETUP.NAME_INVALID"
	| "ERR.SETUP.REQUIRED"
	| "ERR.SETUP.ALREADY_CONFIGURED"
	| "ERR.HOME.READ_FAILED"
	| "ERR.HOME.WRITE_FAILED"
	| "ERR.HOME.PRIVATE_KEY_DECRYPT_FAILED"
	| "ERR.HOME.PRIVATE_KEY_PROTECTION_FAILED"
	| "ERR.HOME.PRIVATE_KEY_REENCRYPT_FAILED"
	| "ERR.HOME.CLI_TOO_OLD"
	| "ERR.HOME.MIGRATION_PATH_MISSING"
	| "ERR.HOME.MIGRATION_HARD_BROKEN"
	| "ERR.HOME.STATE_INVALID"
	| "ERR.IDENTITY.STRING_MISSING"
	| "ERR.IDENTITY.STRING_INVALID"
	| "ERR.IDENTITY.REFERENCE_MISSING"
	| "ERR.IDENTITY.NOT_FOUND"
	| "ERR.IDENTITY.AMBIGUOUS"
	| "ERR.IDENTITY.ALIAS_INVALID"
	| "ERR.IDENTITY.ALIAS_DUPLICATE"
	| "ERR.IDENTITY.CANNOT_IMPORT_SELF"
	| "ERR.IDENTITY.CONFLICT"
	| "ERR.IDENTITY.CANNOT_FORGET_SELF"
	| "ERR.IDENTITY.KEY_GENERATION_FAILED"
	| "ERR.PASSPHRASE.INCORRECT"
	| "ERR.PASSPHRASE.UNAVAILABLE"
	| "ERR.PASSPHRASE.CONFIRMATION_MISMATCH"
	| "ERR.PAYLOAD.PATH_MISSING"
	| "ERR.PAYLOAD.NOT_FOUND"
	| "ERR.PAYLOAD.ALREADY_EXISTS"
	| "ERR.PAYLOAD.READ_FAILED"
	| "ERR.PAYLOAD.WRITE_FAILED"
	| "ERR.PAYLOAD.INVALID"
	| "ERR.PAYLOAD.ENV_INVALID"
	| "ERR.PAYLOAD.ENCRYPT_FAILED"
	| "ERR.PAYLOAD.DECRYPT_FAILED"
	| "ERR.PAYLOAD.ACCESS_DENIED"
	| "ERR.PAYLOAD.CLI_TOO_OLD"
	| "ERR.PAYLOAD.MIGRATION_PATH_MISSING"
	| "ERR.PAYLOAD.MIGRATION_HARD_BROKEN"
	| "ERR.PAYLOAD.UPDATE_REQUIRED"
	| "ERR.GRANT.CANNOT_GRANT_SELF"
	| "ERR.REVOKE.CANNOT_REVOKE_SELF"
	| "ERR.LOAD.PROTOCOL_REQUIRED"
	| "ERR.LOAD.PROTOCOL_UNSUPPORTED"
	| "ERR.PROMPT.UNAVAILABLE"
	| "ERR.INTERACTIVE.UNAVAILABLE"
	| "ERR.EDITOR.UNAVAILABLE"
	| "ERR.EDITOR.LAUNCH_FAILED"
	| "ERR.EDITOR.EXIT_NON_ZERO"
	| "ERR.EDITOR.TEMP_FILE_CREATE_FAILED"
	| "ERR.EDITOR.TEMP_FILE_READ_FAILED"
	| "ERR.VIEWER.UNAVAILABLE"
	| "ERR.VIEWER.RENDER_FAILED"
	| "ERR.INTERNAL.DEFECT";

export type CliWarningMessageId =
	| "WARN.PAYLOAD.UPDATE_RECOMMENDED"
	| "WARN.IDENTITY.SELF_RECIPIENT_STALE_AFTER_ROTATE";

export type CliInfoMessageId =
	| "INFO.HOME.STATE_MIGRATED"
	| "INFO.PAYLOAD.READ_USED_IN_MEMORY_MIGRATION";

export type CliSuccessMessageId =
	| "SUCCESS.SETUP.COMPLETE"
	| "SUCCESS.IDENTITY.IMPORT"
	| "SUCCESS.IDENTITY.FORGET"
	| "SUCCESS.IDENTITY.PASSPHRASE"
	| "SUCCESS.IDENTITY.ROTATE"
	| "SUCCESS.PAYLOAD.CREATE"
	| "SUCCESS.PAYLOAD.EDIT"
	| "SUCCESS.PAYLOAD.GRANT"
	| "SUCCESS.PAYLOAD.REVOKE"
	| "SUCCESS.PAYLOAD.UPDATE";

export type CliHintMessageId =
	| "HINT.RUN_SETUP"
	| "HINT.RUN_UPDATE_PAYLOAD"
	| "HINT.USE_INTERACTIVE_TERMINAL";

export type CliHumanMessageId =
	| CliErrorMessageId
	| CliWarningMessageId
	| CliInfoMessageId
	| CliSuccessMessageId
	| CliHintMessageId;

export interface CliHumanMessage {
	readonly kind: CliHumanMessageKind;
	readonly id: CliHumanMessageId;
	readonly params?: Record<string, string | number | boolean>;
}

export interface CliPresenter {
	render(message: CliHumanMessage): string;
	renderMany(messages: ReadonlyArray<CliHumanMessage>): string;
}

export type VarlockAdapterErrorMessageId =
	| "ERR.VARLOCK.STDOUT_PIPE_UNAVAILABLE"
	| "ERR.VARLOCK.CLI_START_FAILED"
	| "ERR.VARLOCK.LOAD_EXIT_NON_ZERO"
	| "ERR.VARLOCK.NOT_INITIALIZED"
	| "ERR.VARLOCK.MULTIPLE_INIT_UNSUPPORTED";

// ===========================================================================
// @better-age/cli :: program + commands + shared flows
// ===========================================================================

/**
 * CLI Flow Signals
 *
 * These are shell-internal navigation and orchestration protocol values.
 *
 * They are:
 * - not core `success | failure` results
 * - not user-facing messages
 * - not semantic product outcomes
 *
 * They exist only so CLI flows can coordinate local navigation, retries,
 * branching, and step-to-step control without leaking shell concerns into core.
 */
export type CliFlowBack = { readonly kind: "back" };

export type CliFlowCancel = { readonly kind: "cancel" };

export type CliFlowResolved<T> = {
	readonly kind: "resolved";
	readonly value: T;
};

export type CliFlowProceed = { readonly kind: "proceed" };

export type CliFlowUpdateNow = { readonly kind: "update-now" };

export type CliFlowCompleted = { readonly kind: "completed" };

export type CliProgramExitCode = 0 | 1 | 130;

export interface CliExitMappingPolicy {
	readonly success: 0;
	readonly unchangedSuccess: 0;
	readonly ctrlCAbort: 130;
	readonly userCancel: 1;
	readonly standaloneBack: 1;
	readonly domainOrUserError: 1;
	readonly internalDefect: 1;
	readonly cancelMessageStyle: "quiet-non-scary";
}

export interface BetterAgeCliProgram {
	runCli(argv: ReadonlyArray<string>): Promise<{
		readonly exitCode: CliProgramExitCode;
	}>;
}

export type BetterAgeTargetCliCommand =
	| "setup"
	| "interactive"
	| "create"
	| "edit"
	| "grant"
	| "inspect"
	| "load"
	| "revoke"
	| "update"
	| "view"
	| "identity export"
	| "identity forget"
	| "identity import"
	| "identity list"
	| "identity passphrase"
	| "identity rotate";

export const TARGET_CLI_COMMAND_SURFACE: ReadonlyArray<BetterAgeTargetCliCommand> =
	[
		"setup",
		"interactive",
		"create",
		"edit",
		"grant",
		"inspect",
		"load",
		"revoke",
		"update",
		"view",
		"identity export",
		"identity forget",
		"identity import",
		"identity list",
		"identity passphrase",
		"identity rotate",
	];

export interface BetterAgeCliCommands {
	runSetupCommand(input: {
		readonly context: CliCommandRunContext;
		readonly name?: DisplayName;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileCreateCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileEditCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileGrantCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
		readonly initialRecipientReference?: IdentityReferenceInput;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileRevokeCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
		readonly initialRecipientReference?: IdentityReferenceInput;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileInspectCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileViewCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileLoadCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
		readonly protocolVersion?: ProtocolVersion;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileUpdateCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityExportCommand(input: {
		readonly context: CliCommandRunContext;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityListCommand(input: {
		readonly context: CliCommandRunContext;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityImportCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialIdentityString?: IdentityString;
		readonly alias?: LocalAlias;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityForgetCommand(input: {
		readonly context: CliCommandRunContext;
		readonly initialIdentityReference?: IdentityReferenceInput;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityRotateCommand(input: {
		readonly context: CliCommandRunContext;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runIdentityPassphraseCommand(input: {
		readonly context: CliCommandRunContext;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runInteractiveCommand(input: {
		readonly context: CliCommandRunContext;
	}): Promise<CliFlowCompleted | CliFlowCancel>;
}

/**
 * Resolver Flows
 *
 * Purpose:
 * - turn incomplete or ambiguous shell input into one exact value
 *
 * Rules:
 * - no domain mutation
 * - may prompt, select, or locally retry entry
 * - return either one resolved value, `back`, or `cancel`
 */
export interface BetterAgeCliResolverFlows {
	runFilePayloadTargetResolutionFlow(input: {
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowResolved<PayloadPath> | CliFlowBack | CliFlowCancel>;

	runIdentityReferenceResolutionFlow(input: {
		readonly initialReference?: IdentityReferenceInput;
		readonly scope: "grant" | "revoke" | "forget";
	}): Promise<
		CliFlowResolved<IdentityReferenceInput> | CliFlowBack | CliFlowCancel
	>;

	runIdentityStringResolutionFlow(input: {
		readonly initialIdentityString?: IdentityString;
	}): Promise<CliFlowResolved<IdentityString> | CliFlowBack | CliFlowCancel>;

	runPassphrasePairConfirmationFlow(input: {
		readonly scope: "setup" | "identity-passphrase";
	}): Promise<CliFlowResolved<Passphrase> | CliFlowBack | CliFlowCancel>;

	runPassphraseAcquisitionFlow(input: {
		readonly scope:
			| "setup"
			| "create"
			| "inspect"
			| "view"
			| "edit"
			| "grant"
			| "revoke"
			| "update"
			| "load"
			| "identity-passphrase"
			| "identity-rotate";
		readonly credentialAcquisition: CliCredentialAcquisition;
	}): Promise<CliFlowResolved<Passphrase> | CliFlowBack | CliFlowCancel>;

	runEditorResolutionFlow(): Promise<
		CliFlowResolved<string> | CliFlowBack | CliFlowCancel
	>;
}

/**
 * Payload Context Flows
 *
 * Purpose:
 * - open/decrypt one exact payload early for every payload-content command
 * - keep the passphrase in memory only for the current command execution
 * - expose read models needed to build better guided choices
 *
 * Applies to:
 * - inspect
 * - view
 * - edit
 * - grant
 * - revoke
 * - update
 * - load
 *
 * Does not apply to:
 * - create, because no existing payload exists yet
 *
 * Example:
 * - guided grant resolves payload path
 * - prompts passphrase
 * - opens payload in memory
 * - shows known identities plus already-granted recipient context
 * - calls strict core mutation with the same in-memory credential context
 */
export interface BetterAgeCliPayloadContextFlows {
	runOpenPayloadContextFlow(input: {
		readonly path: PayloadPath;
		readonly command: PayloadContentCommand;
		readonly credentialAcquisition: CliCredentialAcquisition;
	}): Promise<
		| CliFlowResolved<{
				readonly path: PayloadPath;
				readonly passphrase: Passphrase;
				readonly payload: DecryptedPayload;
				readonly notices: ReadonlyArray<BetterAgeCoreNotice>;
		  }>
		| CliFlowBack
		| CliFlowCancel
	>;
}

/**
 * Gate Flows
 *
 * Purpose:
 * - stop before a command step and ask whether or how to proceed
 *
 * Rules:
 * - no domain mutation by themselves
 * - decide branching, not value resolution
 * - return semantic branch outcomes such as `proceed`, `update-now`, `back`,
 *   or `cancel`
 */
export interface BetterAgeCliGateFlows {
	runSetupGateFlow(): Promise<CliFlowProceed | CliFlowBack | CliFlowCancel>;

	runFileUpdateGateFlow(input: {
		readonly command: "edit" | "grant" | "revoke";
		readonly path: PayloadPath;
		readonly reasons: ReadonlyArray<PayloadUpdateReason>;
	}): Promise<CliFlowUpdateNow | CliFlowBack | CliFlowCancel>;
}

/**
 * Composite Flows
 *
 * Purpose:
 * - orchestrate multiple resolver flows, gate flows, and core calls into one
 *   command-shaped guided flow
 *
 * Rules:
 * - command-scoped rather than generic primitives
 * - may trigger domain mutation through core commands
 * - return command-level flow outcomes
 */
export interface BetterAgeCliCompositeFlows {
	runFileGrantFlow(input: {
		readonly initialPath?: PayloadPath;
		readonly initialRecipientReference?: IdentityReferenceInput;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileRevokeFlow(input: {
		readonly initialPath?: PayloadPath;
		readonly initialRecipientReference?: IdentityReferenceInput;
	}): Promise<CliFlowCompleted | CliFlowCancel>;

	runFileEditFlow(input: {
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowCompleted | CliFlowCancel>;
}

/**
 * Session Flows
 *
 * Purpose:
 * - host navigation across many commands and flows inside one persistent
 *   interactive shell session
 *
 * Rules:
 * - not one command-shaped flow
 * - may route into composite flows and direct command handlers
 * - own session-level back/cancel/menu semantics
 */
export interface BetterAgeCliSessionFlows {
	runInteractiveSession(): Promise<CliFlowCompleted | CliFlowCancel>;
}

export interface BetterAgeCliSharedFlows
	extends BetterAgeCliResolverFlows,
		BetterAgeCliPayloadContextFlows,
		BetterAgeCliGateFlows,
		BetterAgeCliCompositeFlows,
		BetterAgeCliSessionFlows {}

export interface BetterAgeCliCommandAliases {
	readonly root: {
		readonly setup: readonly [];
		readonly interactive: readonly ["i"];
		readonly create: readonly [];
		readonly edit: readonly [];
		readonly grant: readonly [];
		readonly revoke: readonly [];
		readonly inspect: readonly [];
		readonly view: readonly [];
		readonly load: readonly [];
		readonly update: readonly [];
	};
	readonly identity: {
		readonly export: readonly [];
		readonly list: readonly [];
		readonly import: readonly [];
		readonly forget: readonly [];
		readonly rotate: readonly [];
		readonly passphrase: readonly ["pw", "pass"];
	};
}

export interface BetterAgeCliCommandToCoreMapping {
	readonly root: {
		readonly setup: "commands.createSelfIdentity";
		readonly interactive: "commands+shared-flows over file and identity command surfaces";
	};
	readonly file: {
		readonly create: "commands.createPayload";
		readonly edit: "queries.decryptPayload+commands.editPayload";
		readonly grant: "queries.decryptPayload+queries.resolveGrantRecipient+commands.grantPayloadRecipient";
		readonly revoke: "queries.decryptPayload+queries.resolvePayloadRecipient+commands.revokePayloadRecipient";
		readonly inspect: "queries.decryptPayload";
		readonly view: "queries.decryptPayload";
		readonly load: "queries.decryptPayload";
		readonly update: "queries.decryptPayload+commands.updatePayload";
	};
	readonly identity: {
		readonly export: "queries.exportSelfIdentityString";
		readonly list: "queries.getSelfIdentity+queries.listKnownIdentities+queries.listRetiredKeys";
		readonly import: "commands.importKnownIdentity";
		readonly forget: "queries.resolveKnownIdentity+commands.forgetKnownIdentity";
		readonly rotate: "commands.rotateSelfIdentity";
		readonly passphrase: "queries.verifySelfIdentityPassphrase+commands.changeIdentityPassphrase";
	};
	readonly interactive: {
		readonly session: "commands+shared-flows over file and identity command surfaces";
	};
}

export const CLI_COMMAND_TO_CORE_MAPPING: BetterAgeCliCommandToCoreMapping = {
	root: {
		setup: "commands.createSelfIdentity",
		interactive:
			"commands+shared-flows over file and identity command surfaces",
	},
	file: {
		create: "commands.createPayload",
		edit: "queries.decryptPayload+commands.editPayload",
		grant:
			"queries.decryptPayload+queries.resolveGrantRecipient+commands.grantPayloadRecipient",
		revoke:
			"queries.decryptPayload+queries.resolvePayloadRecipient+commands.revokePayloadRecipient",
		inspect: "queries.decryptPayload",
		view: "queries.decryptPayload",
		load: "queries.decryptPayload",
		update: "queries.decryptPayload+commands.updatePayload",
	},
	identity: {
		export: "queries.exportSelfIdentityString",
		list: "queries.getSelfIdentity+queries.listKnownIdentities+queries.listRetiredKeys",
		import: "commands.importKnownIdentity",
		forget: "queries.resolveKnownIdentity+commands.forgetKnownIdentity",
		rotate: "commands.rotateSelfIdentity",
		passphrase:
			"queries.verifySelfIdentityPassphrase+commands.changeIdentityPassphrase",
	},
	interactive: {
		session: "commands+shared-flows over file and identity command surfaces",
	},
};

export const CLI_COMMAND_CONTRACTS: ReadonlyArray<CliCommandContract> = [
	{
		command: "setup",
		promptableOperands: ["--name"],
		protocolOperands: [],
		secretPrompts: ["new-passphrase", "confirm-new-passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "create",
		promptableOperands: ["path"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "edit",
		promptableOperands: ["path"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "grant",
		promptableOperands: ["path", "identity-ref"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "inspect",
		promptableOperands: ["path"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "human-output",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "load",
		promptableOperands: ["path"],
		protocolOperands: ["--protocol-version"],
		secretPrompts: ["passphrase"],
		stdoutContract: "raw-envText-only",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "revoke",
		promptableOperands: ["path", "identity-ref"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "update",
		promptableOperands: ["path"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "view",
		promptableOperands: ["path"],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "identity export",
		promptableOperands: [],
		protocolOperands: [],
		secretPrompts: [],
		stdoutContract: "identity-string-only",
		headlessBehavior: "allowed",
	},
	{
		command: "identity forget",
		promptableOperands: ["identity-ref"],
		protocolOperands: [],
		secretPrompts: [],
		stdoutContract: "none",
		headlessBehavior: "allowed",
	},
	{
		command: "identity import",
		promptableOperands: ["identity-string"],
		protocolOperands: [],
		secretPrompts: [],
		stdoutContract: "none",
		headlessBehavior: "allowed",
	},
	{
		command: "identity list",
		promptableOperands: [],
		protocolOperands: [],
		secretPrompts: [],
		stdoutContract: "human-output",
		headlessBehavior: "allowed",
	},
	{
		command: "identity passphrase",
		promptableOperands: [],
		protocolOperands: [],
		secretPrompts: [
			"current-passphrase",
			"new-passphrase",
			"confirm-new-passphrase",
		],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "identity rotate",
		promptableOperands: [],
		protocolOperands: [],
		secretPrompts: ["passphrase"],
		stdoutContract: "none",
		headlessBehavior: "fail-passphrase-unavailable",
	},
	{
		command: "interactive",
		promptableOperands: [],
		protocolOperands: [],
		secretPrompts: ["command-dependent"],
		stdoutContract: "none",
		headlessBehavior: "fail-interactive-unavailable",
	},
];

export const CLI_COMMAND_ALIASES: BetterAgeCliCommandAliases = {
	root: {
		setup: [],
		interactive: ["i"],
		create: [],
		edit: [],
		grant: [],
		revoke: [],
		inspect: [],
		view: [],
		load: [],
		update: [],
	},
	identity: {
		export: [],
		list: [],
		import: [],
		forget: [],
		rotate: [],
		passphrase: ["pw", "pass"],
	},
};

// ===========================================================================
// @better-age/varlock :: plugin/runtime
// ===========================================================================

export interface LoadProtocolRequest {
	readonly protocolVersion: ProtocolVersion;
	readonly path: PayloadPath;
}

/**
 * Current varlock integration keeps `load` interactive-capable by spawning the
 * CLI with stdin/stderr inherited and stdout piped.
 *
 * Consequence:
 * - env text is captured from stdout
 * - passphrase prompt renders on stderr
 * - passphrase input is read from inherited stdin
 * - varlock does not receive, store, or forward the passphrase
 */
export interface LoadProtocolProcessContract {
	readonly stdin: "inherit";
	readonly stdout: "pipe-env-text";
	readonly stderr: "inherit-human-messages-and-prompts";
	readonly credentialAcquisition:
		| "prompt-through-inherited-tty"
		| "fail-if-inherited-stdio-is-not-interactive";
}

export interface LoadProtocolSuccess {
	readonly stdout: EnvText;
	readonly stderr: ReadonlyArray<CliHumanMessage>;
	readonly exitCode: 0;
}

export interface LoadProtocolFailure {
	readonly stdout: "";
	readonly stderr: ReadonlyArray<CliHumanMessage>;
	readonly exitCode: 1;
}

export type LoadProtocolResponse = LoadProtocolSuccess | LoadProtocolFailure;

export type VarlockAdapterErrorCode =
	| "LOAD_STDOUT_PIPE_UNAVAILABLE"
	| "VARLOCK_CLI_START_FAILED"
	| "VARLOCK_LOAD_EXIT_NON_ZERO"
	| "VARLOCK_NOT_INITIALIZED"
	| "VARLOCK_MULTIPLE_INIT_UNSUPPORTED";

export interface VarlockAdapterFailure {
	readonly kind: "adapter-failure";
	readonly code: VarlockAdapterErrorCode;
	readonly messageId: VarlockAdapterErrorMessageId;
	readonly details?: {
		readonly launcher?: string;
		readonly payloadPath?: PayloadPath;
		readonly exitCode?: number;
	};
}

export type VarlockLoadResult = LoadProtocolResponse | VarlockAdapterFailure;

/**
 * The varlock package does not call core directly in v1.
 * It depends on the CLI load protocol.
 */
export interface BetterAgeMachineAdapter {
	load(input: LoadProtocolRequest): Promise<VarlockLoadResult>;
}
