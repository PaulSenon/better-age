import { Option } from "effect";
import type { HomeState } from "../home/HomeState.js";
import { getSelfIdentity } from "../home/HomeState.js";
import {
	materializeSelfIdentity,
	toPublicIdentityFromSelfIdentity,
	type SelfIdentity,
} from "../identity/Identity.js";
import type { PayloadEnvelope, PayloadRecipient } from "./PayloadEnvelope.js";

export type PayloadUpdateReason =
	| "duplicate-self-recipient"
	| "schema-outdated"
	| "self-stale";

export type PayloadUpdateState = {
	readonly isRequired: boolean;
	readonly reasons: ReadonlyArray<PayloadUpdateReason>;
};

const currentPayloadSchemaVersion = 2;

const isSameSelfSnapshot = (
	selfIdentity: SelfIdentity,
	recipient: PayloadRecipient,
): boolean =>
	toPublicIdentityFromSelfIdentity(selfIdentity).displayName === recipient.displayName &&
	toPublicIdentityFromSelfIdentity(selfIdentity).identityUpdatedAt ===
		recipient.identityUpdatedAt &&
	toPublicIdentityFromSelfIdentity(selfIdentity).ownerId === recipient.ownerId &&
	toPublicIdentityFromSelfIdentity(selfIdentity).publicKey === recipient.publicKey;

export const computePayloadUpdateState = (
	state: HomeState,
	envelope: PayloadEnvelope,
	input?: {
		readonly persistedSchemaVersion?: number;
	},
): PayloadUpdateState => {
	const reasons: Array<PayloadUpdateReason> = [];

	const persistedSchemaVersion =
		input?.persistedSchemaVersion ?? envelope.version;

	if (persistedSchemaVersion !== currentPayloadSchemaVersion) {
		reasons.push("schema-outdated");
	}

	const selfIdentity = getSelfIdentity(state);

	if (Option.isNone(selfIdentity)) {
		return {
			isRequired: reasons.length > 0,
			reasons,
		};
	}

	const selfRecipients = envelope.recipients.filter(
		(recipient) =>
			recipient.ownerId === materializeSelfIdentity(selfIdentity.value).ownerId,
	);

	if (selfRecipients.length > 1) {
		reasons.push("duplicate-self-recipient");
	}

	if (
		selfRecipients.some(
			(recipient) => !isSameSelfSnapshot(selfIdentity.value, recipient),
		)
	) {
		reasons.push("self-stale");
	}

	return {
		isRequired: reasons.length > 0,
		reasons,
	};
};

export const getPayloadUpdateReasonMessage = (
	reason: PayloadUpdateReason,
): string => {
	switch (reason) {
		case "duplicate-self-recipient":
			return "duplicate self recipient";
		case "schema-outdated":
			return "payload schema is outdated";
		case "self-stale":
			return "self key is stale";
	}
};

export const toPayloadNeedsUpdate = (state: PayloadUpdateState) => ({
	isRequired: state.isRequired,
	reason: (() => {
		const firstReason = state.reasons[0];

		return firstReason === undefined
			? Option.none<string>()
			: Option.some(getPayloadUpdateReasonMessage(firstReason));
	})(),
});

export const toPayloadRecipientFromSelfIdentity = (
	selfIdentity: SelfIdentity,
): PayloadRecipient => toPublicIdentityFromSelfIdentity(selfIdentity);
