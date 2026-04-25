import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { makeNodePayloadRepository } from "./nodePayloadRepository.js";

const createdDirectories: Array<string> = [];

const makeTempDirectory = async () => {
	const directory = await fs.mkdtemp(join(tmpdir(), "better-age-payload-"));
	createdDirectories.push(directory);
	return directory;
};

describe("nodePayloadRepository", () => {
	afterEach(async () => {
		await Promise.all(
			createdDirectories
				.splice(0)
				.map((directory) => fs.rm(directory, { force: true, recursive: true })),
		);
	});

	it("writes then reads payload files", async () => {
		const rootDirectory = await makeTempDirectory();
		const payloadPath = join(rootDirectory, ".env.enc");
		const repository = makeNodePayloadRepository();

		await Effect.runPromise(
			repository.writeFile(
				payloadPath,
				"-----BEGIN BETTER-SECRETS PAYLOAD-----",
			),
		);
		const contents = await Effect.runPromise(repository.readFile(payloadPath));

		expect(contents).toBe("-----BEGIN BETTER-SECRETS PAYLOAD-----");
	});

	it("returns typed error when payload file is missing", async () => {
		const rootDirectory = await makeTempDirectory();
		const payloadPath = join(rootDirectory, "missing.env.enc");
		const repository = makeNodePayloadRepository();

		const result = await Effect.runPromise(
			repository.readFile(payloadPath).pipe(Effect.either),
		);

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left._tag).toBe("PayloadReadError");
			expect(result.left.message).toBe("Failed to read payload file");
			expect(result.left.path).toBe(payloadPath);
		}
	});
});
