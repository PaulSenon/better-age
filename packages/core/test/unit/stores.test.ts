import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as Home from "../../src/Home.js";
import { HomeStore } from "../../src/services/HomeStore.js";
import { PayloadFiles } from "../../src/services/PayloadFiles.js";
import { makeTestCore, testHomeDir } from "../support/TestCore.js";

const keys = `${testHomeDir}/keys`;

describe("home store", () => {
	it.effect("repairs loose home and key permissions and reports them", () => {
		const core = makeTestCore();

		return Effect.gen(function* () {
			const self = yield* Home.setup({
				displayName: "Alice",
				passphrase: "pw",
			});
			const keyFile = `${keys}/${self.fingerprint}.age`;
			core.fs.setMode(testHomeDir, 0o755);
			core.fs.setMode(keyFile, 0o644);

			yield* Home.verifyPassphrase("pw");

			expect(core.fs.mode(testHomeDir)).toBe(0o700);
			expect(core.fs.mode(keyFile)).toBe(0o600);
			expect(core.notices).toEqual(
				expect.arrayContaining([
					{ code: "LOCAL_PERMISSIONS_REPAIRED", path: testHomeDir },
					{ code: "LOCAL_PERMISSIONS_REPAIRED", path: keyFile },
				]),
			);
		}).pipe(Effect.provide(core.layer));
	});

	it.effect("fails explicitly when permissions cannot be repaired", () => {
		const core = makeTestCore();

		return Effect.gen(function* () {
			yield* Home.setup({ displayName: "Alice", passphrase: "pw" });
			core.fs.setMode(testHomeDir, 0o777);
			core.fs.failWhen = (method) => method === "chmod";

			const error = yield* Effect.flip(Home.status);
			expect(error._tag).toBe("LOCAL_PERMISSION_REPAIR_FAILED");
		}).pipe(Effect.provide(core.layer));
	});

	it.effect(
		"rolls back an interrupted passphrase change before reading keys",
		() => {
			const core = makeTestCore({
				files: {
					[`${keys}/a.age`]: "new-a",
					[`${keys}/a.age.bak`]: "old-a",
					[`${keys}/b.age.new`]: "new-b",
					[`${keys}/b.age`]: "old-b",
					[`${keys}/.passphrase-change.json`]: JSON.stringify({
						entries: [{ ref: "keys/a.age" }, { ref: "keys/b.age" }],
						kind: "better-age/key-transaction",
						version: 1,
					}),
				},
			});

			return Effect.gen(function* () {
				const store = yield* HomeStore;

				expect(yield* store.readKey("keys/a.age")).toBe("old-a");
				expect(core.fs.file(`${keys}/b.age`)).toBe("old-b");
				expect(core.fs.file(`${keys}/b.age.new`)).toBeUndefined();
				expect(core.fs.file(`${keys}/.passphrase-change.json`)).toBeUndefined();
			}).pipe(Effect.provide(core.layer));
		},
	);

	it.effect("reports an unrecoverable key transaction", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip((yield* HomeStore).load);
			expect(error._tag).toBe("KEY_TRANSACTION_INCOMPLETE");
		}).pipe(
			Effect.provide(
				makeTestCore({
					files: { [`${keys}/.passphrase-change.json`]: "{broken" },
				}).layer,
			),
		),
	);

	it.effect("keeps committed new keys when backup cleanup fails", () => {
		const core = makeTestCore({
			files: { [`${keys}/a.age`]: "old-a", [`${keys}/b.age`]: "old-b" },
		});
		core.fs.failWhen = (method, path) =>
			method === "remove" && path === `${keys}/b.age.bak`;

		return Effect.gen(function* () {
			yield* (yield* HomeStore).replaceKeys([
				{ ref: "keys/a.age", lockedKey: "new-a" },
				{ ref: "keys/b.age", lockedKey: "new-b" },
			]);

			expect(core.fs.file(`${keys}/a.age`)).toBe("new-a");
			expect(core.fs.file(`${keys}/b.age`)).toBe("new-b");
			expect(core.fs.file(`${keys}/.passphrase-change.json`)).toBeUndefined();
			expect(core.fs.file(`${keys}/a.age.new`)).toBeUndefined();
		}).pipe(Effect.provide(core.layer));
	});

	it.effect("restores every previous key when the swap fails midway", () => {
		const core = makeTestCore({
			files: { [`${keys}/a.age`]: "old-a", [`${keys}/b.age`]: "old-b" },
		});
		core.fs.failWhen = (method, path) =>
			method === "rename" && path === `${keys}/b.age.new`;

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(
				(yield* HomeStore).replaceKeys([
					{ ref: "keys/a.age", lockedKey: "new-a" },
					{ ref: "keys/b.age", lockedKey: "new-b" },
				]),
			);

			expect(Exit.isFailure(exit)).toBe(true);
			expect(core.fs.file(`${keys}/a.age`)).toBe("old-a");
			expect(core.fs.file(`${keys}/b.age`)).toBe("old-b");
			expect(core.fs.file(`${keys}/.passphrase-change.json`)).toBeUndefined();
			expect(core.fs.file(`${keys}/a.age.new`)).toBeUndefined();
			expect(core.fs.file(`${keys}/b.age.new`)).toBeUndefined();
		}).pipe(Effect.provide(core.layer));
	});

	it.effect("refuses key refs outside the managed keys directory", () => {
		const core = makeTestCore();

		return Effect.gen(function* () {
			const store = yield* HomeStore;

			const attempts: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
				store.writeKey("../outside.age", "secret"),
				store.readKey("/tmp/outside.age"),
				store.replaceKeys([
					{ ref: "keys/../../outside.age", lockedKey: "secret" },
				]),
			];
			for (const attempt of attempts) {
				expect(Exit.isFailure(yield* Effect.exit(attempt))).toBe(true);
			}
			expect(
				[...core.fs.entries.values()].filter((entry) => entry.type === "File"),
			).toEqual([]);
		}).pipe(Effect.provide(core.layer));
	});

	it.effect("maps missing key files to LOCAL_KEY_MISSING", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				(yield* HomeStore).readKey("keys/missing.age"),
			);
			expect(error._tag).toBe("LOCAL_KEY_MISSING");
		}).pipe(Effect.provide(makeTestCore().layer)),
	);
});

describe("payload files", () => {
	it.effect("writes through a same-directory temp file then renames", () => {
		const core = makeTestCore();
		const renames: Array<string> = [];
		core.fs.failWhen = (method, path) => {
			if (method === "rename") renames.push(path);
			return false;
		};

		return Effect.gen(function* () {
			yield* (yield* PayloadFiles).write("/project/.env.enc", "wrapper");

			expect(renames).toEqual(["/project/.env.enc.tmp"]);
			expect(core.fs.file("/project/.env.enc")).toBe("wrapper");
			expect(core.fs.file("/project/.env.enc.tmp")).toBeUndefined();
		}).pipe(Effect.provide(core.layer));
	});

	it.effect(
		"removes the temp file and keeps the old payload when rename fails",
		() => {
			const core = makeTestCore({ files: { "/project/.env.enc": "old" } });
			core.fs.failWhen = (method) => method === "rename";

			return Effect.gen(function* () {
				const exit = yield* Effect.exit(
					(yield* PayloadFiles).write("/project/.env.enc", "new"),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				expect(core.fs.file("/project/.env.enc")).toBe("old");
				expect(core.fs.file("/project/.env.enc.tmp")).toBeUndefined();
			}).pipe(Effect.provide(core.layer));
		},
	);
});
