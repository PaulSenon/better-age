import { Args, Command } from "@effect/cli";
import { Effect, type Option } from "effect";
import {
	GrantPayloadRecipientAmbiguousIdentityError,
	GrantPayloadRecipientCryptoError,
	GrantPayloadRecipientIdentityNotFoundError,
	GrantPayloadRecipientPersistenceError,
	GrantPayloadRecipientUpdateRequiredError,
} from "../../app/grant-payload-recipient/GrantPayloadRecipientError.js";
import {
	ImportIdentityStringConflictError,
	ImportIdentityStringDecodeError,
	ImportIdentityStringForbiddenSelfError,
	ImportIdentityStringPersistenceError,
} from "../../app/import-identity-string/ImportIdentityStringError.js";
import {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
} from "../../app/inspect-payload/InspectPayloadError.js";
import { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadPersistenceError,
} from "../../app/update-payload/UpdatePayloadError.js";
import {
	HomeStateDecodeError,
	HomeStateLoadError,
} from "../../port/HomeRepositoryError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { runGrantPayloadFlow } from "../flow/grantPayloadFlow.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { renderUpdateRequiredMessage } from "../shared/updateGate.js";

export class GrantPayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "grant",
			name: "GrantPayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);
const identityRefArg = Args.text({ name: "identity-ref" }).pipe(Args.optional);

export const runGrantPayload = (input: {
	readonly identityRef: Option.Option<string>;
	readonly path: Option.Option<string>;
}) => {
	const withGrantMutationErrors = runGrantPayloadFlow(input).pipe(
		Effect.catchIf(
			(error): error is GrantPayloadRecipientUpdateRequiredError =>
				error instanceof GrantPayloadRecipientUpdateRequiredError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(
						renderUpdateRequiredMessage("grant", error.path),
					);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GrantPayloadRecipientAmbiguousIdentityError =>
				error instanceof GrantPayloadRecipientAmbiguousIdentityError,
			() => Effect.fail(new GrantPayloadCommandFailedError()),
		),
		Effect.catchIf(
			(error): error is GrantPayloadRecipientIdentityNotFoundError =>
				error instanceof GrantPayloadRecipientIdentityNotFoundError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GrantPayloadRecipientPersistenceError =>
				error instanceof GrantPayloadRecipientPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GrantPayloadRecipientCryptoError =>
				error instanceof GrantPayloadRecipientCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadPersistenceError =>
				error instanceof UpdatePayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadCryptoError =>
				error instanceof UpdatePayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadEnvError =>
				error instanceof UpdatePayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ImportIdentityStringConflictError =>
				error instanceof ImportIdentityStringConflictError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ImportIdentityStringDecodeError =>
				error instanceof ImportIdentityStringDecodeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ImportIdentityStringForbiddenSelfError =>
				error instanceof ImportIdentityStringForbiddenSelfError,
			() =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr("Cannot grant your own identity string\n");
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
	);

	return withGrantMutationErrors.pipe(
		Effect.catchIf(
			(error): error is GuidedFlowCancelledError =>
				error instanceof GuidedFlowCancelledError,
			() => Effect.void,
		),
		Effect.catchIf(
			(error): error is ImportIdentityStringPersistenceError =>
				error instanceof ImportIdentityStringPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolvePayloadTargetError =>
				error instanceof ResolvePayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is HomeStateLoadError =>
				error instanceof HomeStateLoadError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is HomeStateDecodeError =>
				error instanceof HomeStateDecodeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadPersistenceError =>
				error instanceof InspectPayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadFileFormatError =>
				error instanceof InspectPayloadFileFormatError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadCryptoError =>
				error instanceof InspectPayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvelopeError =>
				error instanceof InspectPayloadEnvelopeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvError =>
				error instanceof InspectPayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new GrantPayloadCommandFailedError());
				}),
		),
	);
};

export const grantPayloadCommand = Command.make(
	"grant",
	{
		path: pathArg,
		identityRef: identityRefArg,
	},
	({ identityRef, path }) => runGrantPayload({ identityRef, path }),
);
