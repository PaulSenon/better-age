// Pure payload rules: recipient list transitions and read-side summaries.
import type { HomeState } from "../artifacts/HomeState.js";
import type { PayloadPlaintext } from "../artifacts/PayloadFile.js";
import type { PublicIdentity } from "../artifacts/PublicIdentity.js";
import {
	fingerprintOf,
	handleOf,
	samePublicIdentity,
	selfPublicIdentity,
} from "./Identity.js";

export type PayloadRecipient = PublicIdentity & {
	readonly localAlias: string | null;
	readonly fingerprint: string;
	readonly handle: string;
	readonly isSelf: boolean;
	readonly isStaleSelf: boolean;
};

export const newPayload = (input: {
	readonly payloadId: string;
	readonly now: string;
	readonly self: PublicIdentity;
}): PayloadPlaintext => ({
	kind: "better-age/payload",
	version: 1,
	payloadId: input.payloadId,
	createdAt: input.now,
	lastRewrittenAt: input.now,
	envText: "",
	recipients: [input.self],
});

/**
 * A payload is outdated when its self recipient is missing or no longer
 * matches the local identity (e.g. after rotation). Writes require `update` first.
 */
export const isOutdated = (home: HomeState, payload: PayloadPlaintext) => {
	const self = payload.recipients.find(
		(recipient) => recipient.ownerId === home.ownerId,
	);

	return (
		self === undefined || !samePublicIdentity(self, selfPublicIdentity(home))
	);
};

/** Puts the current self identity first and keeps other recipients as-is. */
export const refreshSelf = (
	home: HomeState,
	payload: PayloadPlaintext,
): PayloadPlaintext["recipients"] => [
	selfPublicIdentity(home),
	...payload.recipients.filter(
		(recipient) => recipient.ownerId !== home.ownerId,
	),
];

export const grantRecipient = (
	payload: PayloadPlaintext,
	recipient: PublicIdentity,
): {
	readonly recipients: PayloadPlaintext["recipients"];
	readonly outcome: "added" | "updated" | "unchanged";
} => {
	const existing = payload.recipients.find(
		(item) => item.ownerId === recipient.ownerId,
	);

	if (existing === undefined) {
		return { recipients: [...payload.recipients, recipient], outcome: "added" };
	}

	if (samePublicIdentity(existing, recipient)) {
		return { recipients: payload.recipients, outcome: "unchanged" };
	}

	return {
		recipients: payload.recipients.map((item) =>
			item.ownerId === recipient.ownerId ? recipient : item,
		),
		outcome: "updated",
	};
};

export const revokeRecipient = (
	payload: PayloadPlaintext,
	ownerId: string,
): {
	readonly recipients: PayloadPlaintext["recipients"];
	readonly outcome: "removed" | "unchanged";
} =>
	payload.recipients.some((recipient) => recipient.ownerId === ownerId)
		? {
				recipients: payload.recipients.filter(
					(recipient) => recipient.ownerId !== ownerId,
				),
				outcome: "removed",
			}
		: { recipients: payload.recipients, outcome: "unchanged" };

/** Display helper: text before the first `=` of each non-blank, non-comment line. */
export const envKeysOf = (envText: string): ReadonlyArray<string> =>
	envText
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("#"))
		.map((line) => line.split("=", 1)[0] ?? "")
		.filter((key) => key.length > 0);

export const toPayloadRecipient = (
	home: HomeState,
	recipient: PublicIdentity,
): PayloadRecipient => {
	const localAlias =
		home.knownIdentities.find((known) => known.ownerId === recipient.ownerId)
			?.localAlias ?? null;
	const fingerprint = fingerprintOf(recipient.publicKey);
	const isSelf = recipient.ownerId === home.ownerId;

	return {
		ownerId: recipient.ownerId,
		displayName: recipient.displayName,
		publicKey: recipient.publicKey,
		identityUpdatedAt: recipient.identityUpdatedAt,
		localAlias,
		fingerprint,
		handle: handleOf(localAlias ?? recipient.displayName, fingerprint),
		isSelf,
		isStaleSelf:
			isSelf && !samePublicIdentity(recipient, selfPublicIdentity(home)),
	};
};
