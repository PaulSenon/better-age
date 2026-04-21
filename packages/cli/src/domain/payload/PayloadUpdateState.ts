import { Option } from "effect";
import type { HomeState } from "../home/HomeState.js";
import { getSelfIdentity } from "../home/HomeState.js";
import type { SelfIdentity } from "../identity/Identity.js";
import type { PayloadEnvelope, PayloadRecipient } from "./PayloadEnvelope.js";

export type PayloadUpdateReason =
	| "duplicate-self-recipient"
	| "schema-outdated"
	| "self-stale";

export type PayloadUpdateState = {
	readonly isRequired: boolean;
	readonly reasons: ReadonlyArray<PayloadUpdateReason>;
};

const currentPayloadSchemaVersion = 1;

const isSameSelfSnapshot = (
	selfIdentity: SelfIdentity,
	recipient: PayloadRecipient,
): boolean =>
	selfIdentity.fingerprint === recipient.fingerprint &&
	selfIdentity.publicKey === recipient.publicKey &&
	selfIdentity.identityUpdatedAt === recipient.identityUpdatedAt &&
	selfIdentity.displayName === recipient.displayNameSnapshot;

export const computePayloadUpdateState = (
	state: HomeState,
	envelope: PayloadEnvelope,
): PayloadUpdateState => {
	const reasons: Array<PayloadUpdateReason> = [];

	if (envelope.version !== currentPayloadSchemaVersion) {
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
		(recipient) => recipient.ownerId === selfIdentity.value.ownerId,
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
): PayloadRecipient => ({
	displayNameSnapshot: selfIdentity.displayName,
	fingerprint: selfIdentity.fingerprint,
	identityUpdatedAt: selfIdentity.identityUpdatedAt,
	ownerId: selfIdentity.ownerId,
	publicKey: selfIdentity.publicKey,
});
