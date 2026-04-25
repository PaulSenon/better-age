import { Effect, Option } from "effect";
import { Prompt } from "../../port/Prompt.js";

export const makePassphraseSession = () => {
	let cachedPassphrase = Option.none<string>();

	return Effect.fn("PassphraseSession.getPassphrase")(function* () {
		if (Option.isSome(cachedPassphrase)) {
			return cachedPassphrase.value;
		}

		const passphrase = yield* Prompt.inputSecret({
			message: "Passphrase: ",
		});
		cachedPassphrase = Option.some(passphrase);
		return passphrase;
	});
};
