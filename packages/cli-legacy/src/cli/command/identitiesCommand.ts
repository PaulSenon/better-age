import { Command } from "@effect/cli";
import { Effect, Option } from "effect";
import { InspectHomeIdentities } from "../../app/inspect-home-identities/InspectHomeIdentities.js";
import { InspectHomeIdentitiesPersistenceError } from "../../app/inspect-home-identities/InspectHomeIdentitiesError.js";
import { Prompt } from "../../port/Prompt.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class IdentitiesCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "identities",
			name: "IdentitiesCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const shortenFingerprint = (value: string) => value.slice(0, 12);
const shortenOwnerId = (value: string) =>
	`${value.slice(0, "bsid1_".length)}${value.slice("bsid1_".length, "bsid1_".length + 8)}`;

const renderMeSection = (
	me: Option.Option<{
		readonly displayName: string;
		readonly fingerprint: string;
		readonly handle: string;
		readonly identityUpdatedAt: string;
		readonly ownerId: string;
		readonly rotationStatus: {
			readonly dueAt: string;
			readonly isOverdue: boolean;
		};
		readonly rotationTtl: string;
		readonly status: "active";
	}>,
	retiredKeyCount: number,
) =>
	Option.match(me, {
		onNone: () =>
			["Me", "not configured", `retired keys: ${retiredKeyCount}`].join("\n"),
		onSome: (identity) =>
			[
				"Me",
				`display name: ${identity.displayName}`,
				`handle: ${identity.handle}`,
				`owner id: ${shortenOwnerId(identity.ownerId)}`,
				`fingerprint: ${shortenFingerprint(identity.fingerprint)}`,
				`identity updated at: ${identity.identityUpdatedAt}`,
				`status: ${identity.status}`,
				`rotation ttl: ${identity.rotationTtl}`,
				`rotation due: ${identity.rotationStatus.dueAt}${identity.rotationStatus.isOverdue ? " (overdue)" : ""}`,
				`retired keys: ${retiredKeyCount}`,
			].join("\n"),
	});

const renderKnownIdentitiesSection = (
	knownIdentities: ReadonlyArray<{
		readonly displayName: string;
		readonly fingerprint: string;
		readonly handle: string;
		readonly identityUpdatedAt: string;
		readonly localAlias: Option.Option<string>;
	}>,
) =>
	[
		"Known identities",
		...(knownIdentities.length === 0
			? ["none"]
			: knownIdentities.map((identity) => {
					const prefix = Option.match(identity.localAlias, {
						onNone: () => "",
						onSome: (alias) => `${alias}: `,
					});

					return `${prefix}${identity.displayName} (${identity.handle}) ${shortenFingerprint(identity.fingerprint)} ${identity.identityUpdatedAt}`;
				})),
	].join("\n");

const renderRetiredKeysSection = (
	retiredKeys: ReadonlyArray<{
		readonly fingerprint: string;
		readonly retiredAt: string;
	}>,
) =>
	[
		"Retired local keys",
		...(retiredKeys.length === 0
			? ["none"]
			: retiredKeys.map(
					(key) => `${shortenFingerprint(key.fingerprint)} ${key.retiredAt}`,
				)),
	].join("\n");

export const runIdentities = () =>
	Effect.gen(function* () {
		const inspection = yield* InspectHomeIdentities.execute;
		const output = [
			renderMeSection(inspection.me, inspection.retiredKeyCount),
			renderKnownIdentitiesSection(inspection.knownIdentities),
			renderRetiredKeysSection(inspection.retiredKeys),
			"",
		].join("\n\n");

		yield* Prompt.writeStdout(output);
	}).pipe(
		Effect.catchIf(
			(error): error is InspectHomeIdentitiesPersistenceError =>
				error instanceof InspectHomeIdentitiesPersistenceError,
			() =>
				asCommandFailure(
					new IdentitiesCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.INSPECT_FAILED",
					}),
				),
		),
	);

export const identitiesCommand = Command.make("identities", {}, () =>
	runIdentities(),
);
