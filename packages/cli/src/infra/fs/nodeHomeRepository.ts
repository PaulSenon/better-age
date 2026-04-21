import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Layer, Schema } from "effect";
import {
	emptyHomeState,
	getActiveKey,
	HomeState as HomeStateSchema,
} from "../../domain/home/HomeState.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import { BetterAgeConfig } from "../../port/BetterAgeConfig.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
	PrivateKeyDeleteError,
	PrivateKeyPathWriteError,
	PrivateKeyReadError,
	PrivateKeyWriteError,
} from "../../port/HomeRepositoryError.js";

const HomeStateJson = Schema.parseJson(HomeStateSchema);

const writeFileAtomically = async (targetPath: string, contents: string) => {
	const tempPath = `${targetPath}.tmp`;
	await fs.mkdir(dirname(targetPath), { recursive: true });
	await fs.writeFile(tempPath, contents, "utf8");
	await fs.rename(tempPath, targetPath);
};

export const makeNodeHomeRepository = (rootDirectory: string) => {
	const location = {
		keysDirectory: join(rootDirectory, "keys"),
		rootDirectory,
		stateFile: join(rootDirectory, "state.json"),
	} as const;

	const loadState = Effect.tryPromise({
		catch: () =>
			new HomeStateLoadError({
				message: "Failed to load home state",
				stateFile: location.stateFile,
			}),
		try: async (): Promise<string | null> => {
			try {
				return await fs.readFile(location.stateFile, "utf8");
			} catch (error) {
				if (
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					error.code === "ENOENT"
				) {
					return null;
				}

				throw error;
			}
		},
	}).pipe(
		Effect.flatMap((rawState) =>
			rawState === null
				? Effect.succeed(emptyHomeState())
				: Schema.decodeUnknown(HomeStateJson)(rawState).pipe(
						Effect.mapError(
							() =>
								new HomeStateDecodeError({
									message: "Persisted home state did not match schema",
									stateFile: location.stateFile,
								}),
						),
					),
		),
	);

	return HomeRepository.make({
		deletePrivateKey: (privateKeyPath) =>
			Effect.tryPromise({
				catch: () =>
					new PrivateKeyDeleteError({
						message: "Failed to delete private key file",
						privateKeyPath,
					}),
				try: async () => {
					const absolutePath = join(location.rootDirectory, privateKeyPath);
					await fs.rm(absolutePath, { force: true });
				},
			}),
		getActiveKey: Effect.flatMap(loadState, (state) =>
			Effect.succeed(getActiveKey(state)),
		),
		getLocation: Effect.succeed(location),
		loadState,
		readPrivateKey: (privateKeyPath) =>
			Effect.tryPromise({
				catch: () =>
					new PrivateKeyReadError({
						message: "Failed to read private key file",
						privateKeyPath,
					}),
				try: async () => {
					const absolutePath = join(location.rootDirectory, privateKeyPath);
					return await fs.readFile(absolutePath, "utf8");
				},
			}).pipe(Effect.map((contents) => contents as never)),
		saveState: (state) =>
			Schema.encode(HomeStateJson)(state).pipe(
				Effect.mapError(
					() =>
						new HomeStateSaveError({
							message: "Failed to encode home state for persistence",
							stateFile: location.stateFile,
						}),
				),
				Effect.flatMap((encodedState) =>
					Effect.tryPromise({
						catch: () =>
							new HomeStateSaveError({
								message: "Failed to save home state",
								stateFile: location.stateFile,
							}),
						try: async () => {
							await writeFileAtomically(location.stateFile, encodedState);
						},
					}),
				),
			),
		writePrivateKey: (fingerprint, contents) => {
			const relativePath = "keys/active.key.age";
			const absolutePath = join(location.rootDirectory, relativePath);

			return Effect.tryPromise({
				catch: () =>
					new PrivateKeyWriteError({
						fingerprint,
						message: "Failed to write private key file",
					}),
				try: async () => {
					await writeFileAtomically(absolutePath, contents);
				},
			}).pipe(
				Effect.flatMap(() =>
					Schema.decodeUnknown(PrivateKeyRelativePath)(relativePath).pipe(
						Effect.mapError(
							() =>
								new PrivateKeyWriteError({
									fingerprint,
									message: "Generated private key path did not match schema",
								}),
						),
					),
				),
			);
		},
		writePrivateKeyAtPath: ({ contents, privateKeyPath }) =>
			Effect.tryPromise({
				catch: () =>
					new PrivateKeyPathWriteError({
						message: "Failed to write private key file",
						privateKeyPath,
					}),
				try: async () => {
					await writeFileAtomically(
						join(location.rootDirectory, privateKeyPath),
						contents,
					);
				},
			}),
	});
};

export const NodeHomeRepositoryLive = Layer.effect(
	HomeRepository,
	Effect.gen(function* () {
		const { homeRootDirectory } = yield* BetterAgeConfig;
		return makeNodeHomeRepository(homeRootDirectory);
	}),
);
