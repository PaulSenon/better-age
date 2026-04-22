import { spawnSync } from "node:child_process";
import process from "node:process";

import { publishedPackages } from "./release-config.mjs";

const script = process.argv[2];

if (!script) {
	console.error("Missing required script name.");
	process.exit(1);
}

for (const publishedPackage of publishedPackages) {
	const result = spawnSync("pnpm", ["--dir", publishedPackage.path, "run", script], {
		stdio: "inherit",
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
