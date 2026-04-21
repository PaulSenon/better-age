import { Args, Command } from "@effect/cli";
import { Effect, Option } from "effect";
import { InspectPayload } from "../../app/inspect-payload/InspectPayload.js";
import {
	InspectPayloadCryptoError,
	InspectPayloadEnvError,
	InspectPayloadEnvelopeError,
	InspectPayloadFileFormatError,
	InspectPayloadPersistenceError,
} from "../../app/inspect-payload/InspectPayloadError.js";
import { ResolvePayloadTarget } from "../../app/shared/ResolvePayloadTarget.js";
import { ResolvePayloadTargetError } from "../../app/shared/ResolvePayloadTargetError.js";
import { Prompt } from "../../port/Prompt.js";
import {
	PromptReadAbortedError,
	PromptUnavailableError,
} from "../../port/PromptError.js";
import { GuidedFlowCancelledError } from "../../shared/GuidedFlowCancelledError.js";
import { CliCommandFailedError } from "../shared/commandFailure.js";
import { renderIdentityLabel } from "../shared/identityLabel.js";
import { runWithPassphraseRetry } from "../shared/passphraseRetry.js";
import {
	asCommandFailure,
	writeUserFacingError,
} from "../shared/userFacingMessage.js";

export class InspectPayloadCommandFailedError extends CliCommandFailedError {
	constructor() {
		super({
			command: "inspect",
			name: "InspectPayloadCommandFailedError",
			reason: "user-facing-error",
		});
	}
}

export type InspectPayloadFlowResult = "cancelled" | "completed";

const pathArg = Args.text({ name: "path" }).pipe(Args.optional);

const shortenFingerprint = (value: string) => value.slice(0, 12);

const renderNeedsUpdate = (needsUpdate: {
	readonly isRequired: boolean;
	readonly reason: Option.Option<string>;
}) =>
	needsUpdate.isRequired
		? `yes${Option.match(needsUpdate.reason, {
				onNone: () => "",
				onSome: (reason) => ` (${reason})`,
			})}`
		: "no";

const renderRecipient = (recipient: {
	readonly displayName: string;
	readonly fingerprint: string;
	readonly handle: string;
	readonly isMe: boolean;
	readonly isStaleSelf: boolean;
	readonly localAlias: Option.Option<string>;
}) => {
	const flags = [...(recipient.isStaleSelf ? ["stale-self"] : [])];

	return [
		`${renderIdentityLabel({
			displayName: recipient.displayName,
			handle: recipient.handle,
			isYou: recipient.isMe,
			localAlias: recipient.localAlias,
		})} ${shortenFingerprint(recipient.fingerprint)}`,
		...(flags.length === 0 ? [] : [flags.join(" ")]),
	].join(" ");
};

const renderInspectOutput = (inspection: {
	readonly createdAt: string;
	readonly envKeys: ReadonlyArray<string>;
	readonly lastRewrittenAt: string;
	readonly needsUpdate: {
		readonly isRequired: boolean;
		readonly reason: Option.Option<string>;
	};
	readonly path: string;
	readonly payloadId: string;
	readonly recipientCount: number;
	readonly recipients: ReadonlyArray<{
		readonly displayName: string;
		readonly fingerprint: string;
		readonly handle: string;
		readonly isMe: boolean;
		readonly isStaleSelf: boolean;
		readonly localAlias: Option.Option<string>;
	}>;
	readonly secretCount: number;
	readonly version: 1;
}) =>
	[
		"Payload",
		`path: ${inspection.path}`,
		`version: ${inspection.version}`,
		`payload id: ${inspection.payloadId}`,
		`created at: ${inspection.createdAt}`,
		`last rewritten at: ${inspection.lastRewrittenAt}`,
		`secret count: ${inspection.secretCount}`,
		`recipient count: ${inspection.recipientCount}`,
		`needs update: ${renderNeedsUpdate(inspection.needsUpdate)}`,
		"",
		"Recipients",
		...(inspection.recipients.length === 0
			? ["none"]
			: inspection.recipients.map(renderRecipient)),
		"",
		"Env keys",
		...(inspection.envKeys.length === 0 ? ["no keys"] : inspection.envKeys),
		"",
	].join("\n");

export const runInspectPayload = (input: {
	readonly path: Option.Option<string>;
}) =>
	Effect.gen(function* () {
		const resolvedPath = yield* ResolvePayloadTarget.resolveExistingPath(
			input.path,
		);
		const result = yield* runWithPassphraseRetry({
			invocationShape: Option.isSome(input.path) ? "exact" : "guided",
			isRetryableError: (error): error is InspectPayloadCryptoError =>
				error instanceof InspectPayloadCryptoError,
			run: (passphrase) =>
				InspectPayload.execute({
					passphrase,
					path: resolvedPath,
				}),
		});

		yield* Prompt.writeStdout(`${renderInspectOutput(result)}\n`);
		return "completed" as const;
	}).pipe(
		Effect.catchIf(
			(error): error is InspectPayloadPersistenceError =>
				error instanceof InspectPayloadPersistenceError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InspectPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadFileFormatError =>
				error instanceof InspectPayloadFileFormatError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InspectPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadCryptoError =>
				error instanceof InspectPayloadCryptoError,
			() =>
				asCommandFailure(new InspectPayloadCommandFailedError(), Effect.void),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvelopeError =>
				error instanceof InspectPayloadEnvelopeError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InspectPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is InspectPayloadEnvError =>
				error instanceof InspectPayloadEnvError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InspectPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is ResolvePayloadTargetError =>
				error instanceof ResolvePayloadTargetError,
			(error) =>
				Effect.gen(function* () {
					yield* Prompt.writeStderr(`${error.message}\n`);
					return yield* Effect.fail(new InspectPayloadCommandFailedError());
				}),
		),
		Effect.catchIf(
			(error): error is PromptReadAbortedError =>
				error instanceof PromptReadAbortedError,
			() => Effect.succeed("cancelled" as const),
		),
		Effect.catchIf(
			(error): error is PromptUnavailableError =>
				error instanceof PromptUnavailableError,
			() =>
				asCommandFailure(
					new InspectPayloadCommandFailedError(),
					writeUserFacingError({
						id: "ERR.PASSPHRASE.UNAVAILABLE",
					}),
				),
		),
		Effect.catchIf(
			(error): error is GuidedFlowCancelledError =>
				error instanceof GuidedFlowCancelledError,
			() => Effect.succeed("cancelled" as const),
		),
	);

export const inspectPayloadCommand = Command.make(
	"inspect",
	{
		path: pathArg,
	},
	({ path }) => runInspectPayload({ path }),
);
