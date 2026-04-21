import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);
const packageDirPath = path.resolve(currentDirPath, "../../..");

describe("package manifest", () => {
	it("exports a dedicated varlock plugin entrypoint", async () => {
		const packageJsonText = await readFile(
			path.join(packageDirPath, "package.json"),
			"utf8",
		);
		const packageJson = JSON.parse(packageJsonText) as {
			exports?: Record<string, string>;
			name?: string;
		};

		expect(packageJson.name).toBe("@better-age/varlock");
		expect(packageJson.exports?.["./plugin"]).toBe("./dist/plugin.cjs");
	});
});
