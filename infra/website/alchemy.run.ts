import path from "node:path";
import { fileURLToPath } from "node:url";

import alchemy from "alchemy";
import { Website } from "alchemy/cloudflare";

const app = await alchemy("website");
const isProd = app.stage === "prod";

const thisFile = fileURLToPath(import.meta.url);
const infraDir = path.dirname(thisFile);
const repoRoot = path.resolve(infraDir, "../..");
const websiteDir = path.join(repoRoot, "apps/website");

export const website = await Website("website", {
	cwd: websiteDir,
	build: "pnpm build",
	dev: "pnpm dev",
	assets: ".output/public",
	spa: true,
	adopt: true,
	domains: isProd ? ["bage.isaaac.dev"] : undefined,
	url: !isProd,
});

console.log({
	stage: app.stage,
	url: website.url,
});

await app.finalize();
