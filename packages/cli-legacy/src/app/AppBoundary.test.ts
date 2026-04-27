import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appRoot = new URL(".", import.meta.url);

const collectTypeScriptFiles = (directory: URL): Array<string> => {
	const files: Array<string> = [];

	for (const entry of readdirSync(directory)) {
		const entryUrl = new URL(entry, directory);
		const entryPath = entryUrl.pathname;
		const stats = statSync(entryUrl);

		if (stats.isDirectory()) {
			files.push(...collectTypeScriptFiles(new URL(`${entry}/`, directory)));
			continue;
		}

		if (entryPath.endsWith(".ts") && !entryPath.endsWith(".test.ts")) {
			files.push(entryPath);
		}
	}

	return files;
};

describe("app boundary", () => {
	it("does not import cli modules from app layer", () => {
		const appFiles = collectTypeScriptFiles(appRoot);
		const violations = appFiles.flatMap((filePath) => {
			const source = readFileSync(filePath, "utf8");
			const matches = [...source.matchAll(/from\s+["']([^"']+)["']/g)];

			return matches
				.flatMap((match) => {
					const specifier = match[1];
					return specifier === undefined ? [] : [specifier];
				})
				.filter((specifier) => specifier.includes("/cli/"))
				.map((specifier) => ({
					filePath,
					specifier,
				}));
		});

		expect(violations).toEqual([]);
	});
});
