import type {
	HomeStateDocumentV1,
	PayloadDocumentV1,
	PayloadPlaintextV1,
	PrivateKeyPlaintextV1,
	PublicIdentityDocumentV1,
} from "../../../src/persistence/ArtifactDocument.js";

export const validPublicIdentityDocumentV1 = {
	kind: "better-age/public-identity",
	version: 1,
	ownerId: "owner_123",
	displayName: "Isaac",
	publicKey: "age1current",
	identityUpdatedAt: "2026-04-25T10:00:00.000Z",
} satisfies PublicIdentityDocumentV1;

export const validHomeStateDocumentV1 = {
	kind: "better-age/home-state",
	version: 1,
	ownerId: "owner_123",
	displayName: "Isaac",
	identityUpdatedAt: "2026-04-25T10:00:00.000Z",
	currentKey: {
		publicKey: "age1current",
		fingerprint: "fp_current",
		encryptedPrivateKeyRef: "keys/fp_current.age",
		createdAt: "2026-04-25T10:00:00.000Z",
	},
	retiredKeys: [],
	knownIdentities: [],
	preferences: {
		rotationTtl: "3m",
	},
} satisfies HomeStateDocumentV1;

export const validPrivateKeyPlaintextV1 = {
	kind: "better-age/private-key",
	version: 1,
	ownerId: "owner_123",
	publicKey: "age1current",
	privateKey: "AGE-SECRET-KEY-1CURRENT",
	fingerprint: "fp_current",
	createdAt: "2026-04-25T10:00:00.000Z",
} satisfies PrivateKeyPlaintextV1;

export const validPayloadPlaintextV1 = {
	kind: "better-age/payload",
	version: 1,
	payloadId: "payload_123",
	createdAt: "2026-04-25T10:00:00.000Z",
	lastRewrittenAt: "2026-04-25T10:00:00.000Z",
	envText: "DATABASE_URL=postgres://localhost/app\n",
	recipients: [
		{
			ownerId: validPublicIdentityDocumentV1.ownerId,
			displayName: validPublicIdentityDocumentV1.displayName,
			publicKey: validPublicIdentityDocumentV1.publicKey,
			identityUpdatedAt: validPublicIdentityDocumentV1.identityUpdatedAt,
		},
	],
} satisfies PayloadPlaintextV1;

export const validPayloadDocumentV1 = {
	kind: "better-age/payload",
	version: 1,
	encryptedPayload: "age-encrypted-payload",
} satisfies PayloadDocumentV1;
