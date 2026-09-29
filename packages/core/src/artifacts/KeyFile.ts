// Decrypted local key file: an age identity file whose first comment line
// carries Better Age metadata, so `age -d -i <file>` also works on it.
//
//   # better-age-key-metadata/v1 <base64url(JSON metadata)>
//   AGE-SECRET-KEY-...
import { Encoding, Result, Schema } from "effect";
import { PrivateKeyInvalid } from "../Errors.js";

const metadataPrefix = "# better-age-key-metadata/v1 ";

const KeyMetadata = Schema.Struct({
	kind: Schema.Literal("better-age/key-metadata"),
	version: Schema.Literal(1),
	ownerId: Schema.String,
	publicKey: Schema.String,
	fingerprint: Schema.String,
	createdAt: Schema.String,
});

/** An unlocked private key. Never leaves Core. */
export type LocalKey = {
	readonly ownerId: string;
	readonly publicKey: string;
	readonly privateKey: string;
	readonly fingerprint: string;
	readonly createdAt: string;
};

export const encodeKeyFile = (key: LocalKey): string =>
	[
		`${metadataPrefix}${Encoding.encodeBase64Url(
			JSON.stringify({
				kind: "better-age/key-metadata",
				version: 1,
				ownerId: key.ownerId,
				publicKey: key.publicKey,
				fingerprint: key.fingerprint,
				createdAt: key.createdAt,
			}),
		)}`,
		key.privateKey,
		"",
	].join("\n");

export const decodeKeyFile = (
	text: string,
): Result.Result<LocalKey, PrivateKeyInvalid> => {
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	const metadataLine = lines[0];
	const identityLines = lines.filter((line) => !line.startsWith("#"));
	const privateKey = identityLines[0];

	if (
		metadataLine?.startsWith(metadataPrefix) !== true ||
		identityLines.length !== 1 ||
		privateKey === undefined
	) {
		return Result.fail(new PrivateKeyInvalid());
	}

	return Encoding.decodeBase64UrlString(
		metadataLine.slice(metadataPrefix.length),
	).pipe(
		Result.flatMap(
			Schema.decodeUnknownResult(Schema.fromJsonString(KeyMetadata)),
		),
		Result.map((metadata) => ({
			ownerId: metadata.ownerId,
			publicKey: metadata.publicKey,
			privateKey,
			fingerprint: metadata.fingerprint,
			createdAt: metadata.createdAt,
		})),
		Result.mapError(() => new PrivateKeyInvalid()),
	);
};
