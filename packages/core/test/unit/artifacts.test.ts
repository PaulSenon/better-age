import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Option, Result } from "effect";
import { describe, expect, it } from "vitest";
import {
	decodeHomeState,
	encodeHomeState,
} from "../../src/artifacts/HomeState.js";
import { decodeKeyFile, encodeKeyFile } from "../../src/artifacts/KeyFile.js";
import {
	decodePayloadPlaintext,
	encodePayloadPlaintext,
	extractPayloadArmor,
	formatPayloadFile,
} from "../../src/artifacts/PayloadFile.js";
import {
	decodeIdentityString,
	encodeIdentityString,
} from "../../src/artifacts/PublicIdentity.js";

const fixtures = join(import.meta.dirname, "../fixtures/pre-v2");
const readFixture = (path: string) =>
	readFileSync(join(fixtures, path), "utf8");
const homeStateJson = readFixture("alice-home/home-state.json");
const identityStrings = JSON.parse(readFixture("identity-strings.json")) as {
	readonly alice: string;
	readonly bob: string;
};

const failureTag = <E extends { readonly _tag: string }>(
	result: Result.Result<unknown, E>,
) => (Result.isFailure(result) ? result.failure._tag : "success");

describe("home state codec", () => {
	it("re-encodes a pre-V2 home state byte-for-byte", () => {
		const decoded = decodeHomeState(JSON.parse(homeStateJson));

		expect(Result.isSuccess(decoded)).toBe(true);
		if (Result.isSuccess(decoded)) {
			expect(decoded.success.migrated).toBe(false);
			expect(encodeHomeState(decoded.success.homeState)).toBe(homeStateJson);
		}
	});

	it("migrates v1 to v2 with no editor preference", () => {
		const current = JSON.parse(homeStateJson);
		const v1 = {
			...current,
			version: 1,
			preferences: { rotationTtl: current.preferences.rotationTtl },
		};
		const decoded = decodeHomeState(v1);

		expect(decoded).toEqual(
			Result.succeed({
				homeState: current,
				migrated: true,
			}),
		);
	});

	it("separates too-new versions from invalid documents", () => {
		const current = JSON.parse(homeStateJson);

		expect(failureTag(decodeHomeState({ ...current, version: 3 }))).toBe(
			"ARTIFACT_UNSUPPORTED_VERSION",
		);
		for (const invalid of [
			null,
			"text",
			{ ...current, version: 0 },
			{ ...current, version: "2" },
			{ ...current, kind: "better-age/payload" },
			{ ...current, ownerId: undefined },
			{
				...current,
				currentKey: {
					...current.currentKey,
					encryptedPrivateKeyRef: "../outside.age",
				},
			},
		]) {
			expect(failureTag(decodeHomeState(invalid))).toBe("HOME_STATE_INVALID");
		}
	});
});

describe("identity string codec", () => {
	it("re-encodes pre-V2 identity strings exactly", () => {
		for (const identityString of Object.values(identityStrings)) {
			const decoded = decodeIdentityString(identityString);

			expect(Result.isSuccess(decoded)).toBe(true);
			if (Result.isSuccess(decoded)) {
				expect(encodeIdentityString(decoded.success)).toBe(identityString);
			}
		}
	});

	it("rejects malformed identity strings", () => {
		const document = (fields: object) =>
			`better-age://identity/v1/${Buffer.from(JSON.stringify(fields)).toString("base64url")}`;
		const valid = {
			kind: "better-age/public-identity",
			version: 1,
			ownerId: "owner_1",
			displayName: "Sarah",
			publicKey: "age1sarah",
			identityUpdatedAt: "2026-01-01T00:00:00.000Z",
		};

		expect(Result.isSuccess(decodeIdentityString(document(valid)))).toBe(true);
		for (const invalid of [
			"",
			"age1notanidentitystring",
			"better-age://identity/v1/",
			"better-age://identity/v1/not base64",
			`better-age://identity/v1/${Buffer.from("not json").toString("base64url")}`,
			document({ ...valid, version: 2 }),
			document({ ...valid, kind: "better-age/home-state" }),
			document({ ...valid, publicKey: 42 }),
		]) {
			expect(failureTag(decodeIdentityString(invalid))).toBe(
				"IDENTITY_STRING_INVALID",
			);
		}
	});
});

describe("key file codec", () => {
	const key = {
		ownerId: "owner_1",
		publicKey: "age1pub",
		privateKey: "AGE-SECRET-KEY-1ABC",
		fingerprint: "fp_0123456789abcdef",
		createdAt: "2026-01-01T00:00:00.000Z",
	};

	it("writes an age identity file with a metadata comment", () => {
		const text = encodeKeyFile(key);

		expect(text.split("\n")[0]).toMatch(/^# better-age-key-metadata\/v1 \S+$/);
		expect(text.split("\n")[1]).toBe("AGE-SECRET-KEY-1ABC");
		expect(decodeKeyFile(text)).toEqual(Result.succeed(key));
	});

	it("rejects files without metadata or with ambiguous identity lines", () => {
		const text = encodeKeyFile(key);

		for (const invalid of [
			"AGE-SECRET-KEY-1ABC\n",
			`${text}AGE-SECRET-KEY-1OTHER\n`,
			text.split("\n")[0] ?? "",
			"# better-age-key-metadata/v1 bm90IGpzb24\nAGE-SECRET-KEY-1ABC\n",
			JSON.stringify({ kind: "better-age/private-key", ...key }),
		]) {
			expect(failureTag(decodeKeyFile(invalid))).toBe("PRIVATE_KEY_INVALID");
		}
	});
});

describe("payload file", () => {
	const armor =
		"-----BEGIN AGE ENCRYPTED FILE-----\nYWdl\n-----END AGE ENCRYPTED FILE-----";

	it("wraps age armor in a readable envelope and extracts it untouched", () => {
		const file = formatPayloadFile(armor);

		expect(file).toContain("# better-age encrypted env payload");
		expect(extractPayloadArmor(file)).toEqual(Option.some(armor));
		expect(Option.isSome(extractPayloadArmor(readFixture(".env.enc")))).toBe(
			true,
		);
	});

	it("rejects missing, duplicated, or non-age blocks", () => {
		const file = formatPayloadFile(armor);

		for (const invalid of [
			"",
			armor,
			`${file}${file}`,
			file.replace("BEGIN AGE ENCRYPTED FILE", "BEGIN PGP MESSAGE"),
			file.replace("-----BEGIN BETTER AGE PAYLOAD-----", ""),
		]) {
			expect(extractPayloadArmor(invalid)).toEqual(Option.none());
		}
	});

	it("decodes only current payload plaintext documents", () => {
		const plaintext = {
			kind: "better-age/payload" as const,
			version: 1 as const,
			payloadId: "payload_1",
			createdAt: "t0",
			lastRewrittenAt: "t1",
			envText: "anything at all\n",
			recipients: [],
		};

		expect(decodePayloadPlaintext(encodePayloadPlaintext(plaintext))).toEqual(
			Option.some(plaintext),
		);
		expect(decodePayloadPlaintext("not json")).toEqual(Option.none());
		expect(
			decodePayloadPlaintext(JSON.stringify({ ...plaintext, version: 2 })),
		).toEqual(Option.none());
	});
});
