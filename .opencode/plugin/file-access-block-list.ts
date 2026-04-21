/**
 * - Prevent opencode to read *.local files
 * - Prevent opencode to edit package.json (and ask using commands)
 */

import type { Plugin } from "@opencode-ai/plugin";

// doc: https://opencode.ai/docs/plugins/
export const FileBlockList: Plugin = async () => {
	return {
		"tool.execute.before": async (input, output) => {
			if (input.tool === "read" && output.args.filePath.includes(".local")) {
				throw new Error("Do not read .env files");
			}

			if (
				input.tool === "edit" &&
				output.args.filePath.includes("package.json")
			) {
				throw new Error(
					"Do not edit package.json manually. You must use pnpm commands to edit it. (e.g. to install a new dependency etc...)",
				);
			}

			if (
				input.tool === "read" &&
				(output.args.filePath.includes("Makefile") ||
					output.args.filePath.includes("docker/dev"))
			) {
				throw new Error("These files are not relevant for you. Ignore them");
			}
		},
	};
};
