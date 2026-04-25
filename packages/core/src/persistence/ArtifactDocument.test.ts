import { Either } from "effect";
import { describe, expect, it } from "vitest";
import {
	validHomeStateDocumentV1,
	validPayloadDocumentV1,
	validPayloadPlaintextV1,
	validPrivateKeyPlaintextV1,
	validPublicIdentityDocumentV1,
} from "../../test/fixtures/artifacts/v1.js";
import {
	ArtifactDocumentInvalidError,
	ArtifactDocumentKindMismatchError,
	ArtifactDocumentMigrationPathMissingError,
	type ArtifactDocumentParseError,
	ArtifactDocumentUnsupportedVersionError,
	encodeHomeStateDocument,
	encodePayloadDocument,
	encodePayloadPlaintext,
	encodePrivateKeyPlaintext,
	encodePublicIdentityDocument,
	encodePublicIdentityString,
	migrateHomeStateDocument,
	migratePayloadDocument,
	migratePayloadPlaintext,
	migratePrivateKeyPlaintext,
	migratePublicIdentityDocument,
	parseHomeStateDocument,
	parsePayloadDocument,
	parsePayloadPlaintext,
	parsePrivateKeyPlaintext,
	parsePublicIdentityDocument,
	parsePublicIdentityString,
} from "./ArtifactDocument.js";

const getLeft = <R, L>(either: Either.Either<R, L>): L => {
	if (Either.isLeft(either)) {
		return either.left;
	}

	throw new Error("Expected Either.Left");
};

type ParserCase = {
	readonly artifact: string;
	readonly valid: Record<string, unknown>;
	readonly parse: (
		input: unknown,
	) => Either.Either<unknown, ArtifactDocumentParseError>;
	readonly missingField: string;
};

describe("ArtifactDocument", () => {
	it("parses and no-op migrates a current home-state document", () => {
		const parsed = Either.getOrThrow(
			parseHomeStateDocument(validHomeStateDocumentV1),
		);

		expect(parsed).toEqual(validHomeStateDocumentV1);
		expect(migrateHomeStateDocument(parsed)).toEqual({
			kind: "already-current",
			document: validHomeStateDocumentV1,
		});
	});

	it("parses and no-op migrates all current v1 artifact documents", () => {
		const privateKey = Either.getOrThrow(
			parsePrivateKeyPlaintext(validPrivateKeyPlaintextV1),
		);
		const payloadPlaintext = Either.getOrThrow(
			parsePayloadPlaintext(validPayloadPlaintextV1),
		);
		const payloadDocument = Either.getOrThrow(
			parsePayloadDocument(validPayloadDocumentV1),
		);
		const publicIdentity = Either.getOrThrow(
			parsePublicIdentityDocument(validPublicIdentityDocumentV1),
		);

		expect(migratePrivateKeyPlaintext(privateKey)).toEqual({
			kind: "already-current",
			document: validPrivateKeyPlaintextV1,
		});
		expect(migratePayloadPlaintext(payloadPlaintext)).toEqual({
			kind: "already-current",
			document: validPayloadPlaintextV1,
		});
		expect(migratePayloadDocument(payloadDocument)).toEqual({
			kind: "already-current",
			document: validPayloadDocumentV1,
		});
		expect(migratePublicIdentityDocument(publicIdentity)).toEqual({
			kind: "already-current",
			document: validPublicIdentityDocumentV1,
		});
	});

	it("classifies wrong kind, malformed version, missing fields, and future version", () => {
		const wrongKind = parseHomeStateDocument({
			...validHomeStateDocumentV1,
			kind: "better-age/payload",
		});
		const malformedVersion = parseHomeStateDocument({
			...validHomeStateDocumentV1,
			version: "1",
		});
		const missingField = parseHomeStateDocument({
			...validHomeStateDocumentV1,
			currentKey: undefined,
		});
		const futureVersion = parseHomeStateDocument({
			...validHomeStateDocumentV1,
			version: 2,
		});

		expect(getLeft(wrongKind)).toBeInstanceOf(
			ArtifactDocumentKindMismatchError,
		);
		expect(getLeft(malformedVersion)).toBeInstanceOf(
			ArtifactDocumentInvalidError,
		);
		expect(getLeft(missingField)).toBeInstanceOf(ArtifactDocumentInvalidError);
		expect(getLeft(futureVersion)).toBeInstanceOf(
			ArtifactDocumentUnsupportedVersionError,
		);
	});

	it("does not accept prototype schema versions without an explicit migration path", () => {
		const prototypeDocument = {
			...validHomeStateDocumentV1,
			version: 0,
		};

		expect(getLeft(parseHomeStateDocument(prototypeDocument))).toEqual(
			new ArtifactDocumentMigrationPathMissingError({
				artifact: "home-state",
				fromVersion: 0,
				toVersion: 1,
				message: "Artifact migration path is missing",
			}),
		);
	});

	it("classifies invalid artifact cases for every artifact parser", () => {
		const parserCases: ReadonlyArray<ParserCase> = [
			{
				artifact: "home-state",
				valid: validHomeStateDocumentV1,
				parse: parseHomeStateDocument,
				missingField: "currentKey",
			},
			{
				artifact: "private-key",
				valid: validPrivateKeyPlaintextV1,
				parse: parsePrivateKeyPlaintext,
				missingField: "privateKey",
			},
			{
				artifact: "payload-plaintext",
				valid: validPayloadPlaintextV1,
				parse: parsePayloadPlaintext,
				missingField: "envText",
			},
			{
				artifact: "payload-document",
				valid: validPayloadDocumentV1,
				parse: parsePayloadDocument,
				missingField: "encryptedPayload",
			},
			{
				artifact: "public-identity",
				valid: validPublicIdentityDocumentV1,
				parse: parsePublicIdentityDocument,
				missingField: "publicKey",
			},
		];

		for (const parserCase of parserCases) {
			expect(
				getLeft(parserCase.parse({ ...parserCase.valid, kind: "wrong-kind" })),
			).toBeInstanceOf(ArtifactDocumentKindMismatchError);
			expect(
				getLeft(parserCase.parse({ ...parserCase.valid, version: "1" })),
			).toBeInstanceOf(ArtifactDocumentInvalidError);
			expect(
				getLeft(
					parserCase.parse({
						...parserCase.valid,
						[parserCase.missingField]: undefined,
					}),
				),
			).toBeInstanceOf(ArtifactDocumentInvalidError);
			expect(
				getLeft(parserCase.parse({ ...parserCase.valid, version: 2 })),
			).toBeInstanceOf(ArtifactDocumentUnsupportedVersionError);
			expect(
				getLeft(parserCase.parse({ ...parserCase.valid, version: 0 })),
			).toEqual(
				new ArtifactDocumentMigrationPathMissingError({
					artifact: parserCase.artifact,
					fromVersion: 0,
					toVersion: 1,
					message: "Artifact migration path is missing",
				}),
			);
		}
	});

	it("encodes every v1 artifact document as parseable JSON", () => {
		expect(
			Either.getOrThrow(
				parseHomeStateDocument(
					JSON.parse(encodeHomeStateDocument(validHomeStateDocumentV1)),
				),
			),
		).toEqual(validHomeStateDocumentV1);
		expect(
			Either.getOrThrow(
				parsePrivateKeyPlaintext(
					JSON.parse(encodePrivateKeyPlaintext(validPrivateKeyPlaintextV1)),
				),
			),
		).toEqual(validPrivateKeyPlaintextV1);
		expect(
			Either.getOrThrow(
				parsePayloadPlaintext(
					JSON.parse(encodePayloadPlaintext(validPayloadPlaintextV1)),
				),
			),
		).toEqual(validPayloadPlaintextV1);
		expect(
			Either.getOrThrow(
				parsePayloadDocument(
					JSON.parse(encodePayloadDocument(validPayloadDocumentV1)),
				),
			),
		).toEqual(validPayloadDocumentV1);
		expect(
			Either.getOrThrow(
				parsePublicIdentityDocument(
					JSON.parse(
						encodePublicIdentityDocument(validPublicIdentityDocumentV1),
					),
				),
			),
		).toEqual(validPublicIdentityDocumentV1);
	});

	it("round-trips public identity document through the shareable identity string", () => {
		const identityString = encodePublicIdentityString(
			validPublicIdentityDocumentV1,
		);

		expect(identityString.startsWith("better-age://identity/v1/")).toBe(true);
		expect(
			Either.getOrThrow(parsePublicIdentityString(identityString)),
		).toEqual(validPublicIdentityDocumentV1);
	});
});
