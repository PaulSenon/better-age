import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import { InspectHomeIdentities } from "../../app/inspect-home-identities/InspectHomeIdentities.js";
import { InspectHomeIdentitiesPersistenceError } from "../../app/inspect-home-identities/InspectHomeIdentitiesError.js";
import { DisplayName } from "../../domain/identity/DisplayName.js";
import { Handle } from "../../domain/identity/Handle.js";
import { IdentityAlias } from "../../domain/identity/IdentityAlias.js";
import { IdentityUpdatedAt } from "../../domain/identity/IdentityUpdatedAt.js";
import { KeyFingerprint } from "../../domain/identity/KeyFingerprint.js";
import { OwnerId } from "../../domain/identity/OwnerId.js";
import { Prompt } from "../../port/Prompt.js";
import {
	IdentitiesCommandFailedError,
	identitiesCommand,
} from "./identitiesCommand.js";

const makePrompt = () => {
	const stdout: Array<string> = [];
	const stderr: Array<string> = [];

	return Object.assign(
		Prompt.make({
			inputSecret: () => Effect.die("unused"),
			inputSecretPairFromStdin: Effect.die("unused"),
			inputText: () => Effect.die("unused"),
			writeStderr: (text) =>
				Effect.sync(() => {
					stderr.push(text);
				}),
			writeStdout: (text) =>
				Effect.sync(() => {
					stdout.push(text);
				}),
		}),
		{
			stderr,
			stdout,
		},
	);
};

const localAlias = Schema.decodeUnknownSync(IdentityAlias)("paul-work");
const knownDisplayName = Schema.decodeUnknownSync(DisplayName)("paul");
const knownFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_abcdef0123456789",
);
const knownHandle = Schema.decodeUnknownSync(Handle)("paul#abcdef01");
const knownIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2026-02-01T00:00:00.000Z",
);
const selfDisplayName = Schema.decodeUnknownSync(DisplayName)("isaac-mbp");
const selfFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_0123456789abcdef",
);
const selfHandle = Schema.decodeUnknownSync(Handle)("isaac-mbp#069f7576");
const selfIdentityUpdatedAt = Schema.decodeUnknownSync(IdentityUpdatedAt)(
	"2020-01-01T00:00:00.000Z",
);
const selfOwnerId = Schema.decodeUnknownSync(OwnerId)("bsid1_069f7576d2ab43ef");
const retiredFingerprint = Schema.decodeUnknownSync(KeyFingerprint)(
	"bs1_deadbeef01234567",
);

describe("identitiesCommand", () => {
	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectHomeIdentities,
				InspectHomeIdentities.make({
					execute: Effect.succeed({
						knownIdentities: [
							{
								displayName: knownDisplayName,
								fingerprint: knownFingerprint,
								handle: knownHandle,
								identityUpdatedAt: knownIdentityUpdatedAt,
								localAlias: Option.some(localAlias),
							},
						],
						me: Option.some({
							displayName: selfDisplayName,
							fingerprint: selfFingerprint,
							handle: selfHandle,
							identityUpdatedAt: selfIdentityUpdatedAt,
							ownerId: selfOwnerId,
							rotationStatus: {
								dueAt: "2020-04-01T00:00:00.000Z",
								isOverdue: true,
							},
							rotationTtl: "3m" as const,
							status: "active" as const,
						}),
						retiredKeyCount: 1,
						retiredKeys: [
							{
								fingerprint: retiredFingerprint,
								retiredAt: "2025-10-01T00:00:00.000Z",
							},
						],
						rotationTtl: "3m" as const,
					}),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("success", (it) => {
		it.effect("prints human-readable home identity sections", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([identitiesCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				yield* cli(["node", "bage", "identities"]);

				expect(
					(prompt as typeof prompt & { stdout: Array<string> }).stdout,
				).toEqual([
					[
						"Me",
						"display name: isaac-mbp",
						"handle: isaac-mbp#069f7576",
						"owner id: bsid1_069f7576",
						"fingerprint: bs1_01234567",
						"identity updated at: 2020-01-01T00:00:00.000Z",
						"status: active",
						"rotation ttl: 3m",
						"rotation due: 2020-04-01T00:00:00.000Z (overdue)",
						"retired keys: 1",
						"",
						"Known identities",
						"paul-work: paul (paul#abcdef01) bs1_abcdef01 2026-02-01T00:00:00.000Z",
						"",
						"Retired local keys",
						"bs1_deadbeef 2025-10-01T00:00:00.000Z",
						"",
						"",
					].join("\n"),
				]);
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([]);
			}),
		);
	});

	layer(
		Layer.mergeAll(
			NodeContext.layer,
			Layer.succeed(
				InspectHomeIdentities,
				InspectHomeIdentities.make({
					execute: Effect.fail(
						new InspectHomeIdentitiesPersistenceError({
							message: "Failed to load home state",
						}),
					),
				}),
			),
			Layer.sync(Prompt, () => makePrompt()),
		),
	)("failure", (it) => {
		it.effect("prints stderr and fails on persistence error", () =>
			Effect.gen(function* () {
				const prompt = yield* Prompt;
				const cli = Command.run(
					Command.make("bage").pipe(
						Command.withSubcommands([identitiesCommand]),
					),
					{
						name: "bage",
						version: "0.0.1",
					},
				);

				const result = yield* cli(["node", "bage", "identities"]).pipe(
					Effect.either,
				);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(IdentitiesCommandFailedError);
				}
				expect(
					(prompt as typeof prompt & { stderr: Array<string> }).stderr,
				).toEqual([
					["Failed to inspect local identities", "Retry", ""].join("\n"),
				]);
			}),
		);
	});
});
