#!/usr/bin/env node
// Idempotent setup for a fresh git worktree of this repo (T3, `git worktree add`, ...).
//
// 1. `pnpm install --frozen-lockfile` so the worktree owns its node_modules
//    (never shared: pnpm links from its global content store, per worktree).
// 2. Symlink gitignored, read-only agent reference clones (`.llms/references`)
//    from the primary checkout when present there and absent here.
//
// Never overwrites an existing path, never copies secrets, never touches build
// output, caches, or home-directory state. `--check` reports without changing.
import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	readFileSync,
	readlinkSync,
	symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

// Only gitignored, read-only, collision-free assets belong here.
const sharedPaths = [".llms/references"];

const checkOnly = process.argv.includes("--check");

const git = (...args) => {
	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
	}
	return result.stdout.trim();
};

const worktreeRoot = git("rev-parse", "--show-toplevel");
// The common git dir lives in the primary checkout (`<primary>/.git`).
const primaryRoot = dirname(
	resolve(worktreeRoot, git("rev-parse", "--git-common-dir")),
);
const isPrimary = resolve(primaryRoot) === resolve(worktreeRoot);

let problems = 0;
const report = (status, message) => {
	if (status === "missing") problems++;
	console.log(`[${status}] ${message}`);
};

const linkSharedPath = (path) => {
	const source = join(primaryRoot, path);
	const target = join(worktreeRoot, path);

	if (!existsSync(source)) {
		report("skip", `${path}: not present in primary checkout`);
		return;
	}

	const targetStat = lstatSync(target, { throwIfNoEntry: false });
	if (targetStat?.isSymbolicLink()) {
		report("ok", `${path} -> ${readlinkSync(target)}`);
		return;
	}
	if (targetStat !== undefined) {
		report("ok", `${path}: local copy kept (not replaced)`);
		return;
	}
	if (checkOnly) {
		report("missing", `${path}: would link from ${source}`);
		return;
	}

	symlinkSync(source, target, "dir");
	report("linked", `${path} -> ${source}`);
};

const installDependencies = () => {
	if (checkOnly) {
		// pnpm keeps a copy of the installed lockfile; equal content = up to date.
		const installedLock = join(worktreeRoot, "node_modules/.pnpm/lock.yaml");
		const upToDate =
			existsSync(installedLock) &&
			readFileSync(installedLock, "utf8") ===
				readFileSync(join(worktreeRoot, "pnpm-lock.yaml"), "utf8");
		report(
			upToDate ? "ok" : "missing",
			"node_modules installed from pnpm-lock.yaml",
		);
		return;
	}

	const result = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
		cwd: worktreeRoot,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		throw new Error("pnpm install --frozen-lockfile failed");
	}
	report("ok", "node_modules installed from pnpm-lock.yaml");
};

console.log(
	`worktree: ${worktreeRoot}${isPrimary ? " (primary checkout)" : `\nprimary:  ${primaryRoot}`}`,
);
installDependencies();
if (!isPrimary) {
	for (const path of sharedPaths) linkSharedPath(path);
}

if (checkOnly && problems > 0) {
	console.log("run `node tools/worktree/init.mjs` to fix");
	process.exitCode = 1;
}
