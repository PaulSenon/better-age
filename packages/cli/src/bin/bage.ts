import { stderr, stdout } from "node:process";
import { createNodeCli } from "../cli/nodeCli.js";
import { createNodeTerminal } from "../cli/nodeTerminal.js";

const result = await createNodeCli({
	terminal: createNodeTerminal(),
}).run(process.argv.slice(2));

stdout.write(result.stdout);
stderr.write(result.stderr);
process.exitCode = result.exitCode;
