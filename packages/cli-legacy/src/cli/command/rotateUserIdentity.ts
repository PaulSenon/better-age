import { Command } from "@effect/cli";
import { Effect } from "effect";
import { RotateUserIdentity } from "../../app/rotate-user-identity/RotateUserIdentity.js";
import {
	RotateUserIdentityCryptoError,
	RotateUserIdentityNoActiveIdentityError,
	RotateUserIdentityPersistenceError,
} from "../../app/rotate-user-identity/RotateUserIdentityError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class RotateUserIdentityCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "rotate",
			name: "RotateUserIdentityCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

export const runRotateUserIdentity = () =>
	Effect.gen(function* () {
		const passphrase = yield* Prompt.inputSecret({
			message: "Passphrase: ",
		});
		const result = yield* RotateUserIdentity.execute({
			passphrase,
		});

		yield* Prompt.writeStdout(
			[
				`rotated identity ${result.oldFingerprint} -> ${result.newFingerprint}`,
				"Share updated identity: bage me",
				"",
			].join("\n"),
		);
	}).pipe(
		Effect.catchIf(
			(error): error is RotateUserIdentityNoActiveIdentityError =>
				error instanceof RotateUserIdentityNoActiveIdentityError,
			() =>
				asCommandFailure(
					new RotateUserIdentityCommandFailedError(),
					writeUserFacingError({
						id: "ERR.SETUP.REQUIRED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is RotateUserIdentityPersistenceError =>
				error instanceof RotateUserIdentityPersistenceError,
			() =>
				asCommandFailure(
					new RotateUserIdentityCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.ROTATE_FAILED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is RotateUserIdentityCryptoError =>
				error instanceof RotateUserIdentityCryptoError,
			() =>
				asCommandFailure(
					new RotateUserIdentityCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.ROTATE_FAILED",
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
					new RotateUserIdentityCommandFailedError(),
					writeUserFacingError({
						id: "ERR.PASSPHRASE.UNAVAILABLE",
					}),
				),
		),
	);

export const rotateUserIdentityCommand = Command.make("rotate", {}, () =>
	runRotateUserIdentity(),
);
