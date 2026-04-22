import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import { publishedPackages } from "./release-config.mjs";

const readPackageVersion = (packagePath) => {
	const packageJson = JSON.parse(readFileSync(`${packagePath}/package.json`, "utf8"));
	return packageJson.version;
};

const versions = [...new Set(publishedPackages.map((publishedPackage) => readPackageVersion(publishedPackage.path)))];

if (versions.length !== 1) {
	console.error(`Expected one shared published package version, got: ${versions.join(", ")}`);
	process.exit(1);
}

const [version] = versions;
if (!version) {
	console.error("Unable to resolve release version.");
	process.exit(1);
}

const tag = `v${version}`;
const githubOutputFlag = process.argv.includes("--github-output");

if (githubOutputFlag) {
	const githubOutputPath = process.env.GITHUB_OUTPUT;
	if (!githubOutputPath) {
		console.error("GITHUB_OUTPUT is required when using --github-output.");
		process.exit(1);
	}

	writeFileSync(githubOutputPath, `version=${version}\ntag=${tag}\n`, { flag: "a" });
} else {
	process.stdout.write(`${version}\n`);
}
