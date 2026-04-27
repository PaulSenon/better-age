import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { emptyHomeState } from "../../domain/home/HomeState.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import {
	encodeIdentityString,
	IdentityStringPayload,
	toIdentityStringPayload,
} from "../../domain/identity/IdentityString.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { PublicKey } from "../../domain/identity/PublicKey.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { ExportIdentityString } from "./ExportIdentityString.js";

describe("ExportIdentityString", () => {
	const expectedIdentityString = encodeIdentityString(
		Schema.decodeUnknownSync(IdentityStringPayload)(
			toIdentityStringPayload({
				displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
				identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
					"2026-04-14T10:00:00.000Z",
				),
				ownerId: Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef"),
				publicKey: Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
			}),
		),
	);

	layer(
		Layer.provide(ExportIdentityString.Default, [
			Layer.succeed(
				HomeRepository,
				HomeRepository.make({
					deletePrivateKey: () => Effect.void,
					getActiveKey: Effect.succeed(Option.none()),
					getLocation: Effect.die("unused"),
					loadStateDocument: Effect.die("unused"),
					loadState: Effect.succeed({
						...emptyHomeState(),
						activeKeyFingerprint: Option.some(
							Schema.decodeUnknownSync(KeyFingerprint)("bs1_0123456789abcdef"),
						),
						self: Option.some({
							createdAt: "2026-04-14T10:00:00.000Z",
							keyMode: "pq-hybrid" as const,
							privateKeyPath: Schema.decodeUnknownSync(PrivateKeyRelativePath)(
								"keys/active.key.age",
							),
							publicIdentity: {
								displayName: Schema.decodeUnknownSync(DisplayName)("isaac-mbp"),
								identityUpdatedAt: Schema.decodeUnknownSync(IdentityUpdatedAt)(
									"2026-04-14T10:00:00.000Z",
								),
								ownerId: Schema.decodeUnknownSync(OwnerId)(
									"bsid1_069f7576d2ab43ef",
								),
								publicKey:
									Schema.decodeUnknownSync(PublicKey)("age1testrecipient"),
							},
						}),
					}),
					readPrivateKey: () => Effect.die("unused"),
					saveState: () => Effect.void,
					writePrivateKey: () => Effect.die("unused"),
					writePrivateKeyAtPath: () => Effect.die("unused"),
				}),
			),
		]),
	)("success", (it) => {
		it.effect(
			"exports the current self identity as the canonical identity string",
			() =>
				Effect.gen(function* () {
					const result = yield* ExportIdentityString.execute;

					expect(result).toBe(expectedIdentityString);
				}),
		);
	});
});
