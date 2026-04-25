import { build } from "esbuild";

await build({
	entryPoints: ["src/cli/main.ts"],
	outfile: "dist/cli.cjs",
	bundle: true,
	platform: "node",
	minify: true,
	format: "cjs",
	target: "node24",
	sourcemap: true,
	banner: {
		js: "#!/usr/bin/env node",
	},
	external: [],
});
