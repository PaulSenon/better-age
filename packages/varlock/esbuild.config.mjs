import { build } from "esbuild";

await build({
	entryPoints: ["src/plugin.ts"],
	outfile: "dist/plugin.cjs",
	bundle: true,
	platform: "node",
	minify: true,
	format: "cjs",
	target: "node24",
	sourcemap: true,
	external: ["varlock/plugin-lib"],
});
