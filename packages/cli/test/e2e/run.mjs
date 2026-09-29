// Host entry for the real-terminal E2E suite: builds the bundle, then runs the
// scenarios in a locked-down, uniquely named container. The container is
// always force-removed (success, failure, global timeout, or Ctrl-C), and never
// sees the host HOME, the network, or credentials.
//
//   pnpm -F @better-age/cli test:e2e
//   BAGE_E2E_TIMEOUT_MS=600000   global wall clock (default 5 min)
//   BAGE_E2E_ONLY=<substring>    run matching scenarios only
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Node 24 (bookworm-slim) with util-linux `script`; pinned by digest.
const image =
	process.env.BAGE_E2E_IMAGE ??
	"node:lts-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c";
const timeoutMs = Number(process.env.BAGE_E2E_TIMEOUT_MS ?? 300_000);
const name = `bage-e2e-${randomUUID()}`;
const e2eDir = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(e2eDir, "../..");

const removeContainer = () =>
	spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });

execFileSync(process.execPath, ["esbuild.config.mjs"], {
	cwd: cliRoot,
	stdio: "inherit",
});

const child = spawn(
	"docker",
	[
		"run",
		`--name=${name}`,
		"--rm",
		"--init",
		"--network=none",
		"--read-only",
		"--tmpfs=/tmp:rw,exec,mode=1777",
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges",
		"--pids-limit=256",
		"--memory=1g",
		"--user=node",
		"--env=HOME=/tmp",
		...["BAGE_E2E_ONLY", "BAGE_E2E_EXPECT_TIMEOUT_MS"]
			.filter((key) => process.env[key] !== undefined)
			.map((key) => `--env=${key}=${process.env[key]}`),
		`--volume=${join(cliRoot, "dist")}:/opt/bage:ro`,
		`--volume=${e2eDir}:/e2e:ro`,
		image,
		"node",
		"/e2e/scenarios.mjs",
	],
	{ stdio: "inherit" },
);

const timer = setTimeout(() => {
	console.error(`E2E exceeded ${timeoutMs}ms; removing container ${name}`);
	removeContainer();
}, timeoutMs);
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		removeContainer();
		process.exit(130);
	});
}

child.on("exit", (code) => {
	clearTimeout(timer);
	removeContainer();
	process.exit(code ?? 1);
});
