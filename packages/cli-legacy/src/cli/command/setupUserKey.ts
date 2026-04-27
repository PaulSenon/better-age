import { hostname, userInfo } from "node:os";
import { Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";
import { CreateUserIdentity } from "../../app/create-user-identity/CreateUserIdentity.js";
import {
	CreateUserIdentityCryptoError,
	CreateUserIdentityPersistenceError,
} from "../../app/create-user-identity/CreateUserIdentityError.js";
import {
	ActiveKeyAlreadyExistsError,
	InvalidIdentityAliasError,
} from "../../domain/error/IdentityDomainError.js";
import { HomeRepository } from "../../port/HomeRepository.js";
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

export class SetupUserKeyCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "setup",
			name: "SetupUserKeyCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

class SetupAliasRequiredError extends Error {
	override readonly name = "SetupAliasRequiredError";
}

const aliasOption = Options.optional(Options.text("alias"));

const defaultAlias = () => `${userInfo().username}@${hostname()}`;

const resolveAlias = (options: { readonly alias: Option.Option<string> }) =>
	Effect.gen(function* () {
		if (Option.isSome(options.alias)) {
			return options.alias.value;
		}

		return yield* Prompt.inputText({
			defaultValue: defaultAlias(),
			message: "Alias",
		}).pipe(
			Effect.catchIf(
				(error): error is PromptUnavailableError =>
					error instanceof PromptUnavailableError,
				() => Effect.fail(new SetupAliasRequiredError()),
			),
		);
	});

export const setupUserKeyCommand = Command.make(
	"setup",
	{
		alias: aliasOption,
	},
	(options) =>
		Effect.gen(function* () {
			const alias = yield* resolveAlias(options);
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
			return;
		}).pipe(
			Effect.catchIf(
				(error): error is ActiveKeyAlreadyExistsError =>
					error instanceof ActiveKeyAlreadyExistsError,
				() =>
					asCommandFailure(
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.SETUP.ALREADY_CONFIGURED",
						}),
					),
			),
			Effect.catchIf(
				(error): error is CreateUserIdentityCryptoError =>
					error instanceof CreateUserIdentityCryptoError,
				() =>
					asCommandFailure(
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.SETUP.CREATE_FAILED",
						}),
					),
			),
			Effect.catchIf(
				(error): error is CreateUserIdentityPersistenceError =>
					error instanceof CreateUserIdentityPersistenceError,
				() =>
					asCommandFailure(
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.SETUP.CREATE_FAILED",
						}),
					),
			),
			Effect.catchIf(
				(error): error is InvalidIdentityAliasError =>
					error instanceof InvalidIdentityAliasError,
				() =>
					asCommandFailure(
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.SETUP.ALIAS_INVALID",
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
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.PASSPHRASE.UNAVAILABLE",
						}),
					),
			),
			Effect.catchIf(
				(error): error is SetupAliasRequiredError =>
					error instanceof SetupAliasRequiredError,
				() =>
					asCommandFailure(
						new SetupUserKeyCommandFailedError(),
						writeUserFacingError({
							id: "ERR.SETUP.ALIAS_REQUIRED",
						}),
					),
			),
		),
);
