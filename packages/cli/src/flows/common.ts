// Building blocks shared by command flows: passphrase prompts with retry,
// guided payload paths, and the "payload update required" gate.
import {
	PassphraseIncorrect,
	PayloadNotFound,
	PayloadUpdateRequired,
} from "@better-age/core/Errors";
import * as Payloads from "@better-age/core/Payloads";
import { Effect, FileSystem, Option } from "effect";
import { type CliCode, CliFailure, cancelled, usage } from "../failures.js";
import { error, sanitize } from "../present.js";
import { say, sayOk, sayWarning, Ui } from "../ui/Ui.js";

const attempts = 3;
const minimumPassphraseLength = 8;

export const requireInteractive = Effect.fnUntraced(function* (
	code: CliCode = "PASSPHRASE_UNAVAILABLE",
) {
	if (!(yield* Ui).interactive) {
		return yield* new CliFailure({ code });
	}
});

const retryFeedback = say(
	error("PASSPHRASE_INCORRECT", "invalid passphrase, try again"),
);

/**
 * Prompts for the passphrase and runs `use` with it, re-prompting up to three
 * times while the passphrase is wrong. Other failures stop immediately.
 */
export const withPassphrase = Effect.fnUntraced(function* <A, E, R>(
	use: (passphrase: string) => Effect.Effect<A, E, R>,
	label = "Passphrase",
) {
	yield* requireInteractive();
	const ui = yield* Ui;

	for (let attempt = 1; ; attempt++) {
		const passphrase = yield* ui.secret(label);
		const result = yield* Effect.result(use(passphrase));

		if (result._tag === "Success") {
			return { value: result.success, passphrase };
		}

		const failure = result.failure;

		if (!(failure instanceof PassphraseIncorrect) || attempt === attempts) {
			return yield* Effect.fail(failure);
		}

		yield* retryFeedback;
	}
});

/** New passphrase + confirmation, with immediate feedback and three attempts. */
export const askNewPassphrase = Effect.fnUntraced(function* (label: string) {
	yield* requireInteractive();
	const ui = yield* Ui;
	let lastFailure: CliCode = "PASSPHRASE_CONFIRMATION_MISMATCH";

	for (let attempt = 1; attempt <= attempts; attempt++) {
		const passphrase = yield* ui.secret(label);

		if (passphrase.length < minimumPassphraseLength) {
			lastFailure = "PASSPHRASE_TOO_SHORT";
		} else if (passphrase === (yield* ui.secret("Confirm passphrase"))) {
			return passphrase;
		} else {
			lastFailure = "PASSPHRASE_CONFIRMATION_MISMATCH";
		}

		if (attempt < attempts) {
			yield* say(
				error(
					lastFailure,
					lastFailure === "PASSPHRASE_TOO_SHORT"
						? "passphrase must be at least 8 characters"
						: "passphrase confirmation did not match",
				),
			);
		}
	}

	return yield* new CliFailure({ code: lastFailure });
});

/** Matches `.env.enc` and `.env.<name>.enc` in the current directory. */
export const isPayloadCandidateName = (name: string) =>
	/^\.env(?:\..+)?\.enc$/.test(name);

const discoverPayloadPaths = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const names = yield* fs
		.readDirectory(".")
		.pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
	const candidates: Array<string> = [];

	for (const name of names.filter(isPayloadCandidateName)) {
		const info = yield* Effect.option(fs.stat(name));
		if (Option.isSome(info) && info.value.type === "File") {
			candidates.push(name);
		}
	}

	return candidates.sort();
});

/** Exact path, else (interactive) a picker over discovered payloads or free text. */
export const resolvePayloadPath = Effect.fnUntraced(function* (
	pathArg: Option.Option<string>,
) {
	if (Option.isSome(pathArg)) {
		return pathArg.value;
	}

	const ui = yield* Ui;

	if (!ui.interactive) {
		return yield* usage("PAYLOAD_PATH_MISSING");
	}

	const candidates = yield* discoverPayloadPaths;
	const selected =
		candidates.length === 0
			? "enter-path"
			: yield* ui.select("Payload", [
					...candidates.map((path) => ({ value: path, label: sanitize(path) })),
					{ value: "enter-path", label: "Enter Path" },
					{ value: "cancel", label: "Cancel" },
				]);

	if (selected === "cancel") {
		return yield* cancelled();
	}

	const path =
		selected === "enter-path" ? yield* ui.text("Payload path") : selected;

	return path.length === 0 ? yield* usage("PAYLOAD_PATH_MISSING") : path;
});

export type OpenedPayload = {
	readonly payload: Payloads.DecryptedPayload;
	readonly passphrase: string;
};

/** Resolves, checks, and decrypts an existing payload for a command. */
export const openPayload = Effect.fnUntraced(function* (
	pathArg: Option.Option<string>,
) {
	const path = yield* resolvePayloadPath(pathArg);

	if (
		!(yield* (yield* FileSystem.FileSystem).exists(path).pipe(Effect.orDie))
	) {
		return yield* new PayloadNotFound({ path });
	}

	const opened = yield* withPassphrase((passphrase) =>
		Payloads.decrypt({ path, passphrase }),
	);

	if (opened.value.compatibility === "readable-but-outdated") {
		yield* sayWarning("Payload update recommended: run bage update");
	}

	return { payload: opened.value, passphrase: opened.passphrase };
});

/**
 * Mutations need an up-to-date payload. Exact commands fail fast; guided
 * commands offer to run `update` first.
 */
export const ensureUpToDate = Effect.fnUntraced(function* (
	opened: OpenedPayload,
	exact: boolean,
) {
	if (opened.payload.compatibility === "up-to-date") {
		return;
	}

	if (exact) {
		return yield* new PayloadUpdateRequired({ path: opened.payload.path });
	}

	const choice = yield* (yield* Ui).select("Payload update required", [
		{ value: "update-now", label: "Update now" },
		{ value: "back", label: "Back" },
		{ value: "cancel", label: "Cancel" },
	]);

	if (choice !== "update-now") {
		return yield* cancelled();
	}

	const updated = yield* Payloads.update({
		path: opened.payload.path,
		passphrase: opened.passphrase,
	});
	yield* sayOk(`Payload ${updated.outcome}: ${updated.path}`);
});
