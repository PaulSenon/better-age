import type { Schema } from "effect";
import type { KnownIdentity } from "../identity/Identity.js";
import type { PayloadRecipient } from "./PayloadEnvelope.js";

const sameRecipientSnapshot = (
	left: Schema.Schema.Type<typeof PayloadRecipient>,
	right: Schema.Schema.Type<typeof PayloadRecipient>,
) =>
	left.displayName === right.displayName &&
	left.identityUpdatedAt === right.identityUpdatedAt &&
	left.ownerId === right.ownerId &&
	left.publicKey === right.publicKey;

export const toPayloadRecipient = (
	identity: Pick<
		KnownIdentity,
		"displayName" | "identityUpdatedAt" | "ownerId" | "publicKey"
	>,
): Schema.Schema.Type<typeof PayloadRecipient> => ({
	displayName: identity.displayName,
	identityUpdatedAt: identity.identityUpdatedAt,
	ownerId: identity.ownerId,
	publicKey: identity.publicKey,
});

export type GrantRecipientDecision =
	| {
			readonly _tag: "add";
			readonly nextRecipients: ReadonlyArray<
				Schema.Schema.Type<typeof PayloadRecipient>
			>;
			readonly recipient: Schema.Schema.Type<typeof PayloadRecipient>;
	  }
	| {
			readonly _tag: "replace";
			readonly nextRecipients: ReadonlyArray<
				Schema.Schema.Type<typeof PayloadRecipient>
			>;
			readonly recipient: Schema.Schema.Type<typeof PayloadRecipient>;
	  }
	| {
			readonly _tag: "unchanged-identical";
			readonly recipient: Schema.Schema.Type<typeof PayloadRecipient>;
	  }
	| {
			readonly _tag: "unchanged-outdated-input";
			readonly providedRecipient: Schema.Schema.Type<typeof PayloadRecipient>;
			readonly recipient: Schema.Schema.Type<typeof PayloadRecipient>;
	  };

export const decideGrantRecipient = (input: {
	readonly currentRecipients: ReadonlyArray<
		Schema.Schema.Type<typeof PayloadRecipient>
	>;
	readonly targetIdentity: KnownIdentity;
}): GrantRecipientDecision => {
	const targetRecipient = toPayloadRecipient(input.targetIdentity);
	const existingIndex = input.currentRecipients.findIndex(
		(recipient) => recipient.ownerId === input.targetIdentity.ownerId,
	);

	if (existingIndex === -1) {
		return {
			_tag: "add",
			nextRecipients: [...input.currentRecipients, targetRecipient],
			recipient: targetRecipient,
		};
	}

	const existingRecipient = input.currentRecipients[existingIndex];

	if (existingRecipient === undefined) {
		return {
			_tag: "add",
			nextRecipients: [...input.currentRecipients, targetRecipient],
			recipient: targetRecipient,
		};
	}

	if (sameRecipientSnapshot(existingRecipient, targetRecipient)) {
		return {
			_tag: "unchanged-identical",
			recipient: existingRecipient,
		};
	}

	if (existingRecipient.identityUpdatedAt > targetRecipient.identityUpdatedAt) {
		return {
			_tag: "unchanged-outdated-input",
			providedRecipient: targetRecipient,
			recipient: existingRecipient,
		};
	}

	return {
		_tag: "replace",
		nextRecipients: input.currentRecipients.map((recipient) =>
			recipient.ownerId === targetRecipient.ownerId
				? targetRecipient
				: recipient,
		),
		recipient: targetRecipient,
	};
};

export type RevokeRecipientDecision =
	| {
			readonly _tag: "forbidden-self";
	  }
	| {
			readonly _tag: "remove";
			readonly nextRecipients: ReadonlyArray<
				Schema.Schema.Type<typeof PayloadRecipient>
			>;
	  }
	| {
			readonly _tag: "unchanged-absent";
	  };

export const decideRevokeRecipient = (input: {
	readonly currentRecipients: ReadonlyArray<
		Schema.Schema.Type<typeof PayloadRecipient>
	>;
	readonly selfOwnerId: KnownIdentity["ownerId"] | null;
	readonly targetOwnerId: KnownIdentity["ownerId"];
}): RevokeRecipientDecision => {
	if (input.selfOwnerId !== null && input.targetOwnerId === input.selfOwnerId) {
		return {
			_tag: "forbidden-self",
		};
	}

	const isPresent = input.currentRecipients.some(
		(recipient) => recipient.ownerId === input.targetOwnerId,
	);

	if (!isPresent) {
		return {
			_tag: "unchanged-absent",
		};
	}

	return {
		_tag: "remove",
		nextRecipients: input.currentRecipients.filter(
			(recipient) => recipient.ownerId !== input.targetOwnerId,
		),
	};
};
