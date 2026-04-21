import { Args, Command } from "@effect/cli";
import { Effect, type Option } from "effect";
import {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
} from "../../app/inspect-payload/InspectPayloadError.js";
import {
	RevokePayloadRecipientAmbiguousIdentityError,
	RevokePayloadRecipientCryptoError,
	RevokePayloadRecipientForbiddenSelfError,
	RevokePayloadRecipientPersistenceError,
	RevokePayloadRecipientUpdateRequiredError,
} from "../../app/revoke-payload-recipient/RevokePayloadRecipientError.js";
import { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import {
	UpdatePayloadCryptoError,
	UpdatePayloadEnvError,
	UpdatePayloadPersistenceError,
} from "../../app/update-payload/UpdatePayloadError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { runRevokePayloadFlow } from "../flow/revokePayloadFlow.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { renderUpdateRequiredMessage } from "../shared/updateGate.js";

export class RevokePayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "revoke",
			name: "RevokePayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);
const identityRefArg = Args.text({ name: "identity-ref" }).pipe(Args.optional);

export const runRevokePayload = (input: {
	readonly identityRef: Option.Option<string>;
	readonly path: Option.Option<string>;
}) =>
	runRevokePayloadFlow(input).pipe(
		Effect.catchIf(
			(error): error is RevokePayloadRecipientUpdateRequiredError =>
				error instanceof RevokePayloadRecipientUpdateRequiredError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(
						renderUpdateRequiredMessage("revoke", error.path),
					);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadPersistenceError =>
				error instanceof UpdatePayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadCryptoError =>
				error instanceof UpdatePayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is UpdatePayloadEnvError =>
				error instanceof UpdatePayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is RevokePayloadRecipientAmbiguousIdentityError =>
				error instanceof RevokePayloadRecipientAmbiguousIdentityError,
			() => Effect.fail(new RevokePayloadCommandFailedError()),
		),
		Effect.catchIf(
			(error): error is RevokePayloadRecipientForbiddenSelfError =>
				error instanceof RevokePayloadRecipientForbiddenSelfError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolvePayloadTargetError =>
				error instanceof ResolvePayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is RevokePayloadRecipientPersistenceError =>
				error instanceof RevokePayloadRecipientPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is RevokePayloadRecipientCryptoError =>
				error instanceof RevokePayloadRecipientCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadPersistenceError =>
				error instanceof InspectPayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadFileFormatError =>
				error instanceof InspectPayloadFileFormatError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadCryptoError =>
				error instanceof InspectPayloadCryptoError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvelopeError =>
				error instanceof InspectPayloadEnvelopeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvError =>
				error instanceof InspectPayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new RevokePayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is GuidedFlowCancelledError =>
				error instanceof GuidedFlowCancelledError,
			() => Effect.void,
		),
	);

export const revokePayloadCommand = Command.make(
	"revoke",
	{
		path: pathArg,
		identityRef: identityRefArg,
	},
	({ identityRef, path }) => runRevokePayload({ identityRef, path }),
);
