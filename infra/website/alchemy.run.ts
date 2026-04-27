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

export const website = await Website("doc", {
	cwd: websiteDir,
	build: "pnpm build",
	dev: "pnpm dev",
	assets: ".output/public",
	spa: true,
	adopt: true,
	domains: isProd ? ["bage.paulsenon.com"] : undefined,
	url: !isProd,
});

if (isProd) {
	console.log("Blog urls: ");
	for (const domain of website.domains ?? []) {
		console.log("\t- ", `https://${domain.name}`);
	}
	if (website.url) {
		console.log("\t- ", website.url);
	}
} else {
	console.log({
		stage: app.stage,
		url: website.url,
	});
}

await app.finalize();
