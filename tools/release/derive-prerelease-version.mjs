import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import { prereleaseDistTag, publishedPackages } from "./release-config.mjs";

const channelFlagIndex = process.argv.indexOf("--channel");
const channel = channelFlagIndex >= 0 ? process.argv[channelFlagIndex + 1] : undefined;

if (!channel) {
	console.error("Missing required --channel <name> argument.");
	process.exit(1);
}

if (channel !== prereleaseDistTag) {
	console.error(`Unsupported prerelease channel '${channel}'. Expected '${prereleaseDistTag}'.`);
	process.exit(1);
}

const parseSemver = (value) => {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
	if (!match) {
		return undefined;
	}

	const [, major, minor, patch] = match;
	if (!major || !minor || !patch) {
		return undefined;
	}

	return {
		major: Number(major),
		minor: Number(minor),
		patch: Number(patch),
	};
};

const basePackage = publishedPackages[0];
if (!basePackage) {
	console.error("No published packages configured.");
	process.exit(1);
}

const packageJsonPath = `${basePackage.path}/package.json`;
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;
const parsed = parseSemver(version);

if (!parsed) {
	console.error(`Expected stable semver before prerelease derivation, got '${version}'.`);
	process.exit(1);
}

const runNumber = process.env.GITHUB_RUN_NUMBER ?? "0";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
const prereleaseVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}-${channel}.${runNumber}.${runAttempt}`;

for (const publishedPackage of publishedPackages) {
	const publishedPackageJsonPath = `${publishedPackage.path}/package.json`;
	const publishedPackageJson = JSON.parse(readFileSync(publishedPackageJsonPath, "utf8"));
	publishedPackageJson.version = prereleaseVersion;
	writeFileSync(publishedPackageJsonPath, `${JSON.stringify(publishedPackageJson, null, "\t")}\n`);
}

const githubOutputFlag = process.argv.includes("--github-output");
if (githubOutputFlag) {
	const githubOutputPath = process.env.GITHUB_OUTPUT;
	if (!githubOutputPath) {
		console.error("GITHUB_OUTPUT is required when using --github-output.");
		process.exit(1);
	}

	writeFileSync(githubOutputPath, `version=${prereleaseVersion}\n`, { flag: "a" });
}
