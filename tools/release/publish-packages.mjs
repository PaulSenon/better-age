import { spawnSync } from "node:child_process";
import process from "node:process";

import { publishedPackages } from "./release-config.mjs";

const tagFlagIndex = process.argv.indexOf("--tag");
const tag = tagFlagIndex >= 0 ? process.argv[tagFlagIndex + 1] : undefined;

if (!tag) {
	console.error("Missing required --tag <dist-tag> argument.");
	process.exit(1);
}

for (const publishedPackage of publishedPackages) {
	// Trusted publishing is handled by the npm CLI in GitHub Actions OIDC
	// environments, so publish through npm even though the repo uses pnpm.
	const result = spawnSync(
		"npm",
		["publish", "--tag", tag, "--access", "public"],
		{
			cwd: publishedPackage.path,
			stdio: "inherit",
		},
	);

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
