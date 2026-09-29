// Shareable identity string: `better-age://identity/v1/<base64url(JSON)>`.
import { Encoding, Result, Schema } from "effect";
import { IdentityStringInvalid } from "../Errors.js";

/** Public identity as persisted in identity strings and payload recipients. */
export const PublicIdentity = Schema.Struct({
	ownerId: Schema.String,
	displayName: Schema.String,
	publicKey: Schema.String,
	identityUpdatedAt: Schema.String,
});

export type PublicIdentity = typeof PublicIdentity.Type;

const PublicIdentityDocument = Schema.Struct({
	kind: Schema.Literal("better-age/public-identity"),
	version: Schema.Literal(1),
	...PublicIdentity.fields,
});

const identityStringPattern =
	/^better-age:\/\/identity\/v\d+\/(?<payload>[A-Za-z0-9_-]+)$/;

export const encodeIdentityString = (identity: PublicIdentity): string =>
	`better-age://identity/v1/${Encoding.encodeBase64Url(
		JSON.stringify({
			kind: "better-age/public-identity",
			version: 1,
			ownerId: identity.ownerId,
			displayName: identity.displayName,
			publicKey: identity.publicKey,
			identityUpdatedAt: identity.identityUpdatedAt,
		}),
	)}`;

export const decodeIdentityString = (
	identityString: string,
): Result.Result<PublicIdentity, IdentityStringInvalid> => {
	const payload = identityString.match(identityStringPattern)?.groups?.payload;

	if (payload === undefined) {
		return Result.fail(new IdentityStringInvalid());
	}

	return Encoding.decodeBase64UrlString(payload).pipe(
		Result.flatMap(
			Schema.decodeUnknownResult(Schema.fromJsonString(PublicIdentityDocument)),
		),
		Result.map(
			(document): PublicIdentity => ({
				ownerId: document.ownerId,
				displayName: document.displayName,
				publicKey: document.publicKey,
				identityUpdatedAt: document.identityUpdatedAt,
			}),
		),
		Result.mapError(() => new IdentityStringInvalid()),
	);
};
