// Use cases about encrypted payload files. Every write re-encrypts to the full
// recipient list and is verified decryptable with our current key before the
// file is replaced.
import { Effect, Option } from "effect";
import type { HomeState } from "./artifacts/HomeState.js";
import type { LocalKey } from "./artifacts/KeyFile.js";
import {
	decodePayloadPlaintext,
	encodePayloadPlaintext,
	extractPayloadArmor,
	formatPayloadFile,
	type PayloadPlaintext,
} from "./artifacts/PayloadFile.js";
import type { PublicIdentity } from "./artifacts/PublicIdentity.js";
import { selfPublicIdentity } from "./domain/Identity.js";
import {
	envKeysOf,
	grantRecipient,
	isOutdated,
	newPayload,
	type PayloadRecipient,
	refreshSelf,
	revokeRecipient,
	toPayloadRecipient,
} from "./domain/Payload.js";
import {
	CannotGrantSelf,
	CannotRevokeSelf,
	PayloadAccessDenied,
	PayloadAlreadyExists,
	PayloadInvalid,
	PayloadNotFound,
	PayloadUpdateRequired,
	PayloadWriteVerificationFailed,
} from "./Errors.js";
import {
	nowIso,
	randomId,
	requireHome,
	unlockCurrentKey,
	unlockKey,
} from "./Home.js";
import { report } from "./Notices.js";
import { AgeCrypto } from "./services/AgeCrypto.js";
import { PayloadFiles } from "./services/PayloadFiles.js";

export type DecryptedPayload = {
	readonly path: string;
	readonly payloadId: string;
	readonly createdAt: string;
	readonly lastRewrittenAt: string;
	readonly schemaVersion: number;
	/** Outdated payloads stay readable; writes need `update` first. */
	readonly compatibility: "up-to-date" | "readable-but-outdated";
	readonly envText: string;
	readonly envKeys: ReadonlyArray<string>;
	readonly recipients: ReadonlyArray<PayloadRecipient>;
};

/** Current key first, then retired keys (payloads written before a rotation). */
const decryptWithLocalKeys = Effect.fnUntraced(function* (input: {
	readonly path: string;
	readonly home: HomeState;
	readonly passphrase: string;
	readonly armor: string;
	readonly currentKey: LocalKey;
}) {
	const crypto = yield* AgeCrypto;
	const withCurrent = yield* crypto.decrypt(input.armor, [input.currentKey]);

	if (Option.isSome(withCurrent)) {
		return withCurrent.value;
	}

	for (const retired of input.home.retiredKeys) {
		const key = yield* unlockKey(
			retired.encryptedPrivateKeyRef,
			input.passphrase,
		).pipe(Effect.option);

		if (Option.isNone(key)) {
			yield* report({
				code: "RETIRED_KEY_UNREADABLE",
				fingerprint: retired.fingerprint,
			});
			continue;
		}

		const text = yield* crypto.decrypt(input.armor, [key.value]);

		if (Option.isSome(text)) {
			return text.value;
		}
	}

	return yield* new PayloadAccessDenied({ path: input.path });
});

const openPayload = Effect.fnUntraced(function* (
	path: string,
	passphrase: string,
) {
	const home = yield* requireHome;
	const contents = yield* (yield* PayloadFiles).read(path);

	if (Option.isNone(contents)) {
		return yield* new PayloadNotFound({ path });
	}

	const armor = extractPayloadArmor(contents.value);

	if (Option.isNone(armor)) {
		return yield* new PayloadInvalid({ path });
	}

	const currentKey = yield* unlockCurrentKey(home, passphrase);
	const text = yield* decryptWithLocalKeys({
		path,
		home,
		passphrase,
		armor: armor.value,
		currentKey,
	});
	const plaintext = decodePayloadPlaintext(text);

	if (Option.isNone(plaintext)) {
		return yield* new PayloadInvalid({ path });
	}

	return { home, currentKey, plaintext: plaintext.value };
});

/** Opens for mutation: refuses outdated payloads so writes never drop our current key. */
const openPayloadForWrite = Effect.fnUntraced(function* (
	path: string,
	passphrase: string,
) {
	const opened = yield* openPayload(path, passphrase);

	if (isOutdated(opened.home, opened.plaintext)) {
		return yield* new PayloadUpdateRequired({ path });
	}

	return opened;
});

const writePayload = Effect.fnUntraced(function* (input: {
	readonly path: string;
	readonly plaintext: PayloadPlaintext;
	readonly currentKey: LocalKey;
}) {
	const crypto = yield* AgeCrypto;
	const armor = yield* crypto.encrypt(
		encodePayloadPlaintext(input.plaintext),
		input.plaintext.recipients.map((recipient) => recipient.publicKey),
	);
	const readBack = yield* crypto.decrypt(armor, [input.currentKey]);

	if (Option.isNone(Option.flatMap(readBack, decodePayloadPlaintext))) {
		return yield* new PayloadWriteVerificationFailed();
	}

	yield* (yield* PayloadFiles).write(input.path, formatPayloadFile(armor));
});

const rewrite = Effect.fnUntraced(function* (
	opened: {
		readonly plaintext: PayloadPlaintext;
		readonly currentKey: LocalKey;
	},
	path: string,
	changes: Partial<Pick<PayloadPlaintext, "envText" | "recipients">>,
) {
	yield* writePayload({
		path,
		currentKey: opened.currentKey,
		plaintext: {
			...opened.plaintext,
			...changes,
			lastRewrittenAt: yield* nowIso,
		},
	});
});

export const create = Effect.fn("Payloads.create")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
	readonly overwrite?: boolean | undefined;
}) {
	const home = yield* requireHome;

	if (
		input.overwrite !== true &&
		(yield* (yield* PayloadFiles).exists(input.path))
	) {
		return yield* new PayloadAlreadyExists({ path: input.path });
	}

	const currentKey = yield* unlockCurrentKey(home, input.passphrase);
	const plaintext = newPayload({
		payloadId: yield* randomId("payload"),
		now: yield* nowIso,
		self: selfPublicIdentity(home),
	});

	yield* writePayload({ path: input.path, plaintext, currentKey });

	return { path: input.path, payloadId: plaintext.payloadId };
});

export const decrypt = Effect.fn("Payloads.decrypt")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
}) {
	const { home, plaintext } = yield* openPayload(input.path, input.passphrase);

	return {
		path: input.path,
		payloadId: plaintext.payloadId,
		createdAt: plaintext.createdAt,
		lastRewrittenAt: plaintext.lastRewrittenAt,
		schemaVersion: plaintext.version,
		compatibility: isOutdated(home, plaintext)
			? "readable-but-outdated"
			: "up-to-date",
		envText: plaintext.envText,
		envKeys: envKeysOf(plaintext.envText),
		recipients: plaintext.recipients.map((recipient) =>
			toPayloadRecipient(home, recipient),
		),
	} satisfies DecryptedPayload;
});

/** Stores `envText` exactly as given: payload text has no format rules. */
export const edit = Effect.fn("Payloads.edit")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
	readonly envText: string;
}) {
	const opened = yield* openPayloadForWrite(input.path, input.passphrase);
	const unchanged = opened.plaintext.envText === input.envText;

	if (!unchanged) {
		yield* rewrite(opened, input.path, { envText: input.envText });
	}

	return {
		path: input.path,
		payloadId: opened.plaintext.payloadId,
		outcome: unchanged ? ("unchanged" as const) : ("edited" as const),
	};
});

export const grant = Effect.fn("Payloads.grant")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
	readonly recipient: PublicIdentity;
}) {
	const opened = yield* openPayload(input.path, input.passphrase);

	if (input.recipient.ownerId === opened.home.ownerId) {
		return yield* new CannotGrantSelf();
	}

	if (isOutdated(opened.home, opened.plaintext)) {
		return yield* new PayloadUpdateRequired({ path: input.path });
	}

	const granted = grantRecipient(opened.plaintext, input.recipient);

	if (granted.outcome !== "unchanged") {
		yield* rewrite(opened, input.path, { recipients: granted.recipients });
	}

	return {
		path: input.path,
		payloadId: opened.plaintext.payloadId,
		recipient: toPayloadRecipient(opened.home, input.recipient),
		outcome: granted.outcome,
	};
});

export const revoke = Effect.fn("Payloads.revoke")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
	readonly ownerId: string;
}) {
	const opened = yield* openPayload(input.path, input.passphrase);

	if (input.ownerId === opened.home.ownerId) {
		return yield* new CannotRevokeSelf();
	}

	if (isOutdated(opened.home, opened.plaintext)) {
		return yield* new PayloadUpdateRequired({ path: input.path });
	}

	const revoked = revokeRecipient(opened.plaintext, input.ownerId);

	if (revoked.outcome === "removed") {
		yield* rewrite(opened, input.path, { recipients: revoked.recipients });
	}

	return {
		path: input.path,
		payloadId: opened.plaintext.payloadId,
		ownerId: input.ownerId,
		outcome: revoked.outcome,
	};
});

/** Re-encrypts to our current identity (e.g. after rotation). */
export const update = Effect.fn("Payloads.update")(function* (input: {
	readonly path: string;
	readonly passphrase: string;
}) {
	const opened = yield* openPayload(input.path, input.passphrase);
	const outdated = isOutdated(opened.home, opened.plaintext);

	if (outdated) {
		yield* rewrite(opened, input.path, {
			recipients: refreshSelf(opened.home, opened.plaintext),
		});
	}

	return {
		path: input.path,
		payloadId: opened.plaintext.payloadId,
		outcome: outdated ? ("updated" as const) : ("unchanged" as const),
	};
});
