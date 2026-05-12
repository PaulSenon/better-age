import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import process from "node:process";

import {
	publishedPackages,
	releaseTarballDirectory,
	releaseTarballManifestPath,
} from "./release-config.mjs";

const tagFlagIndex = process.argv.indexOf("--tag");
const tag = tagFlagIndex >= 0 ? process.argv[tagFlagIndex + 1] : undefined;

if (!tag) {
	console.error("Missing required --tag <dist-tag> argument.");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(releaseTarballManifestPath, "utf8"));
const manifestPackages = Array.isArray(manifest.packages)
	? manifest.packages
	: [];
const publishedPackageNames = new Set(
	publishedPackages.map((publishedPackage) => publishedPackage.name),
);

for (const manifestPackage of manifestPackages) {
	if (!publishedPackageNames.has(manifestPackage.name)) {
		console.error(`Unexpected release tarball for ${manifestPackage.name}.`);
		process.exit(1);
	}
}

for (const publishedPackage of publishedPackages) {
	const tarball = manifestPackages.find(
		(manifestPackage) => manifestPackage.name === publishedPackage.name,
	);

	if (!tarball) {
		console.error(`Missing release tarball for ${publishedPackage.name}.`);
		process.exit(1);
	}

	if (typeof tarball.path !== "string") {
		console.error(
			`Release tarball path is invalid for ${publishedPackage.name}.`,
		);
		process.exit(1);
	}

	if (
		typeof tarball.filename !== "string" ||
		basename(tarball.filename) !== tarball.filename ||
		!tarball.filename.endsWith(".tgz")
	) {
		console.error(
			`Release tarball filename is invalid for ${publishedPackage.name}.`,
		);
		process.exit(1);
	}

	const expectedTarballPath = `${releaseTarballDirectory}/${tarball.filename}`;
	if (tarball.path !== expectedTarballPath) {
		console.error(
			`Expected tarball path ${expectedTarballPath}, got ${tarball.path}.`,
		);
		process.exit(1);
	}

	if (!existsSync(tarball.path)) {
		console.error(`Release tarball does not exist: ${tarball.path}`);
		process.exit(1);
	}

	if (typeof tarball.sha512 !== "string") {
		console.error(
			`Release tarball checksum is missing for ${publishedPackage.name}.`,
		);
		process.exit(1);
	}

	const actualSha512 = createHash("sha512")
		.update(readFileSync(tarball.path))
		.digest("hex");

	if (actualSha512 !== tarball.sha512) {
		console.error(
			`Release tarball checksum mismatch for ${publishedPackage.name}.`,
		);
		process.exit(1);
	}

	const result = spawnSync(
		"npm",
		[
			"publish",
			tarball.path,
			"--tag",
			tag,
			"--access",
			"public",
			"--ignore-scripts",
		],
		{
			stdio: "inherit",
		},
	);

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}
