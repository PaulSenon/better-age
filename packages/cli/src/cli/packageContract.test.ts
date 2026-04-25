import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readPackageJson = async (path: string) =>
	JSON.parse(await readFile(path, "utf8")) as {
		readonly bin?: Record<string, string>;
		readonly dependencies?: Record<string, string>;
		readonly exports?: Record<string, string>;
		readonly private?: boolean;
		readonly scripts?: Record<string, string>;
	};

describe("package contracts", () => {
	it("publishes the new bage bin from @better-age/cli", async () => {
		const packageJson = await readPackageJson(
			join(process.cwd(), "package.json"),
		);

		expect(packageJson.bin).toEqual({ bage: "./dist/bin/bage.js" });
		expect(packageJson.scripts?.build).toBe("tsc -p tsconfig.build.json");
		expect(packageJson.dependencies).not.toHaveProperty(
			"@better-age/cli-legacy",
		);
	});

	it("keeps cli-legacy private and without a bage bin", async () => {
		const legacyPackageJson = await readPackageJson(
			join(process.cwd(), "../cli-legacy/package.json"),
		);

		expect(legacyPackageJson.private).toBe(true);
		expect(legacyPackageJson.bin).toBeUndefined();
	});
});
