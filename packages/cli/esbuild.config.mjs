import { chmod } from "node:fs/promises";
import { build } from "esbuild";

const outfile = "dist/bage";

await build({
	banner: {
		js: [
			"#!/usr/bin/env node",
			'import { createRequire as __createRequire } from "node:module";',
			"const require = __createRequire(import.meta.url);",
		].join("\n"),
	},
	bundle: true,
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
