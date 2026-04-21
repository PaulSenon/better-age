import { Effect, type Option } from "effect";
import type { HomeState } from "../domain/home/HomeState.js";
import type { EncryptedPrivateKey } from "../domain/identity/EncryptedPrivateKey.js";
import type { StoredIdentityRecord } from "../domain/identity/Identity.js";
import type { KeyFingerprint } from "../domain/identity/KeyFingerprint.js";
import type { PrivateKeyRelativePath } from "../domain/identity/PrivateKeyRelativePath.js";
import type {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
	PrivateKeyDeleteError,
	PrivateKeyPathWriteError,
	PrivateKeyReadError,
	PrivateKeyWriteError,
} from "./HomeRepositoryError.js";

export interface HomeLocation {
	readonly keysDirectory: string;
	readonly rootDirectory: string;
	readonly stateFile: string;
}

type HomeRepositoryShape = {
	readonly deletePrivateKey: (
		privateKeyPath: PrivateKeyRelativePath,
	) => Effect.Effect<void, PrivateKeyDeleteError>;
	readonly getActiveKey: Effect.Effect<
		Option.Option<StoredIdentityRecord>,
		HomeStateLoadError | HomeStateDecodeError
	>;
	readonly getLocation: Effect.Effect<HomeLocation>;
	readonly loadState: Effect.Effect<
		HomeState,
		HomeStateLoadError | HomeStateDecodeError
	>;
	readonly readPrivateKey: (
		privateKeyPath: PrivateKeyRelativePath,
	) => Effect.Effect<EncryptedPrivateKey, PrivateKeyReadError>;
	readonly saveState: (
		state: HomeState,
	) => Effect.Effect<void, HomeStateSaveError>;
	readonly writePrivateKey: (
		fingerprint: KeyFingerprint,
		contents: EncryptedPrivateKey,
	) => Effect.Effect<PrivateKeyRelativePath, PrivateKeyWriteError>;
	readonly writePrivateKeyAtPath: (input: {
		readonly contents: EncryptedPrivateKey;
		readonly privateKeyPath: PrivateKeyRelativePath;
	}) => Effect.Effect<void, PrivateKeyPathWriteError>;
};

const missingHomeRepository = {
	deletePrivateKey: (_privateKeyPath: PrivateKeyRelativePath) =>
		Effect.dieMessage(
			"HomeRepository implementation not provided",
		) as Effect.Effect<void, PrivateKeyDeleteError>,
	getActiveKey: Effect.dieMessage(
		"HomeRepository implementation not provided",
	) as Effect.Effect<
		Option.Option<StoredIdentityRecord>,
		HomeStateLoadError | HomeStateDecodeError
	>,
	getLocation: Effect.dieMessage(
		"HomeRepository implementation not provided",
	) as Effect.Effect<HomeLocation>,
	loadState: Effect.dieMessage(
		"HomeRepository implementation not provided",
	) as Effect.Effect<HomeState, HomeStateLoadError | HomeStateDecodeError>,
	readPrivateKey: (_privateKeyPath: PrivateKeyRelativePath) =>
		Effect.dieMessage(
			"HomeRepository implementation not provided",
		) as Effect.Effect<EncryptedPrivateKey, PrivateKeyReadError>,
	saveState: (_state: HomeState) =>
		Effect.dieMessage(
			"HomeRepository implementation not provided",
		) as Effect.Effect<void, HomeStateSaveError>,
	writePrivateKey: (
		_fingerprint: KeyFingerprint,
		_contents: EncryptedPrivateKey,
	) =>
		Effect.dieMessage(
			"HomeRepository implementation not provided",
		) as Effect.Effect<PrivateKeyRelativePath, PrivateKeyWriteError>,
	writePrivateKeyAtPath: (_input: {
		readonly contents: EncryptedPrivateKey;
		readonly privateKeyPath: PrivateKeyRelativePath;
	}) =>
		Effect.dieMessage(
			"HomeRepository implementation not provided",
		) as Effect.Effect<void, PrivateKeyPathWriteError>,
} satisfies HomeRepositoryShape;

export class HomeRepository extends Effect.Service<HomeRepository>()(
	"HomeRepository",
	{
		accessors: true,
		succeed: missingHomeRepository,
	},
) {}
