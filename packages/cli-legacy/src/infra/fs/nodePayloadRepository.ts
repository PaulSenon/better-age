import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import { Effect, Layer } from "effect";
import { PayloadRepository } from "../../port/PayloadRepository.js";
import {
	PayloadReadError,
	PayloadWriteError,
} from "../../port/PayloadRepositoryError.js";

const writeFileAtomically = async (targetPath: string, contents: string) => {
	const tempPath = `${targetPath}.tmp`;
	await fs.mkdir(dirname(targetPath), { recursive: true });
	await fs.writeFile(tempPath, contents, "utf8");
	await fs.rename(tempPath, targetPath);
};

export const makeNodePayloadRepository = () =>
	PayloadRepository.make({
		readFile: (path) =>
			Effect.tryPromise({
				catch: () =>
					new PayloadReadError({
						message: "Failed to read payload file",
						path,
					}),
				try: () => fs.readFile(path, "utf8"),
			}),
		writeFile: (path, contents) =>
			Effect.tryPromise({
				catch: () =>
					new PayloadWriteError({
						message: "Failed to write payload file",
						path,
					}),
				try: () => writeFileAtomically(path, contents),
			}),
	});

export const NodePayloadRepositoryLive = Layer.succeed(
	PayloadRepository,
	makeNodePayloadRepository(),
);
