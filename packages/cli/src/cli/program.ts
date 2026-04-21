import { Command, HelpDoc, ValidationError } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { withHomeStatePreflight } from "../app/shared/HomeStatePreflight.js";
import {
	HomeStatePreflightMissingPathError,
	HomeStatePreflightUnsupportedVersionError,
} from "../app/shared/HomeStatePreflightError.js";
import {
	HomeStateDecodeError,
	HomeStateLoadError,
	HomeStateSaveError,
} from "../port/HomeRepositoryError.js";
import { BetterAgeLive } from "../program/layer.js";
import { addIdentityCommand } from "./command/addIdentityCommand.js";
import { changePassphraseCommand } from "./command/changePassphraseCommand.js";
import { createPayloadCommand } from "./command/createPayloadCommand.js";
import { editPayloadCommand } from "./command/editPayloadCommand.js";
import { forgetIdentityCommand } from "./command/forgetIdentityCommand.js";
import { grantPayloadCommand } from "./command/grantPayloadCommand.js";
import { identitiesCommand } from "./command/identitiesCommand.js";
import { inspectPayloadCommand } from "./command/inspectPayloadCommand.js";
import { interactiveCommand } from "./command/interactiveCommand.js";
import { loadPayloadCommand } from "./command/loadPayloadCommand.js";
import { meCommand } from "./command/meCommand.js";
import { revokePayloadCommand } from "./command/revokePayloadCommand.js";
import { rotateUserIdentityCommand } from "./command/rotateUserIdentity.js";
import { setupUserKeyCommand } from "./command/setupUserKey.js";
import { updatePayloadCommand } from "./command/updatePayloadCommand.js";
import { viewPayloadCommand } from "./command/viewPayloadCommand.js";
import { CliCommandFailedError } from "./shared/commandFailure.js";

export const rootCommand = Command.make("bage").pipe(
	Command.withSubcommands([
		setupUserKeyCommand,
		interactiveCommand,
		meCommand,
		addIdentityCommand,
		forgetIdentityCommand,
		identitiesCommand,
		rotateUserIdentityCommand,
		changePassphraseCommand,
		createPayloadCommand,
		editPayloadCommand,
		grantPayloadCommand,
		revokePayloadCommand,
		inspectPayloadCommand,
		viewPayloadCommand,
		loadPayloadCommand,
		updatePayloadCommand,
	]),
);

const cli = Command.run(rootCommand, {
	name: "bage",
	version: "0.0.1",
});

const MainLive = Layer.mergeAll(BetterAgeLive, NodeContext.layer);

const withTrailingNewline = (text: string) =>
	text.endsWith("\n") ? text : `${text}\n`;

const renderCliValidationError = (error: ValidationError.ValidationError) => {
	const rendered = HelpDoc.toAnsiText(error.error).trimEnd();

	switch (error._tag) {
		case "CommandMismatch":
		case "MissingSubcommand":
			return withTrailingNewline(`${rendered}\nRun: bage --help`);
		default:
			return withTrailingNewline(rendered);
	}
};

export const runCli = (argv: ReadonlyArray<string>) =>
	withHomeStatePreflight(cli(argv)).pipe(
		Effect.provide(MainLive),
		Effect.as(0),
		Effect.catchIf(
			(
				error,
			): error is
				| HomeStatePreflightMissingPathError
				| HomeStatePreflightUnsupportedVersionError
				| HomeStateLoadError
				| HomeStateDecodeError
				| HomeStateSaveError =>
				error instanceof HomeStatePreflightMissingPathError ||
				error instanceof HomeStatePreflightUnsupportedVersionError ||
				error instanceof HomeStateLoadError ||
				error instanceof HomeStateDecodeError ||
				error instanceof HomeStateSaveError,
			(error) =>
				Effect.sync(() => {
					process.stderr.write(withTrailingNewline(error.message));
					return 1;
				}),
		),
		Effect.catchIf(
			(error): error is CliCommandFailedError =>
				error instanceof CliCommandFailedError,
			() => Effect.succeed(1),
		),
		Effect.catchIf(
			(error): error is ValidationError.ValidationError =>
				ValidationError.isValidationError(error),
			(error) =>
				Effect.sync(() => {
					process.stderr.write(renderCliValidationError(error));
					return error._tag === "HelpRequested" ? 0 : 1;
				}),
		),
	);

export const runCliMain = (argv: ReadonlyArray<string>) =>
	NodeRuntime.runMain(
		runCli(argv).pipe(
			Effect.tap((exitCode) =>
				Effect.sync(() => {
					process.exitCode = exitCode;
				}),
			),
			Effect.asVoid,
		),
	);
