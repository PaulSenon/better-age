import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { makeNodeTempFile } from "./nodeTempFile.js";

const createdDirectories: Array<string> = [];

const makeTempDirectory = async () => {
	const directory = await fs.mkdtemp(join(tmpdir(), "better-age-tempfile-"));
	createdDirectories.push(directory);
	return directory;
};

describe("nodeTempFile", () => {
	afterEach(async () => {
		await Promise.all(
			createdDirectories
				.splice(0)
				.map((directory) => fs.rm(directory, { force: true, recursive: true })),
		);
	});

	it("creates temp file with initial contents, reads it back, then deletes it", async () => {
		const rootDirectory = await makeTempDirectory();
		const tempFile = makeNodeTempFile({ rootDirectory });

		const created = await Effect.runPromise(
			tempFile.create({
				extension: ".env",
				initialContents: "API_TOKEN=secret\n",
			}),
		);
		const contents = await Effect.runPromise(tempFile.read(created.path));

		expect(contents).toBe("API_TOKEN=secret\n");

		await Effect.runPromise(tempFile.delete(created.path));

		await expect(fs.access(created.path)).rejects.toThrow();
	});
});
