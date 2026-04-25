import { Command } from "@effect/cli";
import { Effect } from "effect";
import { ChangePassphrase } from "../../app/change-passphrase/ChangePassphrase.js";
import {
	ChangePassphraseCryptoError,
	ChangePassphraseNoActiveIdentityError,
	ChangePassphrasePersistenceError,
} from "../../app/change-passphrase/ChangePassphraseError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { promptForConfirmedPassphrase } from "../shared/passphrasePairPrompt.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class ChangePassphraseCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "change-passphrase",
			name: "ChangePassphraseCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

export const runChangePassphrase = () =>
	Effect.gen(function* () {
		const currentPassphrase = yield* Prompt.inputSecret({
			message: "Current passphrase: ",
		});
		const nextPassphrase = yield* promptForConfirmedPassphrase({
			confirmMessage: "Confirm new passphrase: ",
			message: "New passphrase: ",
			mismatchMessage: "Passphrases do not match",
		});

		yield* ChangePassphrase.execute({
			currentPassphrase,
			nextPassphrase,
		});
		yield* Prompt.writeStdout("updated passphrase for all local keys\n");
	}).pipe(
		Effect.catchIf(
			(error): error is ChangePassphraseNoActiveIdentityError =>
				error instanceof ChangePassphraseNoActiveIdentityError,
			() =>
				asCommandFailure(
					new ChangePassphraseCommandFailedError(),
					writeUserFacingError({
						id: "ERR.SETUP.REQUIRED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is ChangePassphrasePersistenceError =>
				error instanceof ChangePassphrasePersistenceError,
			() =>
				asCommandFailure(
					new ChangePassphraseCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is ChangePassphraseCryptoError =>
				error instanceof ChangePassphraseCryptoError,
			() =>
				asCommandFailure(
					new ChangePassphraseCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.PASSPHRASE_CHANGE_FAILED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			() => Effect.void,
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			() =>
				asCommandFailure(
					new ChangePassphraseCommandFailedError(),
					writeUserFacingError({
						id: "ERR.PASSPHRASE.UNAVAILABLE",
					}),
				),
		),
	);

export const changePassphraseCommand = Command.make(
	"change-passphrase",
	{},
	() => runChangePassphrase(),
);
