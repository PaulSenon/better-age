import { Option, type Schema } from "effect";
import type { PayloadRecipient } from "../payload/PayloadEnvelope.js";
import {
	type LocalAliasMap,
	materializeKnownIdentity,
	materializeSelfIdentity,
	type KnownIdentity,
	type ResolvedKnownIdentity,
	type SelfIdentity,
} from "./Identity.js";
import { decodeIdentityString } from "./IdentityString.js";

type IdentityRefResolution =
	| {
			readonly _tag: "resolved";
			readonly identity: ResolvedKnownIdentity;
	  }
	| {
			readonly _tag: "ambiguous";
			readonly candidates: ReadonlyArray<ResolvedKnownIdentity["handle"]>;
	  }
	| {
			readonly _tag: "not-found";
	  };

type RevokeIdentityRefResolution =
	| {
			readonly _tag: "resolved";
			readonly ownerId: KnownIdentity["ownerId"];
	  }
	| {
			readonly _tag: "ambiguous";
			readonly candidates: ReadonlyArray<ResolvedKnownIdentity["handle"]>;
	  }
	| {
			readonly _tag: "not-found";
	  };

const toKnownIdentityFromSelf = (
	selfIdentity: SelfIdentity,
): ResolvedKnownIdentity => ({
	...materializeSelfIdentity(selfIdentity),
	localAlias: Option.none(),
});

const toKnownIdentityFromIdentityString = (
	identityString: string,
): ResolvedKnownIdentity | null => {
	const decoded = decodeIdentityString(identityString);

	if (decoded._tag === "Left") {
		return null;
	}

	return materializeKnownIdentity({
		identity: {
			displayName: decoded.right.displayName,
			identityUpdatedAt: decoded.right.identityUpdatedAt,
			ownerId: decoded.right.ownerId,
			publicKey: decoded.right.publicKey,
		},
		localAliases: {},
	});
};

const matchLocalAlias = (
	identityRef: string,
	identities: ReadonlyArray<ResolvedKnownIdentity>,
): IdentityRefResolution | null => {
	const matches = identities.filter(
		(identity) =>
			Option.isSome(identity.localAlias) &&
			identity.localAlias.value === identityRef,
	);

	if (matches.length === 0) {
		return null;
	}

	if (matches.length === 1) {
		const identity = matches[0];

		if (identity !== undefined) {
			return {
				_tag: "resolved",
				identity,
			};
		}
	}

	return {
		_tag: "ambiguous",
		candidates: matches.map((identity) => identity.handle),
	};
};

const matchHandle = (
	identityRef: string,
	identities: ReadonlyArray<ResolvedKnownIdentity>,
): IdentityRefResolution | null => {
	const matches = identities.filter(
		(identity) => identity.handle === identityRef,
	);

	if (matches.length === 0) {
		return null;
	}

	if (matches.length === 1) {
		const identity = matches[0];

		if (identity !== undefined) {
			return {
				_tag: "resolved",
				identity,
			};
		}
	}

	return {
		_tag: "ambiguous",
		candidates: matches.map((identity) => identity.handle),
	};
};

const matchDisplayName = (
	identityRef: string,
	identities: ReadonlyArray<ResolvedKnownIdentity>,
): IdentityRefResolution => {
	const matches = identities.filter(
		(identity) => identity.displayName === identityRef,
	);

	if (matches.length === 0) {
		return {
			_tag: "not-found",
		};
	}

	if (matches.length === 1) {
		const identity = matches[0];

		if (identity !== undefined) {
			return {
				_tag: "resolved",
				identity,
			};
		}
	}

	return {
		_tag: "ambiguous",
		candidates: matches.map((identity) => identity.handle),
	};
};

export const resolveGrantIdentityRef = (input: {
	readonly identityRef: string;
	readonly knownIdentities: ReadonlyArray<KnownIdentity>;
	readonly localAliases: LocalAliasMap;
	readonly selfIdentity: Option.Option<SelfIdentity>;
}): IdentityRefResolution => {
	const decodedIdentity = toKnownIdentityFromIdentityString(input.identityRef);

	if (decodedIdentity !== null) {
		return {
			_tag: "resolved",
			identity: decodedIdentity,
		};
	}

	const identities = [
		...input.knownIdentities.map((identity) =>
			materializeKnownIdentity({
				identity,
				localAliases: input.localAliases,
			}),
		),
		...(Option.isSome(input.selfIdentity)
			? [toKnownIdentityFromSelf(input.selfIdentity.value)]
			: []),
	];

	return (
		matchLocalAlias(input.identityRef, identities) ??
		matchHandle(input.identityRef, identities) ??
		matchDisplayName(input.identityRef, identities)
	);
};

const toKnownIdentityFromPayloadRecipient = (input: {
	readonly knownIdentities: ReadonlyArray<KnownIdentity>;
	readonly localAliases: LocalAliasMap;
	readonly recipient: Schema.Schema.Type<typeof PayloadRecipient>;
	readonly selfIdentity: Option.Option<SelfIdentity>;
}): ResolvedKnownIdentity => {
	if (
		Option.isSome(input.selfIdentity) &&
		input.selfIdentity.value.publicIdentity.ownerId === input.recipient.ownerId
	) {
		return toKnownIdentityFromSelf(input.selfIdentity.value);
	}

	const knownIdentity = input.knownIdentities.find(
		(identity) => identity.ownerId === input.recipient.ownerId,
	);

	return materializeKnownIdentity({
		identity:
			knownIdentity ?? {
				displayName: input.recipient.displayName,
				identityUpdatedAt: input.recipient.identityUpdatedAt,
				ownerId: input.recipient.ownerId,
				publicKey: input.recipient.publicKey,
			},
		localAliases: input.localAliases,
	});
};

export const resolveRevokeIdentityRef = (input: {
	readonly identityRef: string;
	readonly knownIdentities: ReadonlyArray<KnownIdentity>;
	readonly localAliases: LocalAliasMap;
	readonly payloadRecipients: ReadonlyArray<
		Schema.Schema.Type<typeof PayloadRecipient>
	>;
	readonly selfIdentity: Option.Option<SelfIdentity>;
}): RevokeIdentityRefResolution => {
	const payloadCandidates = input.payloadRecipients.map((recipient) =>
		toKnownIdentityFromPayloadRecipient({
			knownIdentities: input.knownIdentities,
			localAliases: input.localAliases,
			recipient,
			selfIdentity: input.selfIdentity,
		}),
	);
	const decodedIdentity = toKnownIdentityFromIdentityString(input.identityRef);

	if (decodedIdentity !== null) {
		const payloadCandidate = payloadCandidates.find(
			(identity) => identity.ownerId === decodedIdentity.ownerId,
		);

		return payloadCandidate === undefined
			? {
					_tag: "not-found",
				}
			: {
					_tag: "resolved",
					ownerId: payloadCandidate.ownerId,
				};
	}

	const localAliasResolution = matchLocalAlias(
		input.identityRef,
		payloadCandidates,
	);

	if (localAliasResolution !== null) {
		return localAliasResolution._tag === "resolved"
			? {
					_tag: "resolved",
					ownerId: localAliasResolution.identity.ownerId,
				}
			: localAliasResolution;
	}

	const handleResolution = matchHandle(input.identityRef, payloadCandidates);

	if (handleResolution !== null) {
		return handleResolution._tag === "resolved"
			? {
					_tag: "resolved",
					ownerId: handleResolution.identity.ownerId,
				}
			: handleResolution;
	}

	const displayNameResolution = matchDisplayName(
		input.identityRef,
		payloadCandidates,
	);

	return displayNameResolution._tag === "resolved"
		? {
				_tag: "resolved",
				ownerId: displayNameResolution.identity.ownerId,
			}
		: displayNameResolution;
};
