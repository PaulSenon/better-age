// Use cases about the local user: setup, self identity, keys, passphrase,
// rotation, and home preferences.
import { Clock, Crypto, Effect, Option } from "effect";
import type { HomeState } from "./artifacts/HomeState.js";
import {
	allKeyRefs,
	newHomeState,
	rotateHome,
	type SelfIdentity,
	toSelfIdentity,
	validateDisplayName,
} from "./domain/Identity.js";
import { HomeAlreadySetup, HomeNotSetup } from "./Errors.js";
import { AgeCrypto } from "./services/AgeCrypto.js";
import { HomeStore } from "./services/HomeStore.js";

export type HomeStatus =
	| { readonly status: "not-setup" }
	| { readonly status: "setup"; readonly self: SelfIdentity };

export type LocalKeys = {
	readonly current: {
		readonly fingerprint: string;
		readonly path: string;
		readonly createdAt: string;
	};
	readonly retired: ReadonlyArray<{
		readonly fingerprint: string;
		readonly path: string;
		readonly createdAt: string;
		readonly retiredAt: string;
	}>;
};

export const nowIso = Effect.map(Clock.currentTimeMillis, (millis) =>
	new Date(millis).toISOString(),
);

export const randomId = Effect.fnUntraced(function* (
	prefix: "owner" | "payload",
) {
	const crypto = yield* Crypto.Crypto;
	const uuid = yield* Effect.orDie(crypto.randomUUIDv4);

	return `${prefix}_${uuid}`;
});

export const requireHome = Effect.gen(function* () {
	const home = yield* (yield* HomeStore).load;

	if (Option.isNone(home)) {
		return yield* new HomeNotSetup();
	}

	return home.value;
});

export const unlockKey = Effect.fnUntraced(function* (
	ref: string,
	passphrase: string,
) {
	const lockedKey = yield* (yield* HomeStore).readKey(ref);

	return yield* (yield* AgeCrypto).unlockKey(lockedKey, passphrase);
});

export const unlockCurrentKey = (home: HomeState, passphrase: string) =>
	unlockKey(home.currentKey.encryptedPrivateKeyRef, passphrase);

export const status = Effect.gen(function* () {
	const home = yield* (yield* HomeStore).load;

	return Option.match(home, {
		onNone: (): HomeStatus => ({ status: "not-setup" }),
		onSome: (value): HomeStatus => ({
			status: "setup",
			self: toSelfIdentity(value),
		}),
	});
});

export const selfIdentity = Effect.map(requireHome, toSelfIdentity);

export const setup = Effect.fn("Home.setup")(function* (input: {
	readonly displayName: string;
	readonly passphrase: string;
}) {
	const displayName = yield* Effect.fromResult(
		validateDisplayName(input.displayName),
	);
	const store = yield* HomeStore;

	if (Option.isSome(yield* store.load)) {
		return yield* new HomeAlreadySetup();
	}

	const crypto = yield* AgeCrypto;
	const key = yield* crypto.generateKey({
		ownerId: yield* randomId("owner"),
		createdAt: yield* nowIso,
	});
	const home = newHomeState({ displayName, key });

	yield* store.writeKey(
		home.currentKey.encryptedPrivateKeyRef,
		yield* crypto.lockKey(key, input.passphrase),
	);
	yield* store.save(home);

	return toSelfIdentity(home);
});

export const localKeys = Effect.gen(function* () {
	const home = yield* requireHome;
	const { keyPath } = yield* HomeStore;

	return {
		current: {
			fingerprint: home.currentKey.fingerprint,
			path: keyPath(home.currentKey.encryptedPrivateKeyRef),
			createdAt: home.currentKey.createdAt,
		},
		retired: home.retiredKeys.map((key) => ({
			fingerprint: key.fingerprint,
			path: keyPath(key.encryptedPrivateKeyRef),
			createdAt: key.createdAt,
			retiredAt: key.retiredAt,
		})),
	} satisfies LocalKeys;
});

/** Checks the passphrase against the current key without changing anything. */
export const verifyPassphrase = Effect.fn("Home.verifyPassphrase")(function* (
	passphrase: string,
) {
	yield* unlockCurrentKey(yield* requireHome, passphrase);
});

/** New current key under the same owner; the previous key is kept as retired. */
export const rotate = Effect.fn("Home.rotate")(function* (passphrase: string) {
	const home = yield* requireHome;
	yield* unlockCurrentKey(home, passphrase);

	const crypto = yield* AgeCrypto;
	const store = yield* HomeStore;
	const nextKey = yield* crypto.generateKey({
		ownerId: home.ownerId,
		createdAt: yield* nowIso,
	});
	const rotated = rotateHome(home, nextKey);

	yield* store.writeKey(
		rotated.currentKey.encryptedPrivateKeyRef,
		yield* crypto.lockKey(nextKey, passphrase),
	);
	yield* store.save(rotated);

	return toSelfIdentity(rotated);
});

/** Re-locks current and retired keys; every key must unlock or nothing changes. */
export const changePassphrase = Effect.fn("Home.changePassphrase")(
	function* (input: {
		readonly currentPassphrase: string;
		readonly nextPassphrase: string;
	}) {
		const home = yield* requireHome;
		const crypto = yield* AgeCrypto;
		const store = yield* HomeStore;
		const refs = allKeyRefs(home);

		const relocked = yield* Effect.forEach(refs, (ref) =>
			Effect.gen(function* () {
				const key = yield* unlockKey(ref, input.currentPassphrase);
				const lockedKey = yield* crypto.lockKey(key, input.nextPassphrase);
				yield* crypto.unlockKey(lockedKey, input.nextPassphrase);

				return { ref, lockedKey };
			}),
		);

		yield* store.replaceKeys(relocked);
		yield* Effect.forEach(refs, (ref) => unlockKey(ref, input.nextPassphrase));
	},
);

export const editorPreference = Effect.gen(function* () {
	const home = yield* (yield* HomeStore).load;

	return Option.match(home, {
		onNone: () => null,
		onSome: (value) => value.preferences.editorCommand,
	});
});

export const setEditorPreference = Effect.fn("Home.setEditorPreference")(
	function* (editorCommand: string | null) {
		const home = yield* requireHome;

		yield* (yield* HomeStore).save({
			...home,
			preferences: { ...home.preferences, editorCommand },
		});
	},
);
