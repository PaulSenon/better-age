import { promises as fs } from "node:fs";
import { Effect, Layer } from "effect";
import { PathAccess } from "../../port/PathAccess.js";

export const makeNodePathAccess = () =>
	PathAccess.make({
		exists: (path) =>
			Effect.promise(async () => {
				try {
					await fs.access(path);
					return true;
				} catch {
					return false;
				}
			}),
	});

export const NodePathAccessLive = Layer.succeed(
	PathAccess,
	makeNodePathAccess(),
);
