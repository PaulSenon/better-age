import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(process.cwd(), "../..");

const readRepoFile = async (path: string) =>
	await readFile(join(repoRoot, path), "utf8");

describe("release documentation", () => {
	it("documents CLI install, build, commands, output policy, and limitations", async () => {
		const readme = await readRepoFile("packages/cli/README.md");

		expect(readme).toContain("## Install / Build");
		expect(readme).toContain("pnpm -F @better-age/cli build");
		expect(readme).toContain("## Command List");
		expect(readme).toContain("bage identity passphrase");
		expect(readme).toContain("## Machine Output Policy");
		expect(readme).toContain("load --protocol-version=1");
		expect(readme).toContain("identity export");
		expect(readme).toContain("## Known Limitations");
		expect(readme).toContain("Docker and pseudo-TTY E2E are deferred");
	});

	it("documents varlock bage launcher assumptions and custom launcher behavior", async () => {
		const readme = await readRepoFile("packages/varlock/README.md");

		expect(readme).toContain("## Bage Launcher Assumption");
		expect(readme).toContain("bage load --protocol-version=1 <path>");
		expect(readme).toContain("command=");
		expect(readme).toContain("launcher prefix only");
		expect(readme).toContain("stdin is inherited");
		expect(readme).toContain("stderr is inherited");
	});

	it("documents package roles without presenting legacy as releasable", async () => {
		const readme = await readRepoFile("README.md");

		expect(readme).toContain("@better-age/core");
		expect(readme).toContain("@better-age/cli");
		expect(readme).toContain("@better-age/varlock");
		expect(readme).toContain("@better-age/cli-legacy");
		expect(readme).toContain("private reference package");
		expect(readme).toContain("not a releasable product");
	});

	it("keeps a manual QA checklist for terminal behaviors", async () => {
		const manualQa = await readRepoFile("docs/manual-qa.md");

		expect(manualQa).toContain("Hidden passphrase prompt");
		expect(manualQa).toContain("Editor launching and remembered preference");
		expect(manualQa).toContain("Secure viewer scrolling and quit");
		expect(manualQa).toContain("Interactive menu loop");
		expect(manualQa).toContain("Clean stdout for load");
		expect(manualQa).toContain("Clean stdout for identity export");
		expect(manualQa).toContain("Docker and pseudo-TTY E2E are deferred");
	});
});
