// `grant` / `revoke`: who can decrypt a payload.
import type { PublicIdentity } from "@better-age/core/domain/Identity";
import { CannotGrantSelf, CannotRevokeSelf } from "@better-age/core/Errors";
import * as Identities from "@better-age/core/Identities";
import * as Payloads from "@better-age/core/Payloads";
import { Effect, Option } from "effect";
import { CliFailure, cancelled, usage } from "../failures.js";
import { error, identityLabel } from "../present.js";
import { say, sayOk, Ui } from "../ui/Ui.js";
import { ensureUpToDate, type OpenedPayload, openPayload } from "./common.js";
import { importWithTrustGate, resolveReference } from "./identity.js";

const enterIdentityString = "__enter_identity_string__";

const toPublicIdentity = (identity: PublicIdentity): PublicIdentity => ({
	ownerId: identity.ownerId,
	displayName: identity.displayName,
	publicKey: identity.publicKey,
	identityUpdatedAt: identity.identityUpdatedAt,
});

/**
 * Exact reference: known identity or payload recipient (the known copy wins
 * for the same owner, so a trusted key update can be pushed), else an
 * identity string.
 */
const resolveGrantReference = Effect.fnUntraced(function* (
	opened: OpenedPayload,
	reference: string,
) {
	const known = yield* Identities.knownIdentities;
	const knownOwners = new Set(known.map((identity) => identity.ownerId));
	const candidates = [
		...known,
		...opened.payload.recipients.filter(
			(recipient) => !knownOwners.has(recipient.ownerId),
		),
	];
	const found = yield* resolveReference(candidates, reference);

	if (Option.isSome(found)) {
		return toPublicIdentity(found.value);
	}

	return yield* Identities.parseIdentityString(reference).pipe(
		Effect.mapError(
			() => new CliFailure({ code: "RECIPIENT_REFERENCE_NOT_FOUND" }),
		),
	);
});

/** Guided entry of a new identity string; it is also imported as known. */
const promptIdentityString = Effect.gen(function* () {
	const ui = yield* Ui;

	for (let attempt = 1; ; attempt++) {
		const identityString = yield* ui.text("Identity string");
		const parsed = yield* Effect.option(
			Identities.parseIdentityString(identityString),
		);

		if (Option.isSome(parsed)) {
			yield* importWithTrustGate({
				identityString,
				localAlias: undefined,
				trustKeyUpdate: false,
			});
			return parsed.value;
		}

		if (attempt === 3) {
			return yield* Identities.parseIdentityString(identityString);
		}

		yield* say(error("IDENTITY_STRING_INVALID", "identity string is invalid"));
	}
});

/** Picker: current recipients shown disabled, known identities selectable. */
const pickGrantRecipient = Effect.fnUntraced(function* (opened: OpenedPayload) {
	const ui = yield* Ui;
	const known = yield* Identities.knownIdentities;
	const granted = new Set(
		opened.payload.recipients.map((item) => item.ownerId),
	);
	const selected = yield* ui.select("Grant recipient", [
		...opened.payload.recipients.map((recipient) => ({
			value: recipient.ownerId,
			label: identityLabel({
				...recipient,
				tag: recipient.isSelf ? "[you]" : "[granted]",
			}),
			disabled: true,
		})),
		...known
			.filter((identity) => !granted.has(identity.ownerId))
			.map((identity) => ({
				value: identity.ownerId,
				label: identityLabel(identity),
			})),
		{ value: enterIdentityString, label: "Enter identity string" },
		{ value: "cancel", label: "Cancel" },
	]);

	if (selected === "cancel") {
		return yield* cancelled();
	}

	return selected === enterIdentityString
		? yield* promptIdentityString
		: yield* resolveGrantReference(opened, selected);
});

export const grant = Effect.fn("grant")(function* (input: {
	readonly path: Option.Option<string>;
	readonly reference: Option.Option<string>;
}) {
	const opened = yield* openPayload(input.path);
	yield* ensureUpToDate(
		opened,
		Option.isSome(input.path) && Option.isSome(input.reference),
	);

	const ui = yield* Ui;
	const recipient = Option.isSome(input.reference)
		? yield* resolveGrantReference(opened, input.reference.value)
		: ui.interactive
			? yield* pickGrantRecipient(opened)
			: yield* usage("RECIPIENT_REFERENCE_NOT_FOUND");

	if (
		opened.payload.recipients.some(
			(item) => item.isSelf && item.ownerId === recipient.ownerId,
		)
	) {
		return yield* new CannotGrantSelf();
	}

	const result = yield* Payloads.grant({
		path: opened.payload.path,
		passphrase: opened.passphrase,
		recipient,
	});
	const outcome = result.outcome === "added" ? "granted" : result.outcome;
	yield* sayOk(`Recipient ${outcome}: ${result.recipient.handle}`);
});

export const revoke = Effect.fn("revoke")(function* (input: {
	readonly path: Option.Option<string>;
	readonly reference: Option.Option<string>;
}) {
	const opened = yield* openPayload(input.path);
	yield* ensureUpToDate(
		opened,
		Option.isSome(input.path) && Option.isSome(input.reference),
	);

	const ui = yield* Ui;
	const recipients = opened.payload.recipients;
	const reference = Option.isSome(input.reference)
		? input.reference.value
		: ui.interactive
			? yield* ui.select("Revoke recipient", [
					...recipients.map((recipient) => ({
						value: recipient.ownerId,
						label: identityLabel({
							...recipient,
							...(recipient.isSelf ? { tag: "[you]" } : {}),
						}),
						disabled: recipient.isSelf,
					})),
					{ value: "cancel", label: "Cancel" },
				])
			: yield* usage("RECIPIENT_REFERENCE_NOT_FOUND");

	if (Option.isNone(input.reference) && reference === "cancel") {
		return yield* cancelled();
	}

	const found = yield* resolveReference(recipients, reference);
	const recipient = Option.getOrUndefined(found);

	if (recipient === undefined) {
		return yield* new CliFailure({ code: "RECIPIENT_REFERENCE_NOT_FOUND" });
	}

	if (recipient.isSelf) {
		return yield* new CannotRevokeSelf();
	}

	const result = yield* Payloads.revoke({
		path: opened.payload.path,
		passphrase: opened.passphrase,
		ownerId: recipient.ownerId,
	});
	const outcome = result.outcome === "removed" ? "revoked" : result.outcome;
	yield* sayOk(`Recipient ${outcome}: ${result.ownerId}`);
});
