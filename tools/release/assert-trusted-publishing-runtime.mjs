import { spawnSync } from "node:child_process";
import process from "node:process";

const minimumNodeVersion = "22.14.0";
const minimumNpmVersion = "11.5.1";

const parseVersion = (version) => {
	const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
	if (!match) {
		return undefined;
	}

	const [, major, minor, patch] = match;
	return [Number(major), Number(minor), Number(patch)];
};

const compareVersions = (actual, minimum) => {
	for (let index = 0; index < minimum.length; index += 1) {
		const actualPart = actual[index] ?? 0;
		const minimumPart = minimum[index] ?? 0;

		if (actualPart > minimumPart) {
			return 1;
		}

		if (actualPart < minimumPart) {
			return -1;
		}
	}

	return 0;
};

const assertMinimumVersion = ({ actual, minimum, name }) => {
	const parsedActual = parseVersion(actual);
	const parsedMinimum = parseVersion(minimum);

	if (!parsedActual || !parsedMinimum) {
		console.error(`Unable to parse ${name} version. Got '${actual}'.`);
		process.exit(1);
	}

	if (compareVersions(parsedActual, parsedMinimum) < 0) {
		console.error(
			`${name} ${minimum} or newer is required for npm trusted publishing. Got ${actual}.`,
		);
		process.exit(1);
	}
};

const npmVersionResult = spawnSync("npm", ["--version"], {
	encoding: "utf8",
});

if (npmVersionResult.status !== 0) {
	process.stderr.write(npmVersionResult.stderr);
	process.exit(npmVersionResult.status ?? 1);
}

assertMinimumVersion({
	actual: process.version,
	minimum: minimumNodeVersion,
	name: "Node",
});

assertMinimumVersion({
	actual: npmVersionResult.stdout,
	minimum: minimumNpmVersion,
	name: "npm",
});
