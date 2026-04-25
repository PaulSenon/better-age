import { Command } from "@effect/cli";
import { Effect } from "effect";
import { ExportIdentityString } from "../../app/export-identity-string/ExportIdentityString.js";
import {
	ExportIdentityStringNotSetUpError,
	ExportIdentityStringPersistenceError,
} from "../../app/export-identity-string/ExportIdentityStringError.js";
import { Prompt } from "../../port/Prompt.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class MeCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "me",
			name: "MeCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

export const runMe = () =>
	Effect.gen(function* () {
		const identityString = yield* ExportIdentityString.execute;
		yield* Prompt.writeStdout(`${identityString}\n`);
	}).pipe(
		Effect.catchIf(
			(error): error is ExportIdentityStringNotSetUpError =>
				error instanceof ExportIdentityStringNotSetUpError,
			() =>
				asCommandFailure(
					new MeCommandFailedError(),
					writeUserFacingError({
						id: "ERR.SETUP.REQUIRED",
					}),
				),
		),
		Effect.catchIf(
			(error): error is ExportIdentityStringPersistenceError =>
				error instanceof ExportIdentityStringPersistenceError,
			() =>
				asCommandFailure(
					new MeCommandFailedError(),
					writeUserFacingError({
						id: "ERR.IDENTITY.EXPORT_FAILED",
					}),
				),
		),
	);

export const meCommand = Command.make("me", {}, () => runMe());
