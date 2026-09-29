import { homedir } from "node:os";
import { join } from "node:path";
import * as CoreLayer from "@better-age/core/CoreLayer";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { noticesLayer, runBage } from "../main.js";
import { error } from "../present.js";
import { nodeUiLayer } from "../ui/nodeUi.js";

declare const __BETTER_AGE_CLI_VERSION__: string | undefined;

const version =
	typeof __BETTER_AGE_CLI_VERSION__ === "string"
		? __BETTER_AGE_CLI_VERSION__
		: "0.0.0-dev";

const layer = Layer.mergeAll(
	CoreLayer.layer({ homeDir: join(homedir(), ".better-age") }),
	noticesLayer,
).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, nodeUiLayer)));

// Closing the terminal (SIGHUP) must clean up like Ctrl-C: runMain interrupts
// on SIGTERM, which closes scopes (editor plaintext temp dir, viewer raw mode).
process.on("SIGHUP", () => process.kill(process.pid, "SIGTERM"));
// Once the terminal is gone, writes fail with EIO; never let that crash cleanup.
for (const stream of [process.stdout, process.stderr]) {
	stream.on("error", () => {});
}

runBage(process.argv.slice(2), version).pipe(
	Effect.tap((exitCode) =>
		Effect.sync(() => {
			process.exitCode = exitCode;
		}),
	),
	// SIGINT/SIGTERM/SIGHUP outside a prompt (e.g. during key derivation or while the
	// editor runs): scopes close, then runMain exits 130.
	Effect.onInterrupt(() =>
		Effect.sync(() => {
			process.stderr.write(error("CANCELLED", "command cancelled"));
		}),
	),
	Effect.provide(layer),
	NodeRuntime.runMain({ disableErrorReporting: true }),
);
