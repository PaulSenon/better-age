// The local home directory (default `~/.better-age`):
//
//   home-state.json                 identity, key refs, known identities
//   keys/<fingerprint>.age          passphrase-locked key files
//   keys/.passphrase-change.json    marker of an in-flight key replacement
//
// Invariants: home and keys dirs are 0700, files 0600 (loose modes are repaired
// and reported as notices); writes are temp+rename; a passphrase change swaps
// every key file under a marker so a crash rolls back to the previous keys.
import {
	Context,
	Effect,
	FileSystem,
	Layer,
	Option,
	Path,
	type PlatformError,
	Schema,
} from "effect";
import {
	decodeHomeState,
	encodeHomeState,
	type HomeState,
	keyRefPattern,
} from "../artifacts/HomeState.js";
import {
	type ArtifactUnsupportedVersion,
	HomeStateInvalid,
	KeyTransactionIncomplete,
	LocalKeyMissing,
	LocalPermissionRepairFailed,
} from "../Errors.js";
import { report } from "../Notices.js";

export type HomeLoadError =
	| HomeStateInvalid
	| ArtifactUnsupportedVersion
	| KeyTransactionIncomplete
	| LocalPermissionRepairFailed;

export class HomeStore extends Context.Service<
	HomeStore,
	{
		readonly homeDir: string;
		readonly keyPath: (ref: string) => string;
		/** None when setup never ran. Persists v1 -> v2 migrations. */
		readonly load: Effect.Effect<Option.Option<HomeState>, HomeLoadError>;
		readonly save: (
			home: HomeState,
		) => Effect.Effect<void, LocalPermissionRepairFailed>;
		readonly readKey: (
			ref: string,
		) => Effect.Effect<
			string,
			LocalKeyMissing | LocalPermissionRepairFailed | KeyTransactionIncomplete
		>;
		readonly writeKey: (
			ref: string,
			lockedKey: string,
		) => Effect.Effect<void, LocalPermissionRepairFailed>;
		/** Replaces several key files all-or-nothing. */
		readonly replaceKeys: (
			keys: ReadonlyArray<{ readonly ref: string; readonly lockedKey: string }>,
		) => Effect.Effect<
			void,
			KeyTransactionIncomplete | LocalPermissionRepairFailed
		>;
	}
>()("@better-age/core/HomeStore") {
	static readonly layer = (options: { readonly homeDir: string }) =>
		Layer.effect(HomeStore)(makeHomeStore(options.homeDir));
}

const privateDirMode = 0o700;
const privateFileMode = 0o600;
const markerRef = "keys/.passphrase-change.json";

const isNotFound = (error: PlatformError.PlatformError) =>
	error.reason._tag === "NotFound";

const isPrivateDir = (mode: number) =>
	(mode & 0o077) === 0 && (mode & 0o700) === 0o700;

const isPrivateFile = (mode: number) =>
	(mode & 0o177) === 0 && (mode & 0o600) === 0o600;

/** Key refs come from home-state; re-check so no path can escape `keys/`. */
const assertKeyRef = (ref: string) =>
	keyRefPattern.test(ref)
		? Effect.void
		: Effect.die(new Error(`Refusing unmanaged key ref: ${ref}`));

const decodeJson = Schema.decodeUnknownEffect(
	Schema.fromJsonString(Schema.Unknown),
);

const KeyTransactionMarker = Schema.Struct({
	kind: Schema.Literal("better-age/key-transaction"),
	version: Schema.Literal(1),
	entries: Schema.Array(Schema.Struct({ ref: Schema.String })),
});

const makeHomeStore = Effect.fnUntraced(function* (homeDir: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const stateFile = path.join(homeDir, "home-state.json");
	const keyPath = (ref: string) => path.join(homeDir, ref);

	const chmodOrFail = (target: string, mode: number) =>
		fs
			.chmod(target, mode)
			.pipe(
				Effect.mapError(
					(cause) => new LocalPermissionRepairFailed({ path: target, cause }),
				),
			);

	const modeOf = (target: string) =>
		fs.stat(target).pipe(
			Effect.map((info) => Option.some(info.mode)),
			Effect.catchIf(isNotFound, () => Effect.succeed(Option.none<number>())),
			Effect.orDie,
		);

	/** Tightens an existing directory to 0700, reporting the repair. */
	const repairDir = Effect.fnUntraced(function* (dir: string) {
		const mode = yield* modeOf(dir);

		if (Option.isSome(mode) && !isPrivateDir(mode.value)) {
			yield* chmodOrFail(dir, privateDirMode);
			yield* report({ code: "LOCAL_PERMISSIONS_REPAIRED", path: dir });
		}
	});

	/** Creates the directory as 0700; tightens (and reports) a pre-existing one. */
	const ensurePrivateDir = Effect.fnUntraced(function* (dir: string) {
		const existed = Option.isSome(yield* modeOf(dir));
		yield* fs
			.makeDirectory(dir, { recursive: true, mode: privateDirMode })
			.pipe(Effect.orDie);
		const mode = Option.getOrElse(yield* modeOf(dir), () => 0);

		if (!isPrivateDir(mode)) {
			yield* chmodOrFail(dir, privateDirMode);
			if (existed) {
				yield* report({ code: "LOCAL_PERMISSIONS_REPAIRED", path: dir });
			}
		}
	});

	const writePrivateFile = Effect.fnUntraced(function* (
		target: string,
		contents: string,
	) {
		const temp = `${target}.tmp`;
		yield* ensurePrivateDir(path.dirname(target));
		yield* Effect.gen(function* () {
			yield* fs.writeFileString(temp, contents, { mode: privateFileMode });
			yield* fs.chmod(temp, privateFileMode);
			yield* fs.rename(temp, target);
			yield* fs.chmod(target, privateFileMode);
		}).pipe(
			Effect.onError(() =>
				fs.remove(temp, { force: true }).pipe(Effect.ignore),
			),
			Effect.orDie,
		);
	});

	/** Rolls back an interrupted passphrase change: restores `.bak` keys. */
	const recoverKeyTransaction = Effect.gen(function* () {
		const markerPath = keyPath(markerRef);
		const marker = yield* fs.readFileString(markerPath).pipe(
			Effect.map(Option.some),
			Effect.catchIf(isNotFound, () => Effect.succeed(Option.none<string>())),
			Effect.orDie,
		);

		if (Option.isNone(marker)) {
			return;
		}

		yield* Effect.gen(function* () {
			const { entries } = yield* Schema.decodeUnknownEffect(
				Schema.fromJsonString(KeyTransactionMarker),
			)(marker.value);

			for (const { ref } of entries) {
				yield* assertKeyRef(ref);
				const stable = keyPath(ref);
				yield* fs.rename(`${stable}.bak`, stable).pipe(
					Effect.andThen(fs.chmod(stable, privateFileMode)),
					Effect.catchIf(isNotFound, () => Effect.void),
				);
				yield* fs.remove(`${stable}.new`, { force: true });
			}

			yield* fs.remove(markerPath, { force: true });
		}).pipe(
			Effect.catchCause((cause) =>
				Effect.fail(new KeyTransactionIncomplete({ cause })),
			),
		);
		yield* repairDir(homeDir);
	});

	const load = Effect.gen(function* () {
		yield* recoverKeyTransaction;
		yield* repairDir(homeDir);

		const contents = yield* fs.readFileString(stateFile).pipe(
			Effect.map(Option.some),
			Effect.catchIf(isNotFound, () => Effect.succeed(Option.none<string>())),
			Effect.orDie,
		);

		if (Option.isNone(contents)) {
			return Option.none<HomeState>();
		}

		const json = yield* decodeJson(contents.value).pipe(
			Effect.mapError(() => new HomeStateInvalid()),
		);
		const { homeState, migrated } = yield* Effect.fromResult(
			decodeHomeState(json),
		);

		if (migrated) {
			yield* save(homeState);
		}

		return Option.some(homeState);
	});

	const save = (home: HomeState) =>
		writePrivateFile(stateFile, encodeHomeState(home));

	const readKey = Effect.fnUntraced(function* (ref: string) {
		yield* assertKeyRef(ref);
		yield* recoverKeyTransaction;
		yield* repairDir(homeDir);

		const file = keyPath(ref);
		const mode = yield* modeOf(file);

		if (Option.isNone(mode)) {
			return yield* new LocalKeyMissing({ ref });
		}

		if (!isPrivateFile(mode.value)) {
			yield* chmodOrFail(file, privateFileMode);
			yield* report({ code: "LOCAL_PERMISSIONS_REPAIRED", path: file });
		}

		return yield* fs.readFileString(file).pipe(
			Effect.catchIf(isNotFound, () =>
				Effect.fail(new LocalKeyMissing({ ref })),
			),
			Effect.catchTag("PlatformError", Effect.die),
		);
	});

	const writeKey = Effect.fnUntraced(function* (
		ref: string,
		lockedKey: string,
	) {
		yield* assertKeyRef(ref);
		yield* writePrivateFile(keyPath(ref), lockedKey);
	});

	const replaceKeys = Effect.fnUntraced(function* (
		keys: ReadonlyArray<{ readonly ref: string; readonly lockedKey: string }>,
	) {
		for (const key of keys) {
			yield* assertKeyRef(key.ref);
		}
		yield* recoverKeyTransaction;

		const markerPath = keyPath(markerRef);
		const swap = Effect.gen(function* () {
			yield* ensurePrivateDir(path.dirname(markerPath));
			for (const key of keys) {
				yield* writePrivateFile(`${keyPath(key.ref)}.new`, key.lockedKey);
			}
			yield* fs.writeFileString(
				markerPath,
				JSON.stringify({
					entries: keys.map((key) => ({ ref: key.ref })),
					kind: "better-age/key-transaction",
					version: 1,
				}),
				{ mode: privateFileMode },
			);
			yield* fs.chmod(markerPath, privateFileMode);
			for (const key of keys) {
				const stable = keyPath(key.ref);
				yield* fs.rename(stable, `${stable}.bak`);
				yield* fs.rename(`${stable}.new`, stable);
				yield* fs.chmod(stable, privateFileMode);
			}
			// Commit point: once the marker is gone the new keys are authoritative.
			yield* fs.remove(markerPath, { force: true });
		}).pipe(Effect.catchTag("PlatformError", Effect.die));

		yield* swap.pipe(
			Effect.catchCause((cause) =>
				recoverKeyTransaction.pipe(
					Effect.andThen(
						Effect.forEach(keys, (key) =>
							fs.remove(`${keyPath(key.ref)}.new`, { force: true }),
						),
					),
					Effect.catchCause((recoveryCause) =>
						Effect.fail(new KeyTransactionIncomplete({ cause: recoveryCause })),
					),
					Effect.andThen(Effect.failCause(cause)),
				),
			),
		);
		// Best effort: leftover backups are harmless once the marker is removed.
		yield* Effect.forEach(keys, (key) =>
			fs.remove(`${keyPath(key.ref)}.bak`, { force: true }).pipe(Effect.ignore),
		);
	});

	return HomeStore.of({
		homeDir,
		keyPath,
		load,
		save,
		readKey,
		writeKey,
		replaceKeys,
	});
});
