import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { TempFile } from "../../port/TempFile.js";
import {
	TempFileCreateError,
	TempFileDeleteError,
	TempFileReadError,
} from "../../port/TempFileError.js";

export const makeNodeTempFile = (input?: { readonly rootDirectory?: string }) =>
	TempFile.make({
		create: (request) =>
			Effect.tryPromise({
				catch: () =>
					new TempFileCreateError({
						message: "Failed to create temp file",
					}),
				try: async () => {
					const rootDirectory = input?.rootDirectory ?? tmpdir();
					const filePath = join(
						rootDirectory,
						`better-age-${randomUUID()}${request.extension}`,
					);
					await fs.writeFile(filePath, request.initialContents, "utf8");
					return {
						path: filePath,
					};
				},
			}),
		delete: (path) =>
			Effect.tryPromise({
				catch: () =>
					new TempFileDeleteError({
						message: "Failed to delete temp file",
						path,
					}),
				try: () => fs.rm(path, { force: true }),
			}),
		read: (path) =>
			Effect.tryPromise({
				catch: () =>
					new TempFileReadError({
						message: "Failed to read temp file",
						path,
					}),
				try: () => fs.readFile(path, "utf8"),
			}),
	});

export const NodeTempFileLive = Layer.succeed(TempFile, makeNodeTempFile());
