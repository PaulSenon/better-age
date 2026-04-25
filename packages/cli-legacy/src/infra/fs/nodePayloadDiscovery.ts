import { promises as fs } from "node:fs";
import { Effect, Layer } from "effect";
import { PayloadDiscovery } from "../../port/PayloadDiscovery.js";
import { PayloadDiscoveryError } from "../../port/PayloadDiscoveryError.js";

const payloadFileNamePattern = /^\.env.*\.enc$/;

export const makeNodePayloadDiscovery = () =>
	PayloadDiscovery.make({
		discoverFromCwd: Effect.tryPromise({
			try: async () => {
				const cwd = process.cwd();
				const entries = await fs.readdir(cwd, {
					withFileTypes: true,
				});

				return entries
					.filter(
						(entry) =>
							entry.isFile() && payloadFileNamePattern.test(entry.name),
					)
					.map((entry) => `./${entry.name}`)
					.sort((left, right) => left.localeCompare(right));
			},
			catch: (cause) =>
				new PayloadDiscoveryError({
					message: `Failed to discover payloads in ${process.cwd()}: ${String(cause)}`,
				}),
		}),
	});

export const NodePayloadDiscoveryLive = Layer.succeed(
	PayloadDiscovery,
	makeNodePayloadDiscovery(),
);
