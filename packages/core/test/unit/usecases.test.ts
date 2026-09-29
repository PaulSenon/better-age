import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Home from "../../src/Home.js";
import * as Identities from "../../src/Identities.js";
import * as Payloads from "../../src/Payloads.js";
import { makeTestCore, testHomeDir } from "../support/TestCore.js";

const passphrase = "correct horse";
const tagOf = <A, E extends { readonly _tag: string }, R>(
	effect: Effect.Effect<A, E, R>,
) => Effect.map(Effect.flip(effect), (error) => error._tag);

const setupAlice = Home.setup({ displayName: "Alice", passphrase });

/** A second, independent home whose identity string Alice can import. */
const otherIdentityString = (displayName: string) =>
	Effect.gen(function* () {
		yield* Home.setup({ displayName, passphrase: "other passphrase" });
		return yield* Identities.exportIdentityString;
	}).pipe(Effect.provide(makeTestCore().layer));

describe("home", () => {
	it.effect("sets up a self identity once and reports status", () => {
		const core = makeTestCore();

		return Effect.gen(function* () {
			expect(yield* Home.status).toEqual({ status: "not-setup" });

			const self = yield* setupAlice;
			expect(self).toMatchObject({
				displayName: "Alice",
				keyMode: "pq-hybrid",
				rotationTtl: "3m",
				handle: `Alice#${self.fingerprint}`,
			});
			expect(yield* Home.status).toEqual({ status: "setup", self });
			expect(yield* tagOf(setupAlice)).toBe("SETUP_ALREADY_CONFIGURED");
			expect(core.fs.mode(testHomeDir)).toBe(0o700);
			expect(core.fs.mode(`${testHomeDir}/home-state.json`)).toBe(0o600);
			expect(core.fs.mode(`${testHomeDir}/keys/${self.fingerprint}.age`)).toBe(
				0o600,
			);
		}).pipe(Effect.provide(core.layer));
	});

	it.effect("rejects blank names and requires setup before home commands", () =>
		Effect.gen(function* () {
			expect(yield* tagOf(Home.setup({ displayName: " ", passphrase }))).toBe(
				"SETUP_NAME_INVALID",
			);
			expect(yield* tagOf(Home.selfIdentity)).toBe("HOME_STATE_NOT_FOUND");
			expect(yield* tagOf(Identities.exportIdentityString)).toBe(
				"HOME_STATE_NOT_FOUND",
			);
			expect(yield* Home.editorPreference).toBeNull();
		}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect("reports corrupt and too-new home state as typed failures", () =>
		Effect.gen(function* () {
			expect(
				yield* tagOf(Home.status).pipe(
					Effect.provide(
						makeTestCore({
							files: { [`${testHomeDir}/home-state.json`]: "{nope" },
						}).layer,
					),
				),
			).toBe("HOME_STATE_INVALID");
			expect(
				yield* tagOf(Home.status).pipe(
					Effect.provide(
						makeTestCore({
							files: {
								[`${testHomeDir}/home-state.json`]: JSON.stringify({
									kind: "better-age/home-state",
									version: 99,
								}),
							},
						}).layer,
					),
				),
			).toBe("ARTIFACT_UNSUPPORTED_VERSION");
		}),
	);

	it.effect("saves the editor preference", () =>
		Effect.gen(function* () {
			yield* setupAlice;
			yield* Home.setEditorPreference("nvim");
			expect(yield* Home.editorPreference).toBe("nvim");
		}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect(
		"verifies passphrases without blaming them for key problems",
		() => {
			const core = makeTestCore();

			return Effect.gen(function* () {
				const self = yield* setupAlice;
				yield* Home.verifyPassphrase(passphrase);
				expect(yield* tagOf(Home.verifyPassphrase("wrong"))).toBe(
					"PASSPHRASE_INCORRECT",
				);

				const keyFile = `${testHomeDir}/keys/${self.fingerprint}.age`;
				core.fs.entries.delete(keyFile);
				expect(yield* tagOf(Home.verifyPassphrase(passphrase))).toBe(
					"LOCAL_KEY_MISSING",
				);
			}).pipe(Effect.provide(core.layer));
		},
	);

	it.effect(
		"rotates under the same owner and lists current and retired keys",
		() =>
			Effect.gen(function* () {
				const before = yield* setupAlice;
				expect(yield* tagOf(Home.rotate("wrong"))).toBe("PASSPHRASE_INCORRECT");

				const after = yield* Home.rotate(passphrase);
				expect(after.ownerId).toBe(before.ownerId);
				expect(after.fingerprint).not.toBe(before.fingerprint);
				expect(yield* Home.localKeys).toMatchObject({
					current: {
						fingerprint: after.fingerprint,
						path: `${testHomeDir}/keys/${after.fingerprint}.age`,
					},
					retired: [
						{
							fingerprint: before.fingerprint,
							path: `${testHomeDir}/keys/${before.fingerprint}.age`,
						},
					],
				});
			}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect("changes the passphrase of current and retired keys together", () =>
		Effect.gen(function* () {
			yield* setupAlice;
			yield* Home.rotate(passphrase);
			expect(
				yield* tagOf(
					Home.changePassphrase({
						currentPassphrase: "wrong",
						nextPassphrase: "next passphrase",
					}),
				),
			).toBe("PASSPHRASE_INCORRECT");

			yield* Home.changePassphrase({
				currentPassphrase: passphrase,
				nextPassphrase: "next passphrase",
			});
			yield* Home.verifyPassphrase("next passphrase");
			expect(yield* tagOf(Home.verifyPassphrase(passphrase))).toBe(
				"PASSPHRASE_INCORRECT",
			);
			const keys = yield* Home.localKeys;
			for (const path of [
				keys.current.path,
				...keys.retired.map((key) => key.path),
			]) {
				expect(
					yield* tagOf(
						Home.unlockKey(path.replace(`${testHomeDir}/`, ""), passphrase),
					),
				).toBe("PASSPHRASE_INCORRECT");
			}
		}).pipe(Effect.provide(makeTestCore().layer)),
	);
});

describe("identities", () => {
	it.effect("imports, lists, and forgets known identities", () =>
		Effect.gen(function* () {
			const bob = yield* otherIdentityString("Bob");
			yield* setupAlice;

			const result = yield* Identities.importIdentity({
				identityString: bob,
				localAlias: "bobby",
			});
			expect(result.outcome).toBe("added");
			expect(result.identity.handle).toBe(
				`bobby#${result.identity.fingerprint}`,
			);
			expect(yield* Identities.knownIdentities).toEqual([result.identity]);
			expect(
				(yield* Identities.importIdentity({ identityString: bob })).outcome,
			).toBe("unchanged");

			yield* Identities.forgetIdentity(result.identity.ownerId);
			expect(yield* Identities.knownIdentities).toEqual([]);
			expect(
				yield* tagOf(Identities.forgetIdentity(result.identity.ownerId)),
			).toBe("IDENTITY_REFERENCE_NOT_FOUND");
		}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect("rejects invalid strings and our own identity", () =>
		Effect.gen(function* () {
			yield* setupAlice;
			const self = yield* Identities.exportIdentityString;

			expect(
				yield* tagOf(Identities.importIdentity({ identityString: "nope" })),
			).toBe("IDENTITY_STRING_INVALID");
			expect(
				yield* tagOf(Identities.importIdentity({ identityString: self })),
			).toBe("CANNOT_IMPORT_SELF_IDENTITY");
			expect((yield* Identities.parseIdentityString(self)).displayName).toBe(
				"Alice",
			);
		}).pipe(Effect.provide(makeTestCore().layer)),
	);
});

describe("payloads", () => {
	const path = "/project/.env.enc";
	const open = { path, passphrase };

	it.effect(
		"creates an empty self-only payload and refuses to overwrite",
		() => {
			const core = makeTestCore();

			return Effect.gen(function* () {
				const self = yield* setupAlice;
				const created = yield* Payloads.create(open);
				const decrypted = yield* Payloads.decrypt(open);

				expect(decrypted).toMatchObject({
					path,
					payloadId: created.payloadId,
					schemaVersion: 1,
					compatibility: "up-to-date",
					envText: "",
					envKeys: [],
					recipients: [
						{ ownerId: self.ownerId, isSelf: true, isStaleSelf: false },
					],
				});
				expect(core.fs.file(path)).toContain("BEGIN BETTER AGE PAYLOAD");
				expect(yield* tagOf(Payloads.create(open))).toBe(
					"PAYLOAD_ALREADY_EXISTS",
				);
				yield* Payloads.create({ ...open, overwrite: true });
			}).pipe(Effect.provide(core.layer));
		},
	);

	// Regression: payload text is stored as-is; there is no .env format gate.
	it.effect("edits payload text as-is, including arbitrary non-env text", () =>
		Effect.gen(function* () {
			yield* setupAlice;
			yield* Payloads.create(open);
			const arbitraryText =
				'not valid\r\n  indented = spaced\n9STARTS=1\nexport FOO=bar\n{"json": true}\né\u{1f510}\n=no-key\nno trailing newline';

			expect((yield* Payloads.edit({ ...open, envText: "" })).outcome).toBe(
				"unchanged",
			);
			expect(
				(yield* Payloads.edit({ ...open, envText: arbitraryText })).outcome,
			).toBe("edited");
			expect((yield* Payloads.decrypt(open)).envText).toBe(arbitraryText);
		}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect("grants and revokes with self guards and idempotent outcomes", () =>
		Effect.gen(function* () {
			const bobString = yield* otherIdentityString("Bob");
			const self = yield* setupAlice;
			const bob = yield* Identities.parseIdentityString(bobString);
			yield* Payloads.create(open);

			expect((yield* Payloads.grant({ ...open, recipient: bob })).outcome).toBe(
				"added",
			);
			expect((yield* Payloads.grant({ ...open, recipient: bob })).outcome).toBe(
				"unchanged",
			);
			expect(
				yield* tagOf(
					Payloads.grant({
						...open,
						recipient: { ...bob, ownerId: self.ownerId },
					}),
				),
			).toBe("CANNOT_GRANT_SELF");
			expect(
				(yield* Payloads.decrypt(open)).recipients.map((r) => r.ownerId),
			).toEqual([self.ownerId, bob.ownerId]);

			expect(
				yield* tagOf(Payloads.revoke({ ...open, ownerId: self.ownerId })),
			).toBe("CANNOT_REVOKE_SELF");
			expect(
				(yield* Payloads.revoke({ ...open, ownerId: bob.ownerId })).outcome,
			).toBe("removed");
			expect(
				(yield* Payloads.revoke({ ...open, ownerId: bob.ownerId })).outcome,
			).toBe("unchanged");
		}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect(
		"keeps outdated payloads readable, blocks writes, and updates self",
		() =>
			Effect.gen(function* () {
				yield* setupAlice;
				yield* Payloads.create(open);
				yield* Payloads.edit({ ...open, envText: "A=1\n" });
				const rotated = yield* Home.rotate(passphrase);

				const stale = yield* Payloads.decrypt(open);
				expect(stale.compatibility).toBe("readable-but-outdated");
				expect(stale.envText).toBe("A=1\n");
				expect(yield* tagOf(Payloads.edit({ ...open, envText: "B=2\n" }))).toBe(
					"PAYLOAD_UPDATE_REQUIRED",
				);

				expect((yield* Payloads.update(open)).outcome).toBe("updated");
				expect((yield* Payloads.update(open)).outcome).toBe("unchanged");
				const fresh = yield* Payloads.decrypt(open);
				expect(fresh.compatibility).toBe("up-to-date");
				expect(fresh.recipients[0]?.publicKey).toBe(rotated.publicKey);
			}).pipe(Effect.provide(makeTestCore().layer)),
	);

	it.effect(
		"reports an unreadable retired key instead of a wrong passphrase",
		() => {
			const core = makeTestCore();

			return Effect.gen(function* () {
				const original = yield* setupAlice;
				yield* Payloads.create(open);
				yield* Home.rotate(passphrase);
				core.fs.entries.set(`${testHomeDir}/keys/${original.fingerprint}.age`, {
					type: "File",
					contents: "corrupt",
					mode: 0o600,
				});

				expect(yield* tagOf(Payloads.decrypt(open))).toBe(
					"PAYLOAD_ACCESS_DENIED",
				);
				expect(core.notices).toEqual([
					{ code: "RETIRED_KEY_UNREADABLE", fingerprint: original.fingerprint },
				]);
			}).pipe(Effect.provide(core.layer));
		},
	);

	it.effect("never writes a payload that fails read-back verification", () => {
		let corrupt = false;
		const core = makeTestCore({ corruptEncrypt: () => corrupt });

		return Effect.gen(function* () {
			yield* setupAlice;
			yield* Payloads.create(open);
			const before = core.fs.file(path);
			corrupt = true;

			expect(yield* tagOf(Payloads.edit({ ...open, envText: "A=1" }))).toBe(
				"PAYLOAD_WRITE_VERIFICATION_FAILED",
			);
			expect(core.fs.file(path)).toBe(before);
			expect(
				yield* tagOf(Payloads.create({ path: "/project/new.enc", passphrase })),
			).toBe("PAYLOAD_WRITE_VERIFICATION_FAILED");
			expect(core.fs.file("/project/new.enc")).toBeUndefined();
		}).pipe(Effect.provide(core.layer));
	});

	it.effect(
		"returns semantic failures for missing, malformed, and locked payloads",
		() => {
			const core = makeTestCore({
				files: { "/project/bad.enc": "not a payload" },
			});

			return Effect.gen(function* () {
				yield* setupAlice;
				yield* Payloads.create(open);

				expect(
					yield* tagOf(
						Payloads.decrypt({ path: "/project/missing.enc", passphrase }),
					),
				).toBe("PAYLOAD_NOT_FOUND");
				expect(
					yield* tagOf(
						Payloads.decrypt({ path: "/project/bad.enc", passphrase }),
					),
				).toBe("PAYLOAD_INVALID");
				expect(
					yield* tagOf(Payloads.decrypt({ path, passphrase: "wrong" })),
				).toBe("PASSPHRASE_INCORRECT");
			}).pipe(Effect.provide(core.layer));
		},
	);
});
