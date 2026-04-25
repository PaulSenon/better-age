import { Effect, Schema } from "effect";
import {
	emptyHomeState,
	getActiveKey,
	HomeState,
} from "../../domain/home/HomeState.js";
import { PrivateKeyRelativePath } from "../../domain/identity/PrivateKeyRelativePath.js";
import type { HomeLocation } from "../../port/HomeRepository.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import {
	HomeStateSaveError,
	PrivateKeyPathWriteError,
	PrivateKeyReadError,
	PrivateKeyWriteError,
} from "../../port/HomeRepositoryError.js";

export interface InMemoryHomeRepository extends HomeRepository {
	readonly getSaveCount: () => number;
	readonly seedStateDocument: (document: unknown | null) => void;
	readonly seedPrivateKey: (path: string, contents: string) => void;
	readonly snapshot: () => {
		readonly files: ReadonlyMap<string, string>;
		readonly location: HomeLocation;
		readonly state: HomeState;
	};
}

export const makeInMemoryHomeRepository = (input?: {
	readonly failOnSave?: boolean;
	readonly failOnWrite?: boolean;
	readonly rootDirectory?: string;
}): InMemoryHomeRepository => {
	const rootDirectory = input?.rootDirectory ?? "/virtual-home";
	let state = emptyHomeState();
	let rawStateDocument: unknown | null = Schema.encodeSync(HomeState)(state);
	let saveCount = 0;
	const files = new Map<string, string>();
	const location = {
		keysDirectory: `${rootDirectory}/keys`,
		rootDirectory,
		stateFile: `${rootDirectory}/state.json`,
	} as const;

	const service = HomeRepository.make({
		deletePrivateKey: (privateKeyPath) =>
			Effect.sync(() => {
				files.delete(privateKeyPath);
			}),
		getActiveKey: Effect.sync(() => getActiveKey(state)),
		getLocation: Effect.succeed(location),
		loadStateDocument: Effect.sync(() => rawStateDocument),
		loadState: Effect.sync(() => state),
		readPrivateKey: (privateKeyPath) =>
			Effect.suspend(() => {
				const contents = files.get(privateKeyPath);

				if (contents === undefined) {
					return Effect.fail(
						new PrivateKeyReadError({
							message: "Failed to read private key file",
							privateKeyPath,
						}),
					);
				}

				return Effect.succeed(contents as never);
			}),
		saveState: (nextState) =>
			input?.failOnSave
				? Effect.fail(
						new HomeStateSaveError({
							message: "Failed to save home state",
							stateFile: location.stateFile,
						}),
					)
				: Schema.encode(HomeState)(nextState).pipe(
						Effect.orDie,
						Effect.tap((encodedState) =>
							Effect.sync(() => {
								state = nextState;
								rawStateDocument = encodedState;
								saveCount += 1;
							}),
						),
						Effect.asVoid,
					),
		writePrivateKey: (fingerprint, contents) =>
			input?.failOnWrite
				? Effect.fail(
						new PrivateKeyWriteError({
							fingerprint,
							message: "Failed to write private key file",
						}),
					)
				: Schema.decodeUnknown(PrivateKeyRelativePath)(
						"keys/active.key.age",
					).pipe(
						Effect.mapError(
							() =>
								new PrivateKeyWriteError({
									fingerprint,
									message: "Generated private key path did not match schema",
								}),
						),
						Effect.tap((relativePath) =>
							Effect.sync(() => {
								files.set(relativePath, contents);
							}),
						),
					),
		writePrivateKeyAtPath: ({ contents, privateKeyPath }) =>
			input?.failOnWrite
				? Effect.fail(
						new PrivateKeyPathWriteError({
							message: "Failed to write private key file",
							privateKeyPath,
						}),
					)
				: Effect.sync(() => {
						files.set(privateKeyPath, contents);
					}),
	});

	return Object.assign(service, {
		getSaveCount: () => saveCount,
		seedStateDocument: (document: unknown | null) => {
			rawStateDocument = document;
		},
		seedPrivateKey: (path: string, contents: string) => {
			files.set(path, contents);
		},
		snapshot: () => ({
			files,
			location,
			state,
		}),
	});
};
