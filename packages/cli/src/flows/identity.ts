// `setup` and `identity *` flows.
import type { KnownIdentity } from "@better-age/core/domain/Identity";
import { HomeAlreadySetup, IdentityNotFound } from "@better-age/core/Errors";
import * as Home from "@better-age/core/Home";
import * as Identities from "@better-age/core/Identities";
import { Effect, Option } from "effect";
import { CliFailure, cancelled, usage } from "../failures.js";
import {
	error,
	identityKeys,
	identityLabel,
	identityList,
} from "../present.js";
import { say, sayOk, sayWarning, Ui } from "../ui/Ui.js";
import {
	askNewPassphrase,
	requireInteractive,
	withPassphrase,
} from "./common.js";

export const setup = Effect.fn("setup")(function* (
	name: Option.Option<string>,
) {
	const ui = yield* Ui;
	const displayName = Option.isSome(name)
		? name.value
		: ui.interactive
			? yield* ui.text("Display name")
			: "";

	if (displayName.length === 0) {
		return yield* usage("SETUP_NAME_MISSING");
	}

	// Fail before asking for a passphrase that would be thrown away.
	if ((yield* Home.status).status === "setup") {
		return yield* new HomeAlreadySetup();
	}

	const passphrase = yield* askNewPassphrase("Passphrase");
	const self = yield* Home.setup({ displayName, passphrase });
	yield* sayOk(`Identity created: ${self.handle}`);
});

export const exportIdentity = Effect.gen(function* () {
	const identityString = yield* Identities.exportIdentityString;
	yield* (yield* Ui).stdout(`${identityString}\n`);
});

/** Imports; an unsigned key change for a known owner needs explicit trust. */
export const importWithTrustGate = Effect.fnUntraced(function* (input: {
	readonly identityString: string;
	readonly localAlias: string | undefined;
	readonly trustKeyUpdate: boolean;
}) {
	const ui = yield* Ui;

	return yield* Identities.importIdentity(input).pipe(
		Effect.catchTag("IDENTITY_KEY_UPDATE_REQUIRES_TRUST", (failure) =>
			Effect.gen(function* () {
				if (input.trustKeyUpdate || !ui.interactive) {
					return yield* failure;
				}

				const trusted = yield* ui.confirm(
					`Trust identity key update ${failure.oldFingerprint} -> ${failure.newFingerprint}?`,
				);

				if (!trusted) {
					// Declining is an answer, not an abort: exit 1 as before.
					return yield* new CliFailure({ code: "CANCELLED" });
				}

				return yield* Identities.importIdentity({
					...input,
					trustKeyUpdate: true,
				});
			}),
		),
	);
});

export const importIdentity = Effect.fn("importIdentity")(function* (input: {
	readonly identityString: Option.Option<string>;
	readonly alias: Option.Option<string>;
	readonly trustKeyUpdate: boolean;
}) {
	const ui = yield* Ui;

	if (!ui.interactive && Option.isNone(input.identityString)) {
		return yield* usage("IDENTITY_STRING_MISSING");
	}

	// Guided mode re-prompts whatever was prompted (string or alias) on bad input.
	const maxAttempts = ui.interactive ? 3 : 1;

	for (let attempt = 1; ; attempt++) {
		const identityString = Option.isSome(input.identityString)
			? input.identityString.value
			: yield* ui.text("Identity string");

		if (identityString.length === 0) {
			return yield* usage("IDENTITY_STRING_MISSING");
		}

		const alias = Option.isSome(input.alias)
			? input.alias.value
			: ui.interactive
				? yield* ui.text("Local alias")
				: "";
		const result = yield* Effect.result(
			importWithTrustGate({
				identityString,
				localAlias: alias.length === 0 ? undefined : alias,
				trustKeyUpdate: input.trustKeyUpdate,
			}),
		);

		if (result._tag === "Success") {
			return yield* sayOk(
				`Identity imported: ${result.success.identity.handle}`,
			);
		}

		const failure = result.failure;
		const retryable =
			(failure._tag === "IDENTITY_STRING_INVALID" &&
				Option.isNone(input.identityString)) ||
			((failure._tag === "LOCAL_ALIAS_INVALID" ||
				failure._tag === "LOCAL_ALIAS_DUPLICATE") &&
				Option.isNone(input.alias));

		if (!retryable || attempt >= maxAttempts) {
			return yield* failure;
		}

		yield* say(
			error(
				failure._tag,
				failure._tag === "IDENTITY_STRING_INVALID"
					? "identity string is invalid"
					: failure._tag === "LOCAL_ALIAS_DUPLICATE"
						? "alias already exists"
						: "alias is invalid",
			),
		);
	}
});

export const listIdentities = Effect.gen(function* () {
	const self = yield* Home.selfIdentity;
	const known = yield* Identities.knownIdentities;
	const keys = yield* Home.localKeys;
	yield* (yield* Ui).stdout(identityList({ self, known, keys }));
});

export const listKeys = Effect.fn("listKeys")(function* (flags: {
	readonly current: boolean;
	readonly retired: boolean;
	readonly path: boolean;
}) {
	if (flags.current && flags.retired) {
		return yield* new CliFailure({
			code: "COMMAND_PARSE",
			exitCode: 2,
			detail: "choose --current or --retired, not both",
		});
	}

	const keys = yield* Home.localKeys;
	const current = flags.retired ? null : keys.current;
	const retired = flags.current ? [] : keys.retired;
	const ui = yield* Ui;

	yield* ui.stdout(
		flags.path
			? [...(current === null ? [] : [current]), ...retired]
					.map((key) => `${key.path}\n`)
					.join("")
			: identityKeys({ current, retired }),
	);
});

type Referenceable = Pick<
	KnownIdentity,
	"ownerId" | "localAlias" | "handle" | "displayName"
>;

/**
 * Resolves a user reference by precedence: owner id, local alias, handle,
 * then display name. Display names come from other people's identity strings,
 * so a name shared by several identities is refused instead of guessed.
 */
export const resolveReference = <T extends Referenceable>(
	items: ReadonlyArray<T>,
	reference: string,
) =>
	Effect.gen(function* () {
		for (const matches of [
			(item: T) => item.ownerId === reference,
			(item: T) => item.localAlias === reference,
			(item: T) => item.handle === reference,
			(item: T) => item.displayName === reference,
		]) {
			const found = items.filter(matches);

			if (found.length > 1) {
				return yield* new CliFailure({ code: "IDENTITY_REFERENCE_AMBIGUOUS" });
			}

			if (found[0] !== undefined) {
				return Option.some(found[0]);
			}
		}

		return Option.none<T>();
	});

export const forgetIdentity = Effect.fn("forgetIdentity")(function* (
	reference: Option.Option<string>,
) {
	const ui = yield* Ui;
	const known = yield* Identities.knownIdentities;
	const selected = Option.isSome(reference)
		? reference.value
		: ui.interactive
			? yield* ui.select("Identity", [
					...known.map((identity) => ({
						value: identity.ownerId,
						label: identityLabel(identity),
					})),
					{ value: "cancel", label: "Cancel" },
				])
			: "";

	if (selected.length === 0) {
		return yield* usage("IDENTITY_REFERENCE_MISSING");
	}

	if (Option.isNone(reference) && selected === "cancel") {
		return yield* cancelled();
	}

	const identity = yield* resolveReference(known, selected);

	if (Option.isNone(identity)) {
		return yield* new IdentityNotFound();
	}

	yield* Identities.forgetIdentity(identity.value.ownerId);
	yield* sayOk(`Identity forgotten: ${identity.value.ownerId}`);
});

export const rotateIdentity = Effect.gen(function* () {
	yield* requireInteractive();
	const { value: self } = yield* withPassphrase(Home.rotate);
	yield* sayOk(`Identity rotated: ${self.fingerprint}`);
	yield* sayWarning("Existing payloads may need update: run bage update");
});

export const changePassphrase = Effect.gen(function* () {
	const { passphrase: currentPassphrase } = yield* withPassphrase(
		Home.verifyPassphrase,
		"Current passphrase",
	);
	const nextPassphrase = yield* askNewPassphrase("New passphrase");
	yield* Home.changePassphrase({ currentPassphrase, nextPassphrase });
	yield* sayOk("Passphrase changed");
});
