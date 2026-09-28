import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import {
	publishedPackages,
	releaseTarballDirectory,
	releaseTarballManifestPath,
} from "./release-config.mjs";

const tarballDirectoryPath = resolve(releaseTarballDirectory);

rmSync(tarballDirectoryPath, { force: true, recursive: true });
mkdirSync(tarballDirectoryPath, { recursive: true });

const entries = [];
const normalizePackedFilePath = (path) =>
	path.startsWith("package/") ? path.slice("package/".length) : path;

const toSortedUniqueList = (values) =>
	[...new Set(values)].sort((left, right) => left.localeCompare(right));

const assertExpectedPackedFiles = ({
	actualFiles,
	expectedFiles,
	packageName,
}) => {
	const actual = toSortedUniqueList(actualFiles.map(normalizePackedFilePath));
	const expected = toSortedUniqueList(expectedFiles);

	const unexpected = actual.filter((path) => !expected.includes(path));
	const missing = expected.filter((path) => !actual.includes(path));

	if (unexpected.length === 0 && missing.length === 0) {
		return;
	}

	console.error(`Unexpected npm pack contents for ${packageName}.`);

	if (unexpected.length > 0) {
		console.error(`Unexpected files:\n${unexpected.join("\n")}`);
	}

	if (missing.length > 0) {
		console.error(`Missing files:\n${missing.join("\n")}`);
	}

	process.exit(1);
};

for (const publishedPackage of publishedPackages) {
	const result = spawnSync(
		"npm",
		[
			"pack",
			"--json",
			"--ignore-scripts",
			"--pack-destination",
			tarballDirectoryPath,
		],
		{
			cwd: publishedPackage.path,
			encoding: "utf8",
		},
	);

	if (result.status !== 0) {
		process.stderr.write(result.stderr);
		process.stdout.write(result.stdout);
		process.exit(result.status ?? 1);
	}

	process.stdout.write(result.stdout);

	let packOutput;
	try {
		packOutput = JSON.parse(result.stdout);
	} catch (error) {
		console.error("Unable to parse npm pack JSON output.");
		console.error(error);
		process.stdout.write(result.stdout);
		process.exit(1);
	}

	const [packedPackage] = packOutput;
	if (!packedPackage) {
		console.error(`npm pack produced no tarball for ${publishedPackage.name}.`);
		process.exit(1);
	}

	if (packedPackage.name !== publishedPackage.name) {
		console.error(
			`Expected npm pack for ${publishedPackage.name}, got ${packedPackage.name}.`,
		);
		process.exit(1);
	}

	assertExpectedPackedFiles({
		actualFiles: packedPackage.files.map((file) => file.path),
		expectedFiles: publishedPackage.expectedPackedFiles,
		packageName: publishedPackage.name,
	});

	const tarballPath = `${releaseTarballDirectory}/${packedPackage.filename}`;
	const tarball = await readFile(tarballPath);
	const sha512 = createHash("sha512").update(tarball).digest("hex");

	entries.push({
		name: publishedPackage.name,
		version: packedPackage.version,
		filename: packedPackage.filename,
		path: tarballPath,
		sha512,
	});
}

writeFileSync(
	releaseTarballManifestPath,
	`${JSON.stringify({ packages: entries }, null, "\t")}\n`,
);
