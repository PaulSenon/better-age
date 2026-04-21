import { Option, Schema } from "effect";
import type { GeneratedIdentity } from "../../port/Crypto.js";
import { toHandle } from "../identity/Handle.js";
import {
	PrivateKeyRelativePath,
	type PrivateKeyRelativePath as PrivateKeyRelativePathType,
} from "../identity/PrivateKeyRelativePath.js";
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
	const selfIdentity = input.previousState.self.pipe(Option.getOrUndefined);

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
				fingerprint: selfIdentity.fingerprint,
				privateKeyPath: toRetiredPrivateKeyPath(selfIdentity.fingerprint),
				retiredAt: input.now,
			},
			...input.previousState.retiredKeys,
		],
		self: Option.some({
			...selfIdentity,
			fingerprint: input.rotatedIdentity.fingerprint,
			handle: toHandle({
				displayName: selfIdentity.displayName,
				ownerId: input.rotatedIdentity.ownerId,
			}),
			identityUpdatedAt: input.rotatedIdentity.identityUpdatedAt,
			ownerId: input.rotatedIdentity.ownerId,
			privateKeyPath: input.privateKeyPath,
			publicKey: input.rotatedIdentity.publicKey,
		}),
	} satisfies HomeState;
};
