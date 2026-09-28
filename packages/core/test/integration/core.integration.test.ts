// Real age crypto + real filesystem. Slow (scrypt), so kept to the invariants
// fakes cannot prove: on-disk compatibility, key file interop, modes.
import { chmod, cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as age from "age-encryption";
import { Effect, Layer } from "effect";
import * as CoreLayer from "../../src/CoreLayer.js";
import * as Home from "../../src/Home.js";
import * as Identities from "../../src/Identities.js";
import { type Notice, Notices } from "../../src/Notices.js";
import * as Payloads from "../../src/Payloads.js";

const fixtures = join(import.meta.dirname, "../fixtures/pre-v2");

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
	Effect.acquireUseRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "better-age-core-"))),
		use,
		(dir) => Effect.promise(() => rm(dir, { recursive: true, force: true })),
	);

const liveCore = (homeDir: string, notices: Array<Notice> = []) =>
	Layer.mergeAll(
		CoreLayer.layer({ homeDir }),
		Layer.succeed(Notices)({
			report: (notice) => Effect.sync(() => notices.push(notice)),
		}),
	).pipe(Layer.provideMerge(NodeServices.layer));

const modeOf = async (path: string) => (await stat(path)).mode & 0o777;

describe("pre-V2 on-disk compatibility", () => {
	it.live(
		"reads homes, keys, and payloads written by the previous release",
		() =>
			withTempDir((dir) =>
				Effect.gen(function* () {
					yield* Effect.promise(() => cp(fixtures, dir, { recursive: true }));
					const aliceHome = join(dir, "alice-home");
					const payload = {
						path: join(dir, ".env.enc"),
						passphrase: "alice passphrase",
					};
					const homeStateBefore = yield* Effect.promise(() =>
						readFile(join(aliceHome, "home-state.json"), "utf8"),
					);
					const strings = JSON.parse(
						yield* Effect.promise(() =>
							readFile(join(dir, "identity-strings.json"), "utf8"),
						),
					) as { readonly alice: string; readonly bob: string };

					yield* Effect.gen(function* () {
						expect(yield* Home.status).toMatchObject({
							status: "setup",
							self: {
								ownerId: "owner_alice",
								fingerprint: "fp_d82200f79eed7db9",
							},
						});
						expect(yield* Identities.exportIdentityString).toBe(strings.alice);
						expect(yield* Identities.knownIdentities).toMatchObject([
							{ ownerId: "owner_bob", localAlias: "bobby" },
						]);

						// Written before rotation: readable only via the retired key.
						const stale = yield* Payloads.decrypt(payload);
						expect(stale).toMatchObject({
							payloadId: "payload_fixture",
							compatibility: "readable-but-outdated",
							envText: "API_TOKEN=fixture-secret\n# comment\n",
						});
						expect(stale.recipients.map((r) => r.ownerId)).toEqual([
							"owner_alice",
							"owner_bob",
						]);
					}).pipe(Effect.provide(liveCore(aliceHome)));

					// Reads never rewrite home state.
					expect(
						yield* Effect.promise(() =>
							readFile(join(aliceHome, "home-state.json"), "utf8"),
						),
					).toBe(homeStateBefore);

					yield* Payloads.update(payload).pipe(
						Effect.provide(liveCore(aliceHome)),
					);
					const asBob = yield* Payloads.decrypt({
						path: payload.path,
						passphrase: "bob passphrase",
					}).pipe(Effect.provide(liveCore(join(dir, "bob-home"))));
					expect(asBob.envText).toBe("API_TOKEN=fixture-secret\n# comment\n");
					expect(asBob.compatibility).toBe("up-to-date");
				}),
			),
		60_000,
	);
});

describe("real age adapters", () => {
	it.live(
		"writes private modes and age-interoperable key and payload files",
		() =>
			withTempDir((dir) =>
				Effect.gen(function* () {
					const homeDir = join(dir, "home");
					const path = join(dir, "project/.env.enc");
					const self = yield* Home.setup({
						displayName: "Isaac",
						passphrase: "old passphrase",
					});
					yield* Payloads.create({ path, passphrase: "old passphrase" });
					// Regression: arbitrary text survives real age encryption unchanged.
					const arbitraryText =
						'free-form notes\r\n-----END BETTER AGE PAYLOAD-----\n{"k": [1, 2]}\né\u{1f510}\n\n  = \nno trailing newline';
					yield* Payloads.edit({
						path,
						passphrase: "old passphrase",
						envText: arbitraryText,
					});

					expect(
						(yield* Payloads.decrypt({ path, passphrase: "old passphrase" }))
							.envText,
					).toBe(arbitraryText);

					const keyFile = join(homeDir, `keys/${self.fingerprint}.age`);
					expect(yield* Effect.promise(() => modeOf(homeDir))).toBe(0o700);
					expect(yield* Effect.promise(() => modeOf(keyFile))).toBe(0o600);

					const decrypter = new age.Decrypter();
					decrypter.addPassphrase("old passphrase");
					const keyText = yield* Effect.promise(async () =>
						decrypter.decrypt(
							age.armor.decode(await readFile(keyFile, "utf8")),
							"text",
						),
					);
					expect(keyText).toMatch(
						/^# better-age-key-metadata\/v1 \S+\nAGE-SECRET-KEY-PQ-1\S+\n$/,
					);
				}).pipe(Effect.provide(liveCore(join(dir, "home")))),
			),
		60_000,
	);

	it.live(
		"repairs loose modes, rotates, and changes passphrase with real keys",
		() =>
			withTempDir((dir) => {
				const homeDir = join(dir, "home");
				const notices: Array<Notice> = [];
				const path = join(dir, ".env.enc");

				return Effect.gen(function* () {
					const first = yield* Home.setup({
						displayName: "Isaac",
						passphrase: "old passphrase",
					});
					yield* Payloads.create({ path, passphrase: "old passphrase" });
					yield* Effect.promise(async () => {
						await chmod(homeDir, 0o755);
						await chmod(join(homeDir, `keys/${first.fingerprint}.age`), 0o644);
					});

					yield* Home.rotate("old passphrase");
					yield* Home.changePassphrase({
						currentPassphrase: "old passphrase",
						nextPassphrase: "new passphrase",
					});

					expect(notices.map((notice) => notice.code)).toContain(
						"LOCAL_PERMISSIONS_REPAIRED",
					);
					expect(yield* Effect.promise(() => modeOf(homeDir))).toBe(0o700);
					const stale = yield* Payloads.decrypt({
						path,
						passphrase: "new passphrase",
					});
					expect(stale.compatibility).toBe("readable-but-outdated");
					const wrong = yield* Effect.flip(
						Payloads.decrypt({ path, passphrase: "old passphrase" }),
					);
					expect(wrong._tag).toBe("PASSPHRASE_INCORRECT");
				}).pipe(Effect.provide(liveCore(homeDir, notices)));
			}),
		60_000,
	);
});
