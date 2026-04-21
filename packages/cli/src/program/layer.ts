import { Layer } from "effect";
import { ChangePassphrase } from "../app/change-passphrase/ChangePassphrase.js";
import { CreatePayload } from "../app/create-payload/CreatePayload.js";
import { CreateUserIdentity } from "../app/create-user-identity/CreateUserIdentity.js";
import { EditPayload } from "../app/edit-payload/EditPayload.js";
import { ExportIdentityString } from "../app/export-identity-string/ExportIdentityString.js";
import { ForgetIdentity } from "../app/forget-identity/ForgetIdentity.js";
import { GrantPayloadRecipient } from "../app/grant-payload-recipient/GrantPayloadRecipient.js";
import { ImportIdentityString } from "../app/import-identity-string/ImportIdentityString.js";
import { InspectHomeIdentities } from "../app/inspect-home-identities/InspectHomeIdentities.js";
import { InspectPayload } from "../app/inspect-payload/InspectPayload.js";
import { ReadPayload } from "../app/read-payload/ReadPayload.js";
import { RevokePayloadRecipient } from "../app/revoke-payload-recipient/RevokePayloadRecipient.js";
import { RotateUserIdentity } from "../app/rotate-user-identity/RotateUserIdentity.js";
import { OpenPayload } from "../app/shared/OpenPayload.js";
import { ResolveEditorCommand } from "../app/shared/ResolveEditorCommand.js";
import { ResolveNewPayloadTarget } from "../app/shared/ResolveNewPayloadTarget.js";
import { ResolvePayloadTarget } from "../app/shared/ResolvePayloadTarget.js";
import { RewritePayloadEnvelope } from "../app/shared/RewritePayloadEnvelope.js";
import { UpdatePayload } from "../app/update-payload/UpdatePayload.js";
import { ViewPayload } from "../app/view-payload/ViewPayload.js";
import { InteractiveSession } from "../cli/flow/InteractiveSession.js";
import { NodeBetterAgeConfigLive } from "../infra/config/nodeBetterAgeConfig.js";
import { PayloadAgeCryptoLive } from "../infra/crypto/payloadAgeCrypto.js";
import { TypageCryptoLive } from "../infra/crypto/typageCrypto.js";
import { NodeEditorLive } from "../infra/editor/nodeEditor.js";
import { NodeHomeRepositoryLive } from "../infra/fs/nodeHomeRepository.js";
import { NodePathAccessLive } from "../infra/fs/nodePathAccess.js";
import { NodePayloadDiscoveryLive } from "../infra/fs/nodePayloadDiscovery.js";
import { NodePayloadRepositoryLive } from "../infra/fs/nodePayloadRepository.js";
import { NodeTempFileLive } from "../infra/fs/nodeTempFile.js";
import { NodeInteractivePromptLive } from "../infra/prompt/nodeInteractivePrompt.js";
import { NodePromptLive } from "../infra/prompt/nodePrompt.js";
import { NodeSecureViewerLive } from "../infra/view/nodeSecureViewer.js";

const HomeRepositoryLive = NodeHomeRepositoryLive.pipe(
	Layer.provide(NodeBetterAgeConfigLive),
);

const PayloadRepositoryLive = NodePayloadRepositoryLive;

// Low-level node/runtime adapters.
export const InfraLive = Layer.mergeAll(
	NodePromptLive,
	NodeInteractivePromptLive,
	NodeEditorLive,
	NodeTempFileLive,
	NodeSecureViewerLive,
	NodePayloadDiscoveryLive,
	NodePathAccessLive,
	HomeRepositoryLive,
	PayloadRepositoryLive,
	PayloadAgeCryptoLive,
	TypageCryptoLive,
);

const CreateUserIdentityLive = Layer.provide(CreateUserIdentity.Default, [
	HomeRepositoryLive,
	TypageCryptoLive,
]);

const CreatePayloadLive = Layer.provide(CreatePayload.Default, [
	HomeRepositoryLive,
	PayloadAgeCryptoLive,
	PayloadRepositoryLive,
]);

const ExportIdentityStringLive = Layer.provide(ExportIdentityString.Default, [
	HomeRepositoryLive,
]);

const ImportIdentityStringLive = Layer.provide(ImportIdentityString.Default, [
	HomeRepositoryLive,
]);

const ForgetIdentityLive = Layer.provide(ForgetIdentity.Default, [
	HomeRepositoryLive,
]);

const InspectHomeIdentitiesLive = Layer.provide(InspectHomeIdentities.Default, [
	HomeRepositoryLive,
]);

const OpenPayloadLive = Layer.provide(OpenPayload.Default, [
	HomeRepositoryLive,
	PayloadAgeCryptoLive,
	PayloadRepositoryLive,
]);

const RewritePayloadEnvelopeLive = Layer.provide(
	RewritePayloadEnvelope.Default,
	[PayloadAgeCryptoLive, PayloadRepositoryLive],
);

const InspectPayloadLive = Layer.provide(InspectPayload.Default, [
	OpenPayloadLive,
]);

const EditPayloadLive = Layer.provide(EditPayload.Default, [
	OpenPayloadLive,
	PayloadAgeCryptoLive,
	PayloadRepositoryLive,
]);

const ReadPayloadLive = Layer.provide(ReadPayload.Default, [OpenPayloadLive]);

const GrantPayloadRecipientLive = Layer.provide(GrantPayloadRecipient.Default, [
	OpenPayloadLive,
	RewritePayloadEnvelopeLive,
]);

const RevokePayloadRecipientLive = Layer.provide(
	RevokePayloadRecipient.Default,
	[OpenPayloadLive, RewritePayloadEnvelopeLive],
);

const UpdatePayloadLive = Layer.provide(UpdatePayload.Default, [
	OpenPayloadLive,
	RewritePayloadEnvelopeLive,
]);

const RotateUserIdentityLive = Layer.provide(RotateUserIdentity.Default, [
	HomeRepositoryLive,
	TypageCryptoLive,
]);

const ChangePassphraseLive = Layer.provide(ChangePassphrase.Default, [
	HomeRepositoryLive,
	TypageCryptoLive,
]);

const ResolvePayloadTargetLive = Layer.provide(ResolvePayloadTarget.Default, [
	NodeInteractivePromptLive,
	NodePayloadDiscoveryLive,
	NodePromptLive,
]);

const ResolveEditorCommandLive = Layer.provide(ResolveEditorCommand.Default, [
	HomeRepositoryLive,
	NodeInteractivePromptLive,
]);

const ResolveNewPayloadTargetLive = Layer.provide(
	ResolveNewPayloadTarget.Default,
	[NodePathAccessLive, NodePromptLive, NodeInteractivePromptLive],
);

const ViewPayloadLive = Layer.provide(ViewPayload.Default, [
	NodeInteractivePromptLive,
	NodePromptLive,
	ResolvePayloadTargetLive,
	ReadPayloadLive,
	NodeSecureViewerLive,
]);

const InteractiveSessionLive = Layer.provide(InteractiveSession.Default, [
	HomeRepositoryLive,
	NodeInteractivePromptLive,
	NodePromptLive,
	CreateUserIdentityLive,
	InspectHomeIdentitiesLive,
	ExportIdentityStringLive,
	ImportIdentityStringLive,
	ForgetIdentityLive,
	RotateUserIdentityLive,
	ChangePassphraseLive,
	ViewPayloadLive,
]);

export const IdentityAppLive = Layer.mergeAll(
	CreateUserIdentityLive,
	ExportIdentityStringLive,
	ImportIdentityStringLive,
	ForgetIdentityLive,
	InspectHomeIdentitiesLive,
	RotateUserIdentityLive,
	ChangePassphraseLive,
);

// Payload/domain use-cases plus app-owned shared helpers.
export const PayloadAppLive = Layer.mergeAll(
	CreatePayloadLive,
	OpenPayloadLive,
	RewritePayloadEnvelopeLive,
	InspectPayloadLive,
	EditPayloadLive,
	ReadPayloadLive,
	GrantPayloadRecipientLive,
	RevokePayloadRecipientLive,
	UpdatePayloadLive,
	ResolvePayloadTargetLive,
	ResolveEditorCommandLive,
	ResolveNewPayloadTargetLive,
	ViewPayloadLive,
);

// CLI-owned orchestration over shared command semantics.
export const CliFlowLive = InteractiveSessionLive;

export const BetterAgeLive = Layer.mergeAll(
	InfraLive,
	IdentityAppLive,
	PayloadAppLive,
	CliFlowLive,
);
