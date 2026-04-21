import { Option, Schema } from "effect";
import type { GeneratedIdentity } from "../../port/Crypto.js";
import type { SelfIdentity } from "../identity/Identity.js";
import {
	PrivateKeyRelativePath,
	type PrivateKeyRelativePath as PrivateKeyRelativePathType,
} from "../identity/PrivateKeyRelativePath.js";
import { derivePublicIdentityFingerprint } from "../identity/PublicIdentity.js";
import type { HomeState } from "./HomeState.js";

export const toRetiredPrivateKeyPath = (fingerprint: string) =>
	Schema.decodeUnknownSync(PrivateKeyRelativePath)(
		`keys/retired/${fingerprint}.key.age`,
	);

export const buildRotatedHomeState = (input: {
	readonly now: string;
	readonly previousState: HomeState;
	readonly privateKeyPath: PrivateKeyRelativePathType;
	readonly rotatedIdentity: GeneratedIdentity;
}) => {
	const selfIdentity = input.previousState.self.pipe(Option.getOrUndefined) as
		| SelfIdentity
		| undefined;

	if (selfIdentity === undefined) {
		throw new Error(
			"Active self identity is required to build rotated home state",
		);
	}

	return {
		...input.previousState,
		activeKeyFingerprint: Option.some(input.rotatedIdentity.fingerprint),
		retiredKeys: [
			{
				fingerprint: derivePublicIdentityFingerprint(
					selfIdentity.publicIdentity,
				),
				privateKeyPath: toRetiredPrivateKeyPath(
					derivePublicIdentityFingerprint(selfIdentity.publicIdentity),
				),
				retiredAt: input.now,
			},
			...input.previousState.retiredKeys,
		],
		self: Option.some({
			...selfIdentity,
			privateKeyPath: input.privateKeyPath,
			publicIdentity: {
				...selfIdentity.publicIdentity,
				identityUpdatedAt: input.rotatedIdentity.identityUpdatedAt,
				ownerId: input.rotatedIdentity.ownerId,
				publicKey: input.rotatedIdentity.publicKey,
			},
		}),
	} satisfies HomeState;
};
