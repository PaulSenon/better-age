// Core wired for tests: in-memory home + payload files, fake age crypto,
// deterministic ids, and captured notices.
import { Crypto, Effect, Layer, Path } from "effect";
import { type Notice, Notices } from "../../src/Notices.js";
import { HomeStore } from "../../src/services/HomeStore.js";
import { PayloadFiles } from "../../src/services/PayloadFiles.js";
import { makeFakeAgeCrypto } from "./FakeAgeCrypto.js";
import { makeMemoryFileSystem } from "./MemoryFileSystem.js";

export const testHomeDir = "/home/user/.better-age";

// Shared by every test core so separate homes never collide on ids.
let counter = 0;

/** Counter-based bytes: uuids are unique within a test run. */
export const deterministicCrypto = () =>
	Layer.succeed(Crypto.Crypto)(
		Crypto.make({
			randomBytes: (size) => {
				counter += 1;
				const bytes = new Uint8Array(size);
				new DataView(bytes.buffer).setUint32(size - 4, counter);
				return bytes;
			},
			digest: () => Effect.die("unused"),
		}),
	);

export const makeTestCore = (
	options: {
		readonly files?: Record<string, string>;
		readonly corruptEncrypt?: () => boolean;
	} = {},
) => {
	const fs = makeMemoryFileSystem(options.files);
	const notices: Array<Notice> = [];
	const platform = Layer.mergeAll(fs.layer, Path.layer, deterministicCrypto());
	const layer = Layer.mergeAll(
		HomeStore.layer({ homeDir: testHomeDir }),
		PayloadFiles.layer,
		makeFakeAgeCrypto(options),
		Layer.succeed(Notices)({
			report: (notice) => Effect.sync(() => notices.push(notice)),
		}),
	).pipe(Layer.provideMerge(platform));

	return { fs, notices, layer };
};
