import type { Effect, Option } from "effect";
// Release command grammar. Operands a human can be guided through are
// optional (prompted when interactive); the machine protocol (`load`) is strict.
import { Argument, Command, Flag } from "effect/unstable/cli";
import {
	changePassphrase,
	exportIdentity,
	forgetIdentity,
	importIdentity,
	listIdentities,
	listKeys,
	rotateIdentity,
	setup,
} from "./flows/identity.js";
import { interactiveSession } from "./flows/interactive.js";
import {
	createPayload,
	editPayload,
	inspectPayload,
	loadPayload,
	updatePayload,
	viewPayload,
} from "./flows/payload.js";
import { grant, revoke } from "./flows/sharing.js";

const payload = Argument.String("payload").pipe(
	Argument.withDescription("Encrypted payload file (guided when omitted)"),
	Argument.optional,
);
const identityRef = Argument.String("identity-ref").pipe(
	Argument.withDescription(
		"Owner id, alias, handle, display name, or identity string",
	),
	Argument.optional,
);
const toggle = (name: string, description: string) =>
	Flag.Boolean(name).pipe(
		Flag.withDescription(description),
		Flag.withDefault(false),
	);

const payloadCommand = <Name extends string, E, R>(
	name: Name,
	description: string,
	run: (path: Option.Option<string>) => Effect.Effect<void, E, R>,
) =>
	Command.make(name, { payload }, (input) => run(input.payload)).pipe(
		Command.withDescription(description),
	);

const passphraseCommand = (name: string, description: string) =>
	Command.make(name, {}, () => changePassphrase).pipe(
		Command.withDescription(description),
	);

const identity = Command.make("identity").pipe(
	Command.withDescription("Manage local identities."),
	Command.withSubcommands([
		Command.make("export", {}, () => exportIdentity).pipe(
			Command.withDescription("Print current public identity string."),
		),
		Command.make("forget", { identityRef: identityRef }, (input) =>
			forgetIdentity(input.identityRef),
		).pipe(Command.withDescription("Forget a known identity.")),
		Command.make(
			"import",
			{
				identityString: Argument.String("identity-string").pipe(
					Argument.optional,
				),
				alias: Flag.String("alias").pipe(
					Flag.withDescription("Local alias for this identity"),
					Flag.optional,
				),
				trustKeyUpdate: toggle(
					"trust-key-update",
					"Accept a changed public key for a known owner",
				),
			},
			importIdentity,
		).pipe(Command.withDescription("Import a public identity string.")),
		Command.make("list", {}, () => listIdentities).pipe(
			Command.withDescription("List self, known identities, and retired keys."),
		),
		Command.make(
			"keys",
			{
				current: toggle("current", "Only the current key"),
				retired: toggle("retired", "Only retired keys"),
				path: toggle("path", "Print key file paths only (age -i interop)"),
			},
			listKeys,
		).pipe(Command.withDescription("List local identity key files.")),
		passphraseCommand("passphrase", "Change the identity key passphrase."),
		passphraseCommand("pass", "Alias for identity passphrase."),
		passphraseCommand("pw", "Alias for identity passphrase."),
		Command.make("rotate", {}, () => rotateIdentity).pipe(
			Command.withDescription("Rotate the current public identity."),
		),
	]),
);

export const bage = Command.make("bage").pipe(
	Command.withDescription(
		"Small CLI wrapper around age-encrypted env payloads.",
	),
	Command.withSubcommands([
		payloadCommand("create", "Create an encrypted payload.", createPayload),
		payloadCommand("edit", "Edit encrypted payload text.", editPayload),
		Command.make("grant", { payload, identityRef }, (input) =>
			grant({ path: input.payload, reference: input.identityRef }),
		).pipe(Command.withDescription("Grant payload access to an identity.")),
		payloadCommand(
			"inspect",
			"Inspect encrypted payload metadata.",
			inspectPayload,
		),
		Command.make(
			"load",
			{
				payload,
				protocolVersion: Flag.String("protocol-version").pipe(
					Flag.withDescription("Load protocol version (1)"),
					Flag.optional,
				),
			},
			(input) =>
				loadPayload({
					path: input.payload,
					protocolVersion: input.protocolVersion,
				}),
		).pipe(Command.withDescription("Decrypt payload for varlock.")),
		Command.make("revoke", { payload, identityRef }, (input) =>
			revoke({ path: input.payload, reference: input.identityRef }),
		).pipe(Command.withDescription("Revoke payload access from an identity.")),
		payloadCommand(
			"update",
			"Rewrite payload with current metadata.",
			updatePayload,
		),
		payloadCommand("view", "View encrypted payload text safely.", viewPayload),
		identity,
		Command.make(
			"setup",
			{
				name: Flag.String("name").pipe(
					Flag.withDescription("Display name"),
					Flag.optional,
				),
			},
			(input) => setup(input.name),
		).pipe(Command.withDescription("Create the local identity.")),
		Command.make("interactive", {}, () => interactiveSession).pipe(
			Command.withAlias("i"),
			Command.withDescription("Open the interactive command menu."),
		),
	]),
);
