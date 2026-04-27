import { describe, expect, it, vi } from "vitest";

const notFound = () =>
	Object.assign(new Error("not found"), { code: "ENOENT" });

describe("node home repository key transaction", () => {
	it("keeps committed new keys when backup cleanup fails", async () => {
		vi.resetModules();
		const files = new Map<string, string>([
			["/home/keys/a.age", "old-a"],
			["/home/keys/b.age", "old-b"],
		]);
		const directories = new Set(["/home", "/home/keys"]);
		const backupCleanupFailure = Object.assign(
			new Error("cannot unlink backup"),
			{
				code: "EACCES",
			},
		);

		vi.doMock("node:fs/promises", () => ({
			chmod: vi.fn(),
			mkdir: vi.fn(async (path: string) => {
				directories.add(path);
			}),
			readFile: vi.fn(async (path: string) => {
				const contents = files.get(path);

				if (contents === undefined) {
					throw notFound();
				}

				return contents;
			}),
			rename: vi.fn(async (from: string, to: string) => {
				const contents = files.get(from);

				if (contents === undefined) {
					throw notFound();
				}

				files.set(to, contents);
				files.delete(from);
			}),
			rm: vi.fn(async (path: string) => {
				if (path === "/home/keys/b.age.bak") {
					throw backupCleanupFailure;
				}

				files.delete(path);
			}),
			stat: vi.fn(async (path: string) => {
				if (directories.has(path)) {
					return { mode: 0o700 };
				}

				if (files.has(path)) {
					return { mode: 0o600 };
				}

				throw notFound();
			}),
			writeFile: vi.fn(async (path: string, contents: string) => {
				files.set(path, contents);
			}),
		}));

		const { createNodeHomeRepository } = await import("./RealCoreAdapters.js");
		const repository = createNodeHomeRepository({ homeDir: "/home" });

		await expect(
			repository.replaceEncryptedPrivateKeys({
				keys: [
					{ encryptedKey: "new-a", ref: "keys/a.age" },
					{ encryptedKey: "new-b", ref: "keys/b.age" },
				],
			}),
		).resolves.toBeUndefined();

		expect(files.get("/home/keys/a.age")).toBe("new-a");
		expect(files.get("/home/keys/b.age")).toBe("new-b");
		expect(files.has("/home/keys/.passphrase-change.json")).toBe(false);
		expect(files.has("/home/keys/a.age.new")).toBe(false);
		expect(files.has("/home/keys/b.age.new")).toBe(false);
	});

	it("rejects direct key refs outside the managed keys directory", async () => {
		vi.resetModules();
		const files = new Map<string, string>();
		const directories = new Set(["/home", "/home/keys"]);

		vi.doMock("node:fs/promises", () => ({
			chmod: vi.fn(),
			mkdir: vi.fn(async (path: string) => {
				directories.add(path);
			}),
			readFile: vi.fn(async (path: string) => files.get(path) ?? ""),
			rename: vi.fn(),
			rm: vi.fn(),
			stat: vi.fn(async (path: string) => {
				if (directories.has(path)) {
					return { mode: 0o700 };
				}

				if (files.has(path)) {
					return { mode: 0o600 };
				}

				throw notFound();
			}),
			writeFile: vi.fn(async (path: string, contents: string) => {
				files.set(path, contents);
			}),
		}));

		const { createNodeHomeRepository } = await import("./RealCoreAdapters.js");
		const repository = createNodeHomeRepository({ homeDir: "/home" });

		await expect(
			repository.writeEncryptedPrivateKey({
				encryptedKey: "secret",
				ref: "../outside.age",
			}),
		).rejects.toThrow("PRIVATE_KEY_REF_INVALID");
		await expect(
			repository.readEncryptedPrivateKey("/tmp/outside.age"),
		).rejects.toThrow("PRIVATE_KEY_REF_INVALID");
		await expect(
			repository.replaceEncryptedPrivateKeys({
				keys: [{ encryptedKey: "secret", ref: "keys/../../outside.age" }],
			}),
		).rejects.toThrow("PRIVATE_KEY_REF_INVALID");
		expect(files.size).toBe(0);
	});

	it("maps missing key files to local key missing", async () => {
		vi.resetModules();
		const files = new Map<string, string>();
		const directories = new Set(["/home", "/home/keys"]);

		vi.doMock("node:fs/promises", () => ({
			chmod: vi.fn(),
			mkdir: vi.fn(async (path: string) => {
				directories.add(path);
			}),
			readFile: vi.fn(async (path: string) => {
				const contents = files.get(path);

				if (contents === undefined) {
					throw notFound();
				}

				return contents;
			}),
			rename: vi.fn(),
			rm: vi.fn(),
			stat: vi.fn(async (path: string) => {
				if (directories.has(path)) {
					return { mode: 0o700 };
				}

				if (files.has(path)) {
					return { mode: 0o600 };
				}

				throw notFound();
			}),
			writeFile: vi.fn(async (path: string, contents: string) => {
				files.set(path, contents);
			}),
		}));

		const { createNodeHomeRepository } = await import("./RealCoreAdapters.js");
		const repository = createNodeHomeRepository({ homeDir: "/home" });

		await expect(
			repository.readEncryptedPrivateKey("keys/missing.age"),
		).rejects.toThrow("LOCAL_KEY_MISSING");
	});
});

describe("node payload repository", () => {
	it("writes encrypted payloads through same-directory temp then rename", async () => {
		vi.resetModules();
		const files = new Map<string, string>();
		const directories = new Set<string>();
		const writes: Array<string> = [];
		const renames: Array<{ readonly from: string; readonly to: string }> = [];

		vi.doMock("node:fs/promises", () => ({
			chmod: vi.fn(),
			mkdir: vi.fn(async (path: string) => {
				directories.add(path);
			}),
			readFile: vi.fn(async (path: string) => {
				const contents = files.get(path);

				if (contents === undefined) {
					throw notFound();
				}

				return contents;
			}),
			rename: vi.fn(async (from: string, to: string) => {
				const contents = files.get(from);

				if (contents === undefined) {
					throw notFound();
				}

				renames.push({ from, to });
				files.set(to, contents);
				files.delete(from);
			}),
			rm: vi.fn(async (path: string) => {
				files.delete(path);
			}),
			stat: vi.fn(async () => ({ mode: 0o700 })),
			writeFile: vi.fn(async (path: string, contents: string) => {
				writes.push(path);
				files.set(path, contents);
			}),
		}));

		const { createNodePayloadRepository } = await import(
			"./RealCoreAdapters.js"
		);
		const repository = createNodePayloadRepository();

		await repository.writePayloadFile("/project/.env.enc", "encrypted wrapper");

		expect(writes).toEqual(["/project/.env.enc.tmp"]);
		expect(renames).toEqual([
			{ from: "/project/.env.enc.tmp", to: "/project/.env.enc" },
		]);
		expect(files.get("/project/.env.enc")).toBe("encrypted wrapper");
		expect(files.has("/project/.env.enc.tmp")).toBe(false);
	});

	it("removes encrypted payload temp file when atomic replace fails", async () => {
		vi.resetModules();
		const files = new Map<string, string>([
			["/project/.env.enc", "old encrypted wrapper"],
		]);
		const removed: Array<string> = [];

		vi.doMock("node:fs/promises", () => ({
			chmod: vi.fn(),
			mkdir: vi.fn(),
			readFile: vi.fn(async (path: string) => files.get(path) ?? ""),
			rename: vi.fn(async () => {
				throw new Error("rename failed");
			}),
			rm: vi.fn(async (path: string) => {
				removed.push(path);
				files.delete(path);
			}),
			stat: vi.fn(async () => ({ mode: 0o700 })),
			writeFile: vi.fn(async (path: string, contents: string) => {
				files.set(path, contents);
			}),
		}));

		const { createNodePayloadRepository } = await import(
			"./RealCoreAdapters.js"
		);
		const repository = createNodePayloadRepository();

		await expect(
			repository.writePayloadFile("/project/.env.enc", "new encrypted wrapper"),
		).rejects.toThrow("rename failed");

		expect(files.get("/project/.env.enc")).toBe("old encrypted wrapper");
		expect(files.has("/project/.env.enc.tmp")).toBe(false);
		expect(removed).toEqual(["/project/.env.enc.tmp"]);
	});
});
