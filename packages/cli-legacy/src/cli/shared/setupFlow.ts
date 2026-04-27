import { hostname, userInfo } from "node:os";
import { Effect } from "effect";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import { HomeRepository } from "../../port/HomeRepository.js";
import { InteractivePrompt } from "../../port/InteractivePrompt.js";
import { Prompt } from "../../port/Prompt.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { promptForConfirmedPassphrase } from "./passphrasePairPrompt.js";

type SetupGateAction = "back" | "cancel" | "setup-now";

export const defaultSetupAlias = () => `${userInfo().username}@${hostname()}`;

export const promptForSetupGateAction = () =>
	Effect.gen(function* () {
		const interactivePrompt = yield* InteractivePrompt;

		return yield* interactivePrompt.select<SetupGateAction>({
			choices: [
				{ title: "Setup now", value: "setup-now" },
				{ title: "Back", value: "back" },
				{ title: "Cancel", value: "cancel" },
			],
			message: "Setup required",
		});
	});

export const runInteractiveSetupFlow = () =>
	Effect.gen(function* () {
		const alias = yield* Prompt.inputText({
			defaultValue: defaultSetupAlias(),
			message: "Alias",
		});
		const passphrase = yield* promptForConfirmedPassphrase({
			confirmMessage: "Confirm passphrase: ",
			message: "Passphrase: ",
			mismatchMessage: "Passphrases do not match",
		});
		const result = yield* CreateUserIdentity.execute({
			displayName: alias,
			passphrase,
		});
		const location = yield* HomeRepository.getLocation;

		yield* Prompt.writeStdout(
			`${[
				`Created user key ${result.fingerprint} (${result.displayName})`,
				result.publicKey,
				`Home: ${location.rootDirectory}`,
			].join("\n")}\n`,
		);
	});

export const runSetupGate = () =>
	Effect.gen(function* () {
		const action = yield* promptForSetupGateAction();

		if (action !== "setup-now") {
			return yield* Effect.fail(new GuidedFlowCancelledError());
		}

		yield* runInteractiveSetupFlow();
	});
