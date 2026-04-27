import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, Schema } from "effect";
import { BetterAgeConfig } from "../../port/BetterAgeConfig.js";
import { BetterAgeConfigError } from "../../port/BetterAgeConfigError.js";

const DEFAULT_DIRECTORY_NAME = "better-age";

const decodeExplicitHomeDirectory = (key: string, value: unknown) =>
	Schema.decodeUnknown(Schema.NonEmptyTrimmedString)(value).pipe(
		Effect.mapError(
			() =>
				new BetterAgeConfigError({
					key,
					message: `${key} must be a non-empty trimmed string when set`,
				}),
		),
	);

const resolveHomeRootDirectory = Effect.fn(
	"BetterAgeConfig.resolveHomeRootDirectory",
)(function* () {
	const explicit = process.env.BETTER_AGE_HOME;

	if (explicit !== undefined) {
		return yield* decodeExplicitHomeDirectory("BETTER_AGE_HOME", explicit);
	}

	const xdgConfigHome = process.env.XDG_CONFIG_HOME;

	if (xdgConfigHome !== undefined) {
		const decoded = yield* decodeExplicitHomeDirectory(
			"XDG_CONFIG_HOME",
			xdgConfigHome,
		);
		return join(decoded, DEFAULT_DIRECTORY_NAME);
	}

	return join(homedir(), ".config", DEFAULT_DIRECTORY_NAME);
});

export const NodeBetterAgeConfigLive = Layer.effect(
	BetterAgeConfig,
	Effect.gen(function* () {
		const homeRootDirectory = yield* resolveHomeRootDirectory();
		return BetterAgeConfig.make({
			homeRootDirectory,
		});
	}),
);
