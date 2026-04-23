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
 *   prompt / editor / secure-viewer / cwd-discovery / terminal capability
 * - infra/*
 *   node TTY, prompt, editor, secure viewer, style renderer
 *
 * CLI owns:
 * - missing-arg resolution
 * - passphrase prompt timing and retry policy
 * - back / cancel / session loops
 * - choosing between readPayload -> view vs readPayload -> load
 * - human stderr/stdout rendering
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
 *
 * Varlock does not own:
 * - domain logic
 * - payload crypto
 * - artifact migration policy
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
export type Passphrase = string;
export type EnvText = string;
export type ProtocolVersion = string;
export type IsoUtcTimestamp = string;

export type InvocationKind =
	| "exact"
	| "guided"
	| "interactive-session"
	| "machine";

export type TerminalCapability = "interactive-terminal" | "headless-terminal";

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

export interface PayloadReadModel {
	readonly path: PayloadPath;
	readonly payloadId: PayloadId;
	readonly envText: EnvText;
	readonly compatibility: PayloadCompatibilityState;
}

export interface PayloadInspection {
	readonly path: PayloadPath;
	readonly payloadId: PayloadId;
	readonly createdAt: IsoUtcTimestamp;
	readonly lastRewrittenAt: IsoUtcTimestamp;
	readonly schemaVersion: number;
	readonly compatibility: PayloadCompatibilityState;
	readonly envKeyNames: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<PayloadRecipientSummary>;
}

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
> =
	| CoreSuccess<TSuccessCode, TValue>
	| CoreFailure<TErrorCode, TErrorDetails>;

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

export interface AmbiguousKnownIdentityDetails {
	readonly reference: IdentityReferenceInput;
	readonly candidates: ReadonlyArray<KnownIdentitySummary>;
}

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
	| "HOME_STATE_READ_FAILED"
	| "HOME_STATE_INVALID";

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

export type PayloadContentErrorCode =
	| "PAYLOAD_INVALID"
	| "PAYLOAD_ENV_INVALID";

export type PayloadCompatibilityErrorCode =
	| "PAYLOAD_CLI_TOO_OLD"
	| "PAYLOAD_MIGRATION_PATH_MISSING"
	| "PAYLOAD_MIGRATION_HARD_BROKEN";

export type PayloadSecretErrorCode =
	| "PASSPHRASE_INCORRECT"
	| "PAYLOAD_ACCESS_DENIED"
	| "PAYLOAD_DECRYPT_FAILED";

export type IdentityParseErrorCode = "IDENTITY_STRING_INVALID";

export type KnownIdentityResolutionErrorCode =
	| "KNOWN_IDENTITY_NOT_FOUND"
	| "KNOWN_IDENTITY_AMBIGUOUS";

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
	saveCurrentHomeStateDocument(document: unknown): Promise<void>;
	readEncryptedPrivateKey(path: string): Promise<string>;
	writeEncryptedPrivateKey(path: string, encryptedKey: string): Promise<void>;
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
		readonly envelope: unknown;
		readonly recipients: ReadonlyArray<string>;
	}): Promise<string>;

	decryptPayload(input: {
		readonly armoredPayload: string;
		readonly encryptedPrivateKeys: ReadonlyArray<string>;
		readonly passphrase: Passphrase;
	}): Promise<unknown>;
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
	| HomeWriteErrorCode
	| HomeCompatibilityErrorCode;

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

export type GetSelfIdentityErrorCode = HomeReadErrorCode | "SELF_IDENTITY_NOT_FOUND";

export type ListKnownIdentitiesErrorCode = HomeReadErrorCode;

export type ListRetiredKeysErrorCode = HomeReadErrorCode;

export type ExportOwnIdentityStringErrorCode =
	| HomeReadErrorCode
	| "SELF_IDENTITY_NOT_FOUND";

export type ParseIdentityStringErrorCode = IdentityParseErrorCode;

export type ResolveKnownIdentityErrorCode =
	| HomeReadErrorCode
	| KnownIdentityResolutionErrorCode;

export type ReadPayloadErrorCode =
	| PayloadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode;

export type InspectPayloadErrorCode = ReadPayloadErrorCode;

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

	exportOwnIdentityString(): CoreMethodResult<
		CoreResult<
			"OWN_IDENTITY_STRING_EXPORTED",
			{
				readonly identityString: IdentityString;
				readonly publicIdentity: PublicIdentitySnapshot;
				readonly handle: Handle;
			},
			ExportOwnIdentityStringErrorCode
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
			AmbiguousKnownIdentityDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	readPayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<"PAYLOAD_READ", PayloadReadModel, ReadPayloadErrorCode>,
		BetterAgeCoreNotice
	>;

	inspectPayload(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"PAYLOAD_INSPECTED",
			PayloadInspection,
			InspectPayloadErrorCode
		>,
		BetterAgeCoreNotice
	>;
}

// ===========================================================================
// @better-age/core :: app/commands
// ===========================================================================

export type CreateUserIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "DISPLAY_NAME_INVALID"
	| "SELF_IDENTITY_ALREADY_EXISTS"
	| "KEY_GENERATION_FAILED"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type ImportIdentityStringErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| IdentityParseErrorCode
	| "CANNOT_IMPORT_SELF_IDENTITY"
	| "KNOWN_IDENTITY_CONFLICT";

export type ForgetKnownIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "KNOWN_IDENTITY_NOT_FOUND"
	| "CANNOT_FORGET_SELF_IDENTITY";

export type ChangePassphraseErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "SELF_IDENTITY_NOT_FOUND"
	| "PASSPHRASE_INCORRECT"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type RotateUserIdentityErrorCode =
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "SELF_IDENTITY_NOT_FOUND"
	| "PASSPHRASE_INCORRECT"
	| "KEY_GENERATION_FAILED"
	| "PRIVATE_KEY_PROTECTION_FAILED";

export type CreatePayloadErrorCode =
	| HomeReadErrorCode
	| PayloadRepositoryErrorCode
	| "SELF_IDENTITY_NOT_FOUND"
	| "PAYLOAD_ENCRYPT_FAILED";

export type EditPayloadErrorCode =
	| PayloadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED";

export type GrantPayloadRecipientErrorCode =
	| PayloadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED"
	| "KNOWN_IDENTITY_NOT_FOUND"
	| "CANNOT_GRANT_SELF"
	| "PAYLOAD_ENCRYPT_FAILED";

export type RevokePayloadRecipientErrorCode =
	| PayloadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "PAYLOAD_UPDATE_REQUIRED"
	| "RECIPIENT_NOT_GRANTED"
	| "CANNOT_REVOKE_SELF"
	| "PAYLOAD_ENCRYPT_FAILED";

export type UpdatePayloadErrorCode =
	| PayloadRepositoryErrorCode
	| PayloadContentErrorCode
	| PayloadCompatibilityErrorCode
	| PayloadSecretErrorCode
	| HomeReadErrorCode
	| HomeWriteErrorCode
	| "SELF_IDENTITY_NOT_FOUND"
	| "PAYLOAD_ENCRYPT_FAILED";

/**
 * Command-side identity targets stay strict.
 *
 * Flexible references never cross this boundary.
 * The CLI must call query-side resolution/parsing first.
 */
export type GrantRecipientTarget =
	| {
			readonly kind: "known-identity";
			readonly ownerId: OwnerId;
	  }
	| {
			readonly kind: "public-identity";
			readonly identity: PublicIdentitySnapshot;
	  };

export interface BetterAgeCoreCommands {
	createUserIdentity(input: {
		readonly displayName: DisplayName;
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"USER_IDENTITY_CREATED",
			{
				readonly ownerId: OwnerId;
				readonly handle: Handle;
			},
			CreateUserIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	importIdentityString(input: {
		readonly identityString: IdentityString;
		readonly localAlias?: LocalAlias | null;
	}): CoreMethodResult<
		CoreResult<
			"IDENTITY_IMPORTED",
			{
				readonly ownerId: OwnerId;
				readonly handle: Handle;
				readonly outcome: "added" | "updated" | "unchanged";
			},
			ImportIdentityStringErrorCode,
			KnownIdentityConflictDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	forgetKnownIdentity(input: {
		readonly ownerId: OwnerId;
	}): CoreMethodResult<
		CoreResult<
			"KNOWN_IDENTITY_FORGOTTEN",
			{
				readonly ownerId: OwnerId;
				readonly outcome: "removed" | "unchanged";
			},
			ForgetKnownIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	changePassphrase(input: {
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

	rotateUserIdentity(input: {
		readonly passphrase: Passphrase;
	}): CoreMethodResult<
		CoreResult<
			"USER_IDENTITY_ROTATED",
			{
				readonly ownerId: OwnerId;
				readonly nextFingerprint: KeyFingerprint;
			},
			RotateUserIdentityErrorCode
		>,
		BetterAgeCoreNotice
	>;

	createPayload(input: {
		readonly path: PayloadPath;
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
				readonly outcome: "rewritten" | "unchanged";
			},
			EditPayloadErrorCode,
			PayloadMutationBlockedDetails | undefined
		>,
		BetterAgeCoreNotice
	>;

	grantPayloadRecipient(input: {
		readonly path: PayloadPath;
		readonly passphrase: Passphrase;
		readonly recipient: GrantRecipientTarget;
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

export interface TerminalContextPort {
	getInvocationContext(): {
		readonly invocationKind: InvocationKind;
		readonly terminalCapability: TerminalCapability;
	};
}

export interface PromptPort {
	inputText(input: {
		readonly label: string;
		readonly defaultValue?: string;
	}): Promise<string>;

	inputSecret(input: {
		readonly label: string;
	}): Promise<Passphrase>;

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
	edit(input: {
		readonly initialText: EnvText;
	}): Promise<{
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
	| "ERR.SETUP.REQUIRED"
	| "ERR.SETUP.ALREADY_CONFIGURED"
	| "ERR.HOME_STATE.CLI_TOO_OLD"
	| "ERR.HOME_STATE.MIGRATION_PATH_MISSING"
	| "ERR.HOME_STATE.INVALID"
	| "ERR.IDENTITY_STRING.INVALID"
	| "ERR.IDENTITY.NOT_FOUND"
	| "ERR.IDENTITY.AMBIGUOUS"
	| "ERR.IDENTITY.CANNOT_IMPORT_SELF"
	| "ERR.IDENTITY.CONFLICT"
	| "ERR.IDENTITY.CANNOT_FORGET_SELF"
	| "ERR.PASSPHRASE.INCORRECT"
	| "ERR.PASSPHRASE.UNAVAILABLE"
	| "ERR.PAYLOAD.NOT_FOUND"
	| "ERR.PAYLOAD.INVALID"
	| "ERR.PAYLOAD.ACCESS_DENIED"
	| "ERR.PAYLOAD.CLI_TOO_OLD"
	| "ERR.PAYLOAD.MIGRATION_PATH_MISSING"
	| "ERR.PAYLOAD.MIGRATION_HARD_BROKEN"
	| "ERR.PAYLOAD.UPDATE_REQUIRED"
	| "ERR.PAYLOAD.CANNOT_GRANT_SELF"
	| "ERR.PAYLOAD.CANNOT_REVOKE_SELF"
	| "ERR.LOAD.PROTOCOL_REQUIRED"
	| "ERR.LOAD.PROTOCOL_UNSUPPORTED"
	| "ERR.PROMPT.UNAVAILABLE"
	| "ERR.SECURE_VIEWER.UNAVAILABLE";

export type CliWarningMessageId =
	| "WARN.PAYLOAD.UPDATE_RECOMMENDED";

export type CliInfoMessageId =
	| "INFO.HOME_STATE.MIGRATED"
	| "INFO.PAYLOAD.READ_USED_IN_MEMORY_MIGRATION"
	| "INFO.USING_DISCOVERED_PATH";

export type CliSuccessMessageId =
	| "SUCCESS.SETUP.COMPLETED"
	| "SUCCESS.IDENTITY.IMPORTED"
	| "SUCCESS.IDENTITY.FORGOTTEN"
	| "SUCCESS.PASSPHRASE.CHANGED"
	| "SUCCESS.IDENTITY.ROTATED"
	| "SUCCESS.PAYLOAD.CREATED"
	| "SUCCESS.PAYLOAD.EDITED"
	| "SUCCESS.PAYLOAD.GRANTED"
	| "SUCCESS.PAYLOAD.REVOKED"
	| "SUCCESS.PAYLOAD.UPDATED";

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

// ===========================================================================
// @better-age/cli :: interaction
// ===========================================================================

export type CliFlowOutcome =
	| { readonly kind: "done" }
	| { readonly kind: "back" }
	| { readonly kind: "cancel" };

/**
 * CLI interaction owns:
 * - exact vs guided behavior
 * - passphrase retry policy
 * - when to call core queries before commands
 * - interactive session menu loops
 */
export interface BetterAgeCliInteraction {
	runGrantFlow(input: {
		readonly initialPath?: PayloadPath;
		readonly initialRecipientReference?: IdentityReferenceInput;
	}): Promise<CliFlowOutcome>;

	runRevokeFlow(input: {
		readonly initialPath?: PayloadPath;
		readonly initialRecipientOwnerId?: OwnerId;
	}): Promise<CliFlowOutcome>;

	runEditFlow(input: {
		readonly initialPath?: PayloadPath;
	}): Promise<CliFlowOutcome>;

	runInteractiveSession(): Promise<CliFlowOutcome>;
}

// ===========================================================================
// @better-age/varlock :: plugin/runtime
// ===========================================================================

export interface LoadProtocolRequest {
	readonly protocolVersion: ProtocolVersion;
	readonly path: PayloadPath;
	readonly passphrase: Passphrase;
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

export type LoadProtocolResponse =
	| LoadProtocolSuccess
	| LoadProtocolFailure;

/**
 * The varlock package does not call core directly in v1.
 * It depends on the CLI load protocol.
 */
export interface BetterAgeMachineAdapter {
	load(input: LoadProtocolRequest): Promise<LoadProtocolResponse>;
}
