import { Effect, Schema } from "effect";
import type { HomeState as CurrentHomeState } from "../../domain/home/HomeState.js";
import { emptyHomeState, HomeState } from "../../domain/home/HomeState.js";
import {
	CURRENT_HOME_SCHEMA_VERSION,
	normalizeHomeStateToCurrent,
	readHomeSchemaVersion,
	VersionedHomeStateDocument,
} from "../../domain/home/HomeStateMigration.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { HomeStateDecodeError } from "../../port/HomeRepositoryError.js";
import {
	HomeStatePreflightMissingPathError,
	HomeStatePreflightUnsupportedVersionError,
} from "./HomeStatePreflightError.js";

const decodeVersionedHomeStateDocument = (input: {
	readonly document: unknown;
	readonly stateFile: string;
}) =>
	Schema.decodeUnknown(VersionedHomeStateDocument)(input.document).pipe(
		Effect.mapError(
			() =>
				new HomeStateDecodeError({
					message: "Persisted home state did not match any supported schema",
					stateFile: input.stateFile,
				}),
		),
	);

const normalizeOrFail = (
	document: Schema.Schema.Type<typeof VersionedHomeStateDocument>,
) => {
	const result = normalizeHomeStateToCurrent({ document });

	switch (result._tag) {
		case "current":
		case "migrated":
			return Effect.succeed(result);
		case "unsupported-newer":
		case "hard-broken":
			return Effect.fail(
				new HomeStatePreflightUnsupportedVersionError({
					currentVersion: result.currentVersion,
					homeVersion: result.artifactVersion,
					message:
						"CLI is too old to open this managed home state. Update CLI to continue.",
				}),
			);
		case "missing-path":
			return Effect.fail(
				new HomeStatePreflightMissingPathError({
					currentVersion: result.currentVersion,
					homeVersion: result.artifactVersion,
					message:
						"CLI cannot migrate this managed home state because a migration step is missing.",
					missingFromVersion: result.missingFromVersion,
					missingToVersion: result.missingToVersion,
				}),
			);
	}
};

const toCurrentHomeState = (
	document: Schema.Schema.Type<typeof VersionedHomeStateDocument>,
) => document as CurrentHomeState;

const loadAndNormalizeHomeState = Effect.gen(function* () {
	const homeRepository = yield* HomeRepository;

	if (homeRepository.loadStateDocument === undefined) {
		return yield* homeRepository.loadState;
	}

	const location = yield* homeRepository.getLocation;
	const rawDocument = yield* homeRepository.loadStateDocument;

	if (rawDocument === null) {
		return emptyHomeState();
	}

	const detectedVersion = readHomeSchemaVersion(rawDocument);

	if (
		detectedVersion !== undefined &&
		detectedVersion > CURRENT_HOME_SCHEMA_VERSION
	) {
		return yield* new HomeStatePreflightUnsupportedVersionError({
			currentVersion: CURRENT_HOME_SCHEMA_VERSION,
			homeVersion: detectedVersion,
			message:
				"CLI is too old to open this managed home state. Update CLI to continue.",
		});
	}

	const decodedDocument = yield* decodeVersionedHomeStateDocument({
		document: rawDocument,
		stateFile: location.stateFile,
	});
	const normalized = yield* normalizeOrFail(decodedDocument);

	if (normalized._tag === "current") {
		return toCurrentHomeState(normalized.artifact);
	}

	const currentState = toCurrentHomeState(normalized.artifact);
	yield* homeRepository.saveState(currentState);
	return currentState;
}).pipe(Effect.withSpan("HomeStatePreflight.execute"));

export const withHomeStatePreflight = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		yield* HomeStatePreflight.execute;
		return yield* effect;
	});

export class HomeStatePreflight extends Effect.Service<HomeStatePreflight>()(
	"HomeStatePreflight",
	{
		accessors: true,
		effect: Effect.succeed({
			execute: loadAndNormalizeHomeState,
		}),
	},
) {}
