// In-memory `FileSystem` for fast, host-isolated tests. Supports the subset of
// operations Core uses, file modes, and per-call failure injection.
import { Effect, FileSystem, Layer, PlatformError } from "effect";

type Entry =
	| { readonly type: "File"; contents: string; mode: number }
	| { readonly type: "Directory"; mode: number };

export type MemoryFileSystem = {
	readonly entries: Map<string, Entry>;
	/** Return an error to make the next matching call fail. */
	failWhen: (method: string, path: string) => boolean;
	readonly file: (path: string) => string | undefined;
	readonly mode: (path: string) => number | undefined;
	readonly setMode: (path: string, mode: number) => void;
	readonly layer: Layer.Layer<FileSystem.FileSystem>;
};

const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/";

export const makeMemoryFileSystem = (
	initial: Record<string, string> = {},
): MemoryFileSystem => {
	const entries = new Map<string, Entry>([
		["/", { type: "Directory", mode: 0o755 }],
	]);
	const state: MemoryFileSystem = {
		entries,
		failWhen: () => false,
		file: (path) => {
			const entry = entries.get(path);
			return entry?.type === "File" ? entry.contents : undefined;
		},
		mode: (path) => entries.get(path)?.mode,
		setMode: (path, mode) => {
			const entry = entries.get(path);
			if (entry === undefined) throw new Error(`No entry at ${path}`);
			entry.mode = mode;
		},
		layer: Layer.suspend(() => Layer.succeed(FileSystem.FileSystem)(fs)),
	};

	const error = (method: string, path: string, tag: "NotFound" | "Unknown") =>
		PlatformError.systemError({
			_tag: tag,
			module: "FileSystem",
			method,
			pathOrDescriptor: path,
		});

	const guard = <A>(method: string, path: string, run: () => A) =>
		Effect.suspend(() =>
			state.failWhen(method, path)
				? Effect.fail(error(method, path, "Unknown"))
				: Effect.try({
						try: run,
						catch: (cause) =>
							cause instanceof PlatformError.PlatformError
								? cause
								: error(method, path, "Unknown"),
					}),
		);

	// Like Node's recursive mkdir: every created directory gets `mode`.
	const ensureParents = (path: string, mode = 0o755) => {
		const parts = parentOf(path).split("/").filter(Boolean);
		let current = "";
		for (const part of parts) {
			current = `${current}/${part}`;
			if (!entries.has(current)) {
				entries.set(current, { type: "Directory", mode });
			}
		}
	};

	const writeFile = (path: string, contents: string, mode = 0o644) => {
		if (entries.get(parentOf(path))?.type !== "Directory") {
			throw error("writeFileString", path, "NotFound");
		}
		const existing = entries.get(path);
		entries.set(path, {
			type: "File",
			contents,
			mode: existing?.mode ?? mode,
		});
	};

	for (const [path, contents] of Object.entries(initial)) {
		ensureParents(path);
		writeFile(path, contents, 0o600);
	}

	const fs = FileSystem.makeNoop({
		exists: (path) => guard("exists", path, () => entries.has(path)),
		stat: (path) =>
			guard("stat", path, () => {
				const entry = entries.get(path);
				if (entry === undefined) {
					throw error("stat", path, "NotFound");
				}
				return { type: entry.type, mode: entry.mode } as FileSystem.File.Info;
			}),
		chmod: (path, mode) =>
			guard("chmod", path, () => {
				const entry = entries.get(path);
				if (entry === undefined) {
					throw error("chmod", path, "NotFound");
				}
				entry.mode = mode;
			}),
		makeDirectory: (path, options) =>
			guard("makeDirectory", path, () => {
				if (options?.recursive === true) {
					ensureParents(`${path}/x`, options.mode);
				}
				if (!entries.has(path)) {
					entries.set(path, {
						type: "Directory",
						mode: options?.mode ?? 0o755,
					});
				}
			}),
		readFileString: (path) =>
			guard("readFileString", path, () => {
				const entry = entries.get(path);
				if (entry?.type !== "File") {
					throw error("readFileString", path, "NotFound");
				}
				return entry.contents;
			}),
		writeFileString: (path, contents, options) =>
			guard("writeFileString", path, () =>
				writeFile(path, contents, options?.mode),
			),
		rename: (from, to) =>
			guard("rename", from, () => {
				const entry = entries.get(from);
				if (entry === undefined) {
					throw error("rename", from, "NotFound");
				}
				entries.set(to, entry);
				entries.delete(from);
			}),
		remove: (path, options) =>
			guard("remove", path, () => {
				if (!entries.has(path) && options?.force !== true) {
					throw error("remove", path, "NotFound");
				}
				for (const key of [...entries.keys()]) {
					if (key === path || key.startsWith(`${path}/`)) {
						entries.delete(key);
					}
				}
			}),
	});

	return state;
};
