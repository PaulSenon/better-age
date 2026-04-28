import { chmod, readFile } from "node:fs/promises";
import { build } from "esbuild";

const outfile = "dist/bage";
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

await build({
	banner: {
		js: [
			"#!/usr/bin/env node",
			'import { createRequire as __createRequire } from "node:module";',
			"const require = __createRequire(import.meta.url);",
		].join("\n"),
	},
	bundle: true,
	define: {
		__BETTER_AGE_CLI_VERSION__: JSON.stringify(packageJson.version),
	},
	entryPoints: ["src/bin/bage.ts"],
	external: [],
	format: "esm",
	minify: true,
	outfile,
	platform: "node",
	sourcemap: false,
	target: "node24",
});

await chmod(outfile, 0o755);
