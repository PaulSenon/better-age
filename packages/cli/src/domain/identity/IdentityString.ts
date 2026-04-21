import { Either, Encoding, Schema } from "effect";
import { DisplayName } from "./DisplayName.js";
import { Handle } from "./Handle.js";
import { IdentityUpdatedAt } from "./IdentityUpdatedAt.js";
import { KeyFingerprint } from "./KeyFingerprint.js";
import { OwnerId } from "./OwnerId.js";
import { PublicKey } from "./PublicKey.js";

export class IdentityStringDecodeError extends Schema.TaggedError<IdentityStringDecodeError>()(
	"IdentityStringDecodeError",
	{
		message: Schema.String,
	},
) {}

export const IdentityString = Schema.String.pipe(
	Schema.pattern(/^better-age:\/\/identity\/v1\/[A-Za-z0-9_-]+$/),
	Schema.brand("@better-age/IdentityString"),
);

export type IdentityString = Schema.Schema.Type<typeof IdentityString>;

export const IdentityStringPayload = Schema.Struct({
	displayName: DisplayName,
	fingerprint: KeyFingerprint,
	handle: Handle,
	identityUpdatedAt: IdentityUpdatedAt,
	ownerId: OwnerId,
	publicKey: PublicKey,
	version: Schema.Literal("v1"),
});

export type IdentityStringPayload = Schema.Schema.Type<
	typeof IdentityStringPayload
>;

const prefix = "better-age://identity/v1/";

export const encodeIdentityString = (
	payload: IdentityStringPayload,
): IdentityString =>
	Schema.decodeUnknownSync(IdentityString)(
		`${prefix}${Encoding.encodeBase64Url(JSON.stringify(payload))}`,
	);

export const decodeIdentityString = (
	identityString: string,
): Either.Either<IdentityStringPayload, unknown> => {
	if (!identityString.startsWith(prefix)) {
		return Either.left(
			new IdentityStringDecodeError({
				message: "Identity string must use the v1 prefix",
			}),
		);
	}

	return Either.try({
		try: () => identityString.slice(prefix.length),
		catch: (cause) => cause,
	}).pipe(
		Either.flatMap(Encoding.decodeBase64UrlString),
		Either.flatMap((json) =>
			Schema.decodeUnknownEither(Schema.parseJson(IdentityStringPayload))(json),
		),
	);
};
